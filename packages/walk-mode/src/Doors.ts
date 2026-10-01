import type {Scene} from "@xeokit/xeokit-sdk";
import type {WalkModeSettings} from "./settings.js";
import type {Walker} from "./Walker.js";

/**
 * Targets and highlights the door the {@link Walker} looks at, and takes the walker through it.
 */
export class Doors {

    private readonly types: Set<string>;
    private targetId: string | undefined;
    private scanDue = 0;
    private viewChanged = true;

    /**
     * @param typeOf Returns the lower-cased type of an object.
     * @param onTarget Called when a door becomes or stops being the target.
     */
    constructor(
        private readonly scene: Scene,
        private readonly walker: Walker,
        private readonly settings: WalkModeSettings,
        private readonly typeOf: (entityId: string) => string,
        private readonly onTarget: (targeted: boolean) => void,
    ) {
        this.types = new Set(settings.doorTypes.map((type) => type.toLowerCase()));
    }

    /**
     * Requests a new scan; call it whenever the view changes.
     */
    invalidate(): void {
        this.viewChanged = true;
    }

    /**
     * Targets the door within reach in front of the walker. Re-checks at most every ````doorScanInterval````,
     * and only after the view changed.
     */
    scan(seconds: number): void {
        if (!this.viewChanged) return;

        this.scanDue -= seconds;
        if (this.scanDue > 0) return;

        this.scanDue = this.settings.doorScanInterval;
        this.viewChanged = false;

        const eye = this.walker.eye;
        const look = this.walker.look;
        const hit = this.scene.pick({
            origin: eye,
            direction: [look[0] - eye[0], look[1] - eye[1], look[2] - eye[2]],
            pickSurface: true,
        });

        const entityId = hit?.entity ? String(hit.entity.id) : undefined;
        const distance = hit?.worldPos
            ? Math.hypot(hit.worldPos[0] - eye[0], hit.worldPos[1] - eye[1], hit.worldPos[2] - eye[2])
            : Infinity;

        const isDoor =
            !!entityId &&
            distance <= this.settings.doorReach &&
            !this.walker.flying &&
            this.isDoor(entityId);

        this.setTarget(isDoor ? entityId : undefined);
    }

    /**
     * Takes the walker through the targeted door, in the direction it faces. Returns false without a target.
     */
    enter(): boolean {
        if (this.walker.flying) return false;

        const entityId = this.targetId;
        const door = entityId && this.scene.objects[entityId];
        if (!entityId || !door || !this.isDoor(entityId)) return false;

        const doorOffset = door.offset ?? [0, 0, 0];
        const aabb = [...door.aabb].map((value, index) => value + doorOffset[index % 3]);
        const dirX = Math.cos(this.walker.yaw);
        const dirY = Math.sin(this.walker.yaw);
        const reach =
            (Math.abs(dirX) * (aabb[3] - aabb[0]) + Math.abs(dirY) * (aabb[4] - aabb[1])) / 2 +
            this.settings.bodyRadius +
            this.settings.doorPassMargin;

        this.walker.place(
            (aabb[0] + aabb[3]) / 2 + dirX * reach,
            (aabb[1] + aabb[4]) / 2 + dirY * reach,
            aabb[2],
        );

        this.setTarget(undefined);
        return true;
    }

    /**
     * Drops the target and its highlight.
     */
    clear(): void {
        this.setTarget(undefined);
    }

    private isDoor(entityId: string) {
        return this.types.has(this.typeOf(entityId));
    }

    private setTarget(entityId: string | undefined) {
        if (entityId === this.targetId) return;

        const previous = this.targetId && this.scene.objects[this.targetId];
        if (previous) previous.highlighted = false;

        const next = entityId && this.scene.objects[entityId];
        if (next) next.highlighted = true;

        this.targetId = entityId;
        this.onTarget(!!entityId);
    }
}
