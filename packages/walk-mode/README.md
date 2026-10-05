# WalkModePlugin

[xeokit-sdk](https://github.com/xeokit/xeokit-sdk) plugin for first-person walking through a model: gravity, collisions,
climbing steps, going through doors and free flight.

```bash
npm install @xeokit/xeokit-sdk @xeokit/sdk-plugins
```

```javascript
import {Viewer} from "@xeokit/xeokit-sdk";
import {WalkModePlugin} from "@xeokit/sdk-plugins";

const viewer = new Viewer({canvasId: "myCanvas"});
viewer.camera.worldAxis = [1, 0, 0, 0, 0, 1, 0, -1, 0]; // Z-up World is required

const walkMode = new WalkModePlugin(viewer, {
    keys: {forward: ["KeyW", "ArrowUp"], fly: ["KeyV"]},   // Optional, merged over the defaults
    modes: {jetpack: false},                               // Optional, all modes enabled by default
    walkSpeed: 2,                                          // Optional settings, see below
    eyeHeight: 1.6
});

walkMode.on("target", (target) => showPrompt(target));             // "door" -> "Press F to enter"
walkMode.on("active", (active) => walkButton.hidden = active);      // Also false after Esc

walkButton.onclick = () => walkMode.activate(); // Pointer lock needs a user gesture
```

Walking starts at the camera's `look` position. The plugin draws no UI; build the crosshair, prompts and key legend
from its events (see the example).

## Controls

| Action | Default keys | Does |
|--------|--------------|------|
| — | Mouse | Look around (pointer lock, click the canvas to re-lock) |
| `forward` `backward` `left` `right` | W S A D | Move |
| `run` | Shift | Run (mode `run`) |
| `up` | Space | Jetpack while walking (mode `jetpack`); rise in free flight |
| `down` | Ctrl | Sink in free flight |
| `door` | F | Go through the targeted door (mode `doors`) |
| `fly` | G | Toggle free flight (mode `fly`) |
| `exit` | Esc | Exit walk mode |

Keys are [`KeyboardEvent.code`](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) values
(`"KeyW"`, `"ArrowUp"`, `"ShiftLeft"`, ...), so they name physical keys regardless of the keyboard layout.
`cfg.keys` replaces the keys of the listed actions; an empty array unbinds an action.

Modes `run`, `jetpack`, `fly` and `doors` can be switched off with `cfg.modes`. The keys of a disabled mode are not
captured, so the page keeps them. Esc always releases pointer lock, which also exits walk mode.

Objects of the `hiddenTypes` (`IfcSpace`, `IfcOpeningElement`, ...) are hidden while walking, objects of the
`doorTypes` (`IfcDoor`, ...) can be walked through. Types are read from `viewer.metaScene`.

## Settings

Passed in the config next to `keys` and `modes`, typed as `WalkModeSettings`. Lengths in meters, speeds in m/s,
times in seconds, angles in radians.

| Setting | Default | Description |
|---------|---------|-------------|
| `bodyHeight` | `1.8` | Height of the walker; walls are detected at half of it |
| `bodyRadius` | `0.3` | Distance kept from walls |
| `eyeHeight` | `1.7` | Camera height above the floor |
| `stepHeight` | `0.6` | Highest step that is walked up |
| `walkSpeed` | `1.6` | |
| `runSpeed` | `4.5` | Speed while holding `run` |
| `flySpeed` | `5` | |
| `flyFastSpeed` | `14` | Flight speed while holding `run` |
| `gravity` | `9.81` | m/s² |
| `jetpackAcceleration` | `18` | m/s² |
| `jetpackMaxSpeed` | `4` | Highest rising speed of the jetpack |
| `lookSensitivity` | `0.0025` | Rotation per pixel of mouse movement |
| `maxPitch` | `π/2 - 0.05` | How far up / down one can look |
| `maxLookDelta` | `100` | Mouse movement per event above this many pixels is clamped (pointer lock spikes) |
| `maxFrameSeconds` | `0.1` | Longer frames are simulated as this long, so a stall can't move the walker through walls |
| `doorReach` | `2.5` | Farthest distance at which a door can be targeted |
| `doorScanInterval` | `0.15` | How often the crosshair target is re-checked while the view changes |
| `doorPassMargin` | `0.6` | Distance behind a door at which one lands after going through |
| `doorTypes` | `["IfcDoor", "Doors"]` | Object types that are doors (IFC, Revit), case-insensitive |
| `hiddenTypes` | `["IfcSpace", "IfcOpeningElement", "IfcAnnotation", "Rooms"]` | Object types hidden while walking, case-insensitive |

## API

`new WalkModePlugin(viewer, [cfg])`

| Option | Default | Description |
|--------|---------|-------------|
| `cfg.id` | `"WalkMode"` | Plugin ID, unique among the viewer's plugins |
| `cfg.keys` | see [Controls](#controls) | `{[action]: codes[]}`, merged over the defaults per action |
| `cfg.modes` | all `true` | `{run, jetpack, fly, doors}` — `false` switches a mode off |
| `cfg.<setting>` | see [Settings](#settings) | Any `WalkModeSettings` value |
| `cfg.objectType` | — | `(entityId) => type` for models whose types are not in `viewer.metaScene` (e.g. custom metadata) |

| Member | Description |
|--------|-------------|
| `activate()` | Start walking (call from a user gesture) |
| `deactivate()` | Stop walking, give control back to `viewer.cameraControl` |
| `active` | Whether walk mode is active |
| `keys` | Effective key bindings per action (empty for disabled modes) — for rendering a key legend |
| `destroy()` | Deactivate and remove the plugin |

Events (subscribe with `plugin.on(event, callback)`, typed in `WalkModeEvents`):

| Event | Payload |
|-------|---------|
| `active` | `boolean` |
| `target` | `"door" \| null` — what the crosshair aims at |
| `flying` | `boolean` — free flight toggled |
| `pressedActions` | actions whose keys are held, e.g. `["forward", "run"]` — for highlighting a key legend |

Example: [`examples/walk-mode`](../../../examples/walk-mode).
