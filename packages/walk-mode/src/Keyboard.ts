import type {WalkModeModes} from "./settings.js";

/**
 * Actions that can be bound to keys.
 */
export type WalkModeAction = "forward" | "backward" | "left" | "right" | "run" | "up" | "down" | "door" | "fly" | "exit";

/**
 * Key bindings: ````KeyboardEvent.code```` values per action, e.g. ````["KeyW", "ArrowUp"]````.
 * Codes name physical keys, so bindings don't depend on the keyboard layout.
 */
export type WalkModeKeys = Record<WalkModeAction, string[]>;

const DEFAULT_KEYS: WalkModeKeys = {
    forward: ["KeyW"],
    backward: ["KeyS"],
    left: ["KeyA"],
    right: ["KeyD"],
    run: ["ShiftLeft", "ShiftRight"],
    up: ["Space"],
    down: ["ControlLeft", "ControlRight"],
    door: ["KeyF"],
    fly: ["KeyG"],
    exit: ["Escape"],
};

// Handled while Ctrl is held too (Ctrl is "down" in flight); other actions leave Ctrl shortcuts to the browser
const MOVE_ACTIONS = new Set<WalkModeAction>(["forward", "backward", "left", "right", "run", "up", "down"]);

function isTypingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    return (
        target.isContentEditable ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
    );
}

/**
 * Maps keys to the actions of the enabled modes and tracks which actions are held.
 */
export class Keyboard {

    /**
     * Effective key bindings; actions of disabled modes have no keys.
     */
    readonly keys: Readonly<Record<WalkModeAction, readonly string[]>>;

    private readonly actionByCode = new Map<string, WalkModeAction>();
    private readonly pressedKeys = new Set<string>();

    /**
     * @param modes Enabled modes; the keys of the others are left to the page.
     * @param keys Key bindings, merged over the defaults per action.
     * @param onPressedActions Called when the set of held actions changes.
     */
    constructor(
        modes: WalkModeModes,
        keys: Partial<WalkModeKeys> = {},
        private readonly onPressedActions: (actions: WalkModeAction[]) => void,
    ) {
        const enabled: Record<WalkModeAction, boolean> = {
            forward: true,
            backward: true,
            left: true,
            right: true,
            exit: true,
            run: modes.run,
            up: modes.jetpack || modes.fly,
            down: modes.fly,
            door: modes.doors,
            fly: modes.fly,
        };

        const resolved = {} as WalkModeKeys;
        for (const action of Object.keys(DEFAULT_KEYS) as WalkModeAction[]) {
            resolved[action] = enabled[action] ? [...(keys[action] ?? DEFAULT_KEYS[action])] : [];
            for (const code of resolved[action]) this.actionByCode.set(code, action);
        }
        this.keys = resolved;
    }

    /**
     * Whether a key of the action is held.
     */
    isHeld(action: WalkModeAction): boolean {
        return this.keys[action].some((code) => this.pressedKeys.has(code));
    }

    /**
     * Handles a keydown event, returning the action it triggers; undefined for other keys and key repeats.
     */
    keyDown(event: KeyboardEvent): WalkModeAction | undefined {
        if (event.metaKey || event.altKey || isTypingTarget(event.target)) return undefined;

        const action = this.actionByCode.get(event.code);
        if (!action || (event.ctrlKey && !MOVE_ACTIONS.has(action))) return undefined;

        if (action === "exit") return action;

        event.preventDefault();

        if (!this.pressedKeys.has(event.code)) {
            this.pressedKeys.add(event.code);
            this.emitPressedActions();
        }

        return event.repeat ? undefined : action;
    }

    /**
     * Handles a keyup event.
     */
    keyUp(event: KeyboardEvent): void {
        if (this.pressedKeys.delete(event.code)) this.emitPressedActions();
    }

    /**
     * Releases all keys, e.g. when the window loses focus.
     */
    releaseAll(): void {
        if (!this.pressedKeys.size) return;

        this.pressedKeys.clear();
        this.emitPressedActions();
    }

    private emitPressedActions() {
        const actions = new Set<WalkModeAction>();

        for (const code of this.pressedKeys) {
            const action = this.actionByCode.get(code);
            if (action) actions.add(action);
        }

        this.onPressedActions([...actions]);
    }
}
