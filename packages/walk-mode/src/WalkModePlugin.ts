import {Plugin, type TickEvent, type Viewer} from "@xeokit/xeokit-sdk";
import {Doors} from "./Doors.js";
import {Keyboard, type WalkModeAction, type WalkModeKeys} from "./Keyboard.js";
import {resolveModes, resolveSettings, type WalkModeModes, type WalkModeSettings} from "./settings.js";
import {Walker} from "./Walker.js";

/**
 * What the crosshair currently aims at, ````null```` when nothing interactive is within reach.
 */
export type WalkModeTarget = "door" | null;

/**
 * Events fired by {@link WalkModePlugin}.
 */
export interface WalkModeEvents {
    /** Walk mode was activated or deactivated (also by the "exit" key or by losing pointer lock). */
    active: boolean;
    /** The crosshair target changed - use it to show a prompt, e.g. "Press F to enter". */
    target: WalkModeTarget;
    /** Free flight toggled. */
    flying: boolean;
    /** Actions whose keys are currently held, e.g. ````["forward", "run"]````. */
    pressedActions: WalkModeAction[];
}

/**
 * Configuration for {@link WalkModePlugin}.
 */
export interface WalkModePluginConfig extends Partial<WalkModeSettings> {
    /** Optional ID for this plugin, unique among the plugins of the Viewer. Default "WalkMode". */
    id?: string;
    /** Key bindings, merged over the defaults per action. An empty array unbinds an action. */
    keys?: Partial<WalkModeKeys>;
    /** Modes to switch off, all enabled by default. Keys of a disabled mode are left to the page. */
    modes?: Partial<WalkModeModes>;
    /**
     * Returns the type of an object (e.g. "IfcDoor") when it can't be found in ````viewer.metaScene````,
     * e.g. for models with custom metadata. Doors and spaces are recognized by type.
     */
    objectType?: (entityId: string) => string | undefined;
}

/**
 * {@link Viewer} plugin for first-person walking through a model, with gravity, collisions and steps.
 *
 * Requires a Z-up World (````viewer.camera.worldAxis = [1, 0, 0, 0, 0, 1, 0, -1, 0]````).
 *
 * Default controls: mouse to look (pointer lock), WASD to move, Shift to run, Space to fly up,
 * G free flight (Space / Ctrl up / down), F go through the targeted door, Esc to exit.
 * Keys are configurable with ````cfg.keys````, modes can be switched off with ````cfg.modes````, and
 * speeds, body dimensions, physics and object types are set by the {@link WalkModeSettings} options.
 *
 * ````javascript
 * import {Viewer} from "@xeokit/xeokit-sdk";
 * import {WalkModePlugin} from "@xeokit/sdk-plugins";
 *
 * const viewer = new Viewer({canvasId: "myCanvas"});
 * const walkMode = new WalkModePlugin(viewer, {
 *     keys: {forward: ["KeyW", "ArrowUp"], fly: ["KeyV"]},
 *     modes: {jetpack: false},
 *     walkSpeed: 2,
 *     eyeHeight: 1.6
 * });
 *
 * walkMode.on("target", (target) => console.log(target)); // "door" or null
 * walkMode.on("active", (active) => console.log(active ? "walking" : "orbiting"));
 *
 * button.onclick = () => walkMode.activate(); // Pointer lock needs a user gesture
 * ````
 */
export class WalkModePlugin extends Plugin {

    /**
     * Effective key bindings; actions of disabled modes have no keys.
     */
    readonly keys: Readonly<Record<WalkModeAction, readonly string[]>>;

    private readonly settings: WalkModeSettings;
    private readonly modes: WalkModeModes;
    private readonly hiddenTypes: Set<string>;
    private readonly objectType: ((entityId: string) => string | undefined) | undefined;
    private readonly keyboard: Keyboard;
    private readonly walker: Walker;
    private readonly doors: Doors;
    private tickSubId: string | undefined;
    private listeners: AbortController | undefined;
    private hiddenEntityIds: string[] = [];
    private isActive = false;

    /**
     * @param viewer The Viewer.
     * @param cfg Plugin configuration.
     */
    constructor(viewer: Viewer, cfg: WalkModePluginConfig = {}) {
        super("WalkMode", viewer, cfg);

        this.settings = resolveSettings(cfg);
        this.modes = resolveModes(cfg.modes);
        this.hiddenTypes = new Set(this.settings.hiddenTypes.map((type) => type.toLowerCase()));
        this.objectType = cfg.objectType;

        this.keyboard = new Keyboard(this.modes, cfg.keys, (actions) => this.emit("pressedActions", actions));
        this.keys = this.keyboard.keys;

        this.walker = new Walker(viewer.scene, this.settings);
        this.doors = new Doors(
            viewer.scene,
            this.walker,
            this.settings,
            (entityId) => this.entityType(entityId),
            (targeted) => this.emit("target", targeted ? "door" : null),
        );
    }

    /**
     * Whether walk mode is active.
     */
    get active(): boolean {
        return this.isActive;
    }

    /**
     * Starts walking from the camera's current ````look```` position.
     *
     * Call it from a user gesture (e.g. a button click), so that the browser grants pointer lock.
     */
    activate(): void {
        if (this.isActive) return;
        this.isActive = true;

        const camera = this.viewer.camera;
        // ponytail: Z-up only; derive axes from camera.worldUp if Y-up models need walking
        if (camera.worldUp[2] !== 1) this.warn("walk mode expects a Z-up World (camera.worldAxis)");

        this.hideObstructingObjects();
        this.walker.start(camera.eye, camera.look);

        this.viewer.cameraControl.active = false;
        camera.up = [0, 0, 1];

        this.listeners = new AbortController();
        const signal = this.listeners.signal;

        this.getCanvas().addEventListener("mousedown", this.lockPointer, {signal});
        document.addEventListener("mousemove", this.handleMouseMove, {signal});
        window.addEventListener("keydown", this.handleKeyDown, {signal});
        window.addEventListener("keyup", (event) => this.keyboard.keyUp(event), {signal});
        window.addEventListener("blur", () => this.keyboard.releaseAll(), {signal});
        document.addEventListener("pointerlockchange", this.handlePointerLockChange, {signal});

        this.tickSubId = this.viewer.scene.on("tick", this.handleTick);

        this.syncCamera();
        this.lockPointer();

        this.emit("active", true);
    }

    /**
     * Stops walking and gives control back to the Viewer's CameraControl.
     */
    deactivate(): void {
        if (!this.isActive) return;
        this.isActive = false;

        this.listeners?.abort();
        this.listeners = undefined;
        this.keyboard.releaseAll();

        if (this.tickSubId !== undefined) {
            this.viewer.scene.off(this.tickSubId);
            this.tickSubId = undefined;
        }

        if (document.pointerLockElement) document.exitPointerLock();

        this.doors.clear();

        if (this.walker.flying) this.setFlying(false);

        this.viewer.scene.setObjectsVisible(this.hiddenEntityIds, true);
        this.hiddenEntityIds = [];

        this.viewer.cameraControl.active = true;

        this.emit("active", false);
    }

    /**
     * Subscribes to an event fired by this plugin.
     */
    override on<K extends keyof WalkModeEvents>(event: K, callback: (value: WalkModeEvents[K]) => void): string {
        return super.on(event, callback as () => void);
    }

    /**
     * Destroys this WalkModePlugin, deactivating walk mode first.
     */
    override destroy(): void {
        this.deactivate();
        super.destroy();
    }

    private emit<K extends keyof WalkModeEvents>(event: K, value: WalkModeEvents[K]): void {
        // Plugin.d.ts omits fire()'s third "forget" param; true = don't replay this event to later subscribers
        (super.fire as (event: string, value: unknown, forget: boolean) => void).call(this, event, value, true);
    }

    private entityType(entityId: string) {
        const metaObjects = this.viewer.metaScene.metaObjects;
        const entity = this.viewer.scene.objects[entityId];

        const type =
            this.objectType?.(entityId) ??
            metaObjects[entityId]?.type ??
            (entity ? metaObjects[String(entity.originalSystemId)]?.type : undefined);

        return typeof type === "string" ? type.toLowerCase() : "";
    }

    private hideObstructingObjects() {
        const objects = this.viewer.scene.objects;

        this.hiddenEntityIds = Object.keys(objects).filter(
            (entityId) => objects[entityId].visible && this.hiddenTypes.has(this.entityType(entityId)),
        );

        this.viewer.scene.setObjectsVisible(this.hiddenEntityIds, false);
    }

    private setFlying(active: boolean) {
        this.walker.flying = active;
        this.emit("flying", active);
    }

    private syncCamera() {
        const camera = this.viewer.camera;

        camera.eye = this.walker.eye;
        camera.look = this.walker.look;

        this.doors.invalidate();
    }

    private handleTick = (tickEvent: TickEvent) => {
        const seconds = Math.min(Number(tickEvent.deltaTime) / 1000, this.settings.maxFrameSeconds);
        const held = (action: WalkModeAction) => (this.keyboard.isHeld(action) ? 1 : 0);

        if (this.modes.doors) this.doors.scan(seconds);

        const moved = this.walker.step(seconds, {
            forward: held("forward") - held("backward"),
            strafe: held("right") - held("left"),
            lift: held("up") - held("down"),
            run: this.keyboard.isHeld("run"),
            jetpack: this.modes.jetpack && this.keyboard.isHeld("up"),
        });

        if (moved) this.syncCamera();
    };

    private handleMouseMove = (event: MouseEvent) => {
        if (document.pointerLockElement !== this.getCanvas()) return;

        this.walker.turn(event.movementX, event.movementY);
        this.syncCamera();
    };

    private handlePointerLockChange = () => {
        if (!this.isActive || document.pointerLockElement) return;

        this.deactivate();
    };

    private handleKeyDown = (event: KeyboardEvent) => {
        const action = this.keyboard.keyDown(event);

        if (action === "exit") this.deactivate();
        if (action === "fly") this.setFlying(!this.walker.flying);
        if (action === "door" && this.doors.enter()) this.syncCamera();
    };

    private lockPointer = () => {
        void Promise.resolve(this.getCanvas().requestPointerLock()).catch(() => {});
    };

    private getCanvas() {
        // Scene.d.ts types scene.canvas as a plain Component
        return (this.viewer.scene.canvas as unknown as { canvas: HTMLCanvasElement }).canvas;
    }
}
