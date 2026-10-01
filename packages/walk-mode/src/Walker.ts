import type {Scene} from "@xeokit/xeokit-sdk";
import type {WalkModeSettings} from "./settings.js";

/**
 * Input for one frame; ````forward````, ````strafe```` and ````lift```` are -1, 0 or 1.
 */
export interface WalkerInput {
    forward: number;
    strafe: number;
    /** Rise / sink in flight. */
    lift: number;
    run: boolean;
    /** Rise while walking. */
    jetpack: boolean;
}

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/**
 * A body moving through a Z-up scene: walks with gravity, climbs steps, stops at walls, or flies freely.
 * Walls and floors are found by ray casts into the scene.
 */
export class Walker {

    /**
     * Position of the feet.
     */
    readonly position = [0, 0, 0];

    /**
     * Heading, counter-clockwise from +X.
     */
    yaw = 0;

    /**
     * Looking up (positive) or down (negative).
     */
    pitch = 0;

    private groundLevel = 0;
    private verticalSpeed = 0;
    private grounded = false;
    private isFlying = false;

    constructor(private readonly scene: Scene, private readonly settings: WalkModeSettings) {
    }

    /**
     * Whether gravity and walls are ignored.
     */
    get flying(): boolean {
        return this.isFlying;
    }

    set flying(active: boolean) {
        this.isFlying = active;
        this.verticalSpeed = 0;
        this.grounded = false;
    }

    /**
     * Eye position, ````eyeHeight```` above the feet.
     */
    get eye(): number[] {
        return [this.position[0], this.position[1], this.position[2] + this.settings.eyeHeight];
    }

    /**
     * A point one meter in front of the eye.
     */
    get look(): number[] {
        const eye = this.eye;
        const cosPitch = Math.cos(this.pitch);

        return [
            eye[0] + cosPitch * Math.cos(this.yaw),
            eye[1] + cosPitch * Math.sin(this.yaw),
            eye[2] + Math.sin(this.pitch),
        ];
    }

    /**
     * Starts at the look point of a camera, facing away from its eye. The lowest visible point becomes the ground.
     */
    start(eye: number[], look: number[]): void {
        const aabb = this.scene.getAABB(this.scene.visibleObjectIds);
        this.groundLevel = Number.isFinite(aabb?.[2]) ? aabb[2] : 0;

        this.yaw = Math.atan2(look[1] - eye[1], look[0] - eye[0]);
        this.pitch = 0;
        this.place(look[0], look[1], look[2]);
    }

    /**
     * Puts the feet at a point, not below the ground, and lets the walker fall from there.
     */
    place(x: number, y: number, z: number): void {
        this.position[0] = x;
        this.position[1] = y;
        this.position[2] = Math.max(this.groundLevel, z);
        this.verticalSpeed = 0;
        this.grounded = false;
    }

    /**
     * Turns the view by a mouse movement in pixels.
     */
    turn(movementX: number, movementY: number): void {
        const {maxLookDelta, lookSensitivity, maxPitch} = this.settings;

        this.yaw -= clamp(movementX, maxLookDelta) * lookSensitivity;
        this.pitch = clamp(this.pitch - clamp(movementY, maxLookDelta) * lookSensitivity, maxPitch);
    }

    /**
     * Moves by one frame of input, returning false when the walker stood still.
     */
    step(seconds: number, input: WalkerInput): boolean {
        return this.isFlying ? this.flyStep(seconds, input) : this.walkStep(seconds, input);
    }

    private walkStep(seconds: number, {forward, strafe, run, jetpack}: WalkerInput) {
        const resting = this.grounded && this.verticalSpeed === 0;

        if (!forward && !strafe && !jetpack && resting) return false;

        if (forward || strafe) {
            const speed = run ? this.settings.runSpeed : this.settings.walkSpeed;
            const step = (speed * seconds) / Math.hypot(forward, strafe);
            const sin = Math.sin(this.yaw);
            const cos = Math.cos(this.yaw);

            this.moveAxis(0, (cos * forward + sin * strafe) * step);
            this.moveAxis(1, (sin * forward - cos * strafe) * step);
        }

        if (jetpack) {
            this.verticalSpeed = Math.min(
                this.verticalSpeed + this.settings.jetpackAcceleration * seconds,
                this.settings.jetpackMaxSpeed,
            );
        }

        this.applyGravity(seconds);
        return true;
    }

    private flyStep(seconds: number, {forward, strafe, lift, run}: WalkerInput) {
        if (!forward && !strafe && !lift) return false;

        const speed = run ? this.settings.flyFastSpeed : this.settings.flySpeed;

        if (forward || strafe) {
            const step = (speed * seconds) / Math.hypot(forward, strafe);
            const sin = Math.sin(this.yaw);
            const cos = Math.cos(this.yaw);
            const cosPitch = Math.cos(this.pitch);

            this.position[0] += (cos * forward * cosPitch + sin * strafe) * step;
            this.position[1] += (sin * forward * cosPitch - cos * strafe) * step;
            this.position[2] += Math.sin(this.pitch) * forward * step;
        }

        this.position[2] += lift * speed * seconds;
        return true;
    }

    private applyGravity(seconds: number) {
        this.verticalSpeed -= this.settings.gravity * seconds;

        const floorLevel = this.castDown(this.position[2] + this.settings.stepHeight);
        const ground = Math.max(this.groundLevel, floorLevel ?? this.groundLevel);
        const nextZ = this.position[2] + this.verticalSpeed * seconds;

        if (nextZ <= ground) {
            this.position[2] = ground;
            this.verticalSpeed = 0;
            this.grounded = true;
        } else {
            this.position[2] = nextZ;
            this.grounded = false;
        }
    }

    private moveAxis(axis: 0 | 1, distance: number) {
        const reach = this.settings.bodyRadius + Math.abs(distance);
        const direction = [0, 0, 0];
        direction[axis] = Math.sign(distance);

        const hit = this.castRay(
            [this.position[0], this.position[1], this.position[2] + this.settings.bodyHeight / 2],
            direction,
        );

        if (hit && Math.abs(hit[axis] - this.position[axis]) <= reach) return;

        this.position[axis] += distance;
    }

    private castRay(origin: number[], direction: number[]) {
        return this.scene.pick({
            origin,
            direction,
            pickSurface: true,
            pickSurfaceNormal: false,
        })?.worldPos;
    }

    private castDown(fromZ: number) {
        return this.castRay([this.position[0], this.position[1], fromZ], [0, 0, -1])?.[2];
    }
}
