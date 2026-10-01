/**
 * Tunable values of {@link WalkModePlugin}, each settable through the plugin config.
 * Lengths are in meters, speeds in m/s, times in seconds, angles in radians.
 */
export interface WalkModeSettings {
    /** Height of the walker; walls are detected at half of it. Default 1.8. */
    bodyHeight: number;
    /** Distance kept from walls. Default 0.3. */
    bodyRadius: number;
    /** Camera height above the floor. Default 1.7. */
    eyeHeight: number;
    /** Highest step that is walked up. Default 0.6. */
    stepHeight: number;
    /** Default 1.6. */
    walkSpeed: number;
    /** Speed while holding the "run" key. Default 4.5. */
    runSpeed: number;
    /** Default 5. */
    flySpeed: number;
    /** Flight speed while holding the "run" key. Default 14. */
    flyFastSpeed: number;
    /** Downward acceleration in m/s². Default 9.81. */
    gravity: number;
    /** Upward acceleration of the jetpack in m/s². Default 18. */
    jetpackAcceleration: number;
    /** Highest rising speed of the jetpack. Default 4. */
    jetpackMaxSpeed: number;
    /** Rotation per pixel of mouse movement. Default 0.0025. */
    lookSensitivity: number;
    /** How far up / down one can look. Default π/2 - 0.05. */
    maxPitch: number;
    /** Mouse movement per event above this many pixels is clamped, filtering pointer lock spikes. Default 100. */
    maxLookDelta: number;
    /** Longer frames are simulated as this long, so that a stall can't move the walker through walls. Default 0.1. */
    maxFrameSeconds: number;
    /** Farthest distance at which a door can be targeted. Default 2.5. */
    doorReach: number;
    /** How often the crosshair target is re-checked while the view changes. Default 0.15. */
    doorScanInterval: number;
    /** Distance behind a door at which one lands after going through it. Default 0.6. */
    doorPassMargin: number;
    /** Object types that are doors, case-insensitive. Default ````["IfcDoor", "Doors"]```` (IFC, Revit). */
    doorTypes: string[];
    /**
     * Object types hidden while walking, since they would block movement, case-insensitive.
     * Default ````["IfcSpace", "IfcOpeningElement", "IfcAnnotation", "Rooms"]```` (IFC, Revit).
     */
    hiddenTypes: string[];
}

/**
 * Modes that can be switched off.
 */
export interface WalkModeModes {
    /** Run while holding the "run" key. */
    run: boolean;
    /** Rise while holding the "up" key when walking. */
    jetpack: boolean;
    /** Free flight, toggled with the "fly" key; "up" / "down" rise and sink. */
    fly: boolean;
    /** Highlight the door in front and go through it with the "door" key. */
    doors: boolean;
}

const DEFAULT_SETTINGS: WalkModeSettings = {
    bodyHeight: 1.8,
    bodyRadius: 0.3,
    eyeHeight: 1.7,
    stepHeight: 0.6,
    walkSpeed: 1.6,
    runSpeed: 4.5,
    flySpeed: 5,
    flyFastSpeed: 14,
    gravity: 9.81,
    jetpackAcceleration: 18,
    jetpackMaxSpeed: 4,
    lookSensitivity: 0.0025,
    maxPitch: Math.PI / 2 - 0.05,
    maxLookDelta: 100,
    maxFrameSeconds: 0.1,
    doorReach: 2.5,
    doorScanInterval: 0.15,
    doorPassMargin: 0.6,
    doorTypes: ["IfcDoor", "Doors"],
    hiddenTypes: ["IfcSpace", "IfcOpeningElement", "IfcAnnotation", "Rooms"],
};

/**
 * Settings from the plugin config, with defaults for the missing or undefined ones.
 */
export function resolveSettings(cfg: Partial<WalkModeSettings>): WalkModeSettings {
    const settings = {...DEFAULT_SETTINGS};
    for (const key in DEFAULT_SETTINGS) {
        const value = cfg[key as keyof WalkModeSettings];
        if (value !== undefined) Object.assign(settings, {[key]: value});
    }
    return settings;
}

/**
 * Modes from the plugin config, all enabled unless switched off.
 */
export function resolveModes(modes: Partial<WalkModeModes> = {}): WalkModeModes {
    return {run: true, jetpack: true, fly: true, doors: true, ...modes};
}
