# xeokit-sdk-plugins

Plugins for [xeokit-sdk](https://github.com/xeokit/xeokit-sdk), published together as one npm package installed next
to the SDK:

```bash
npm install @xeokit/xeokit-sdk @xeokit/sdk-plugins
```

```javascript
import {WalkModePlugin} from "@xeokit/sdk-plugins";
```

The package has no side effects, so bundlers drop the plugins an application doesn't import.

| Plugin | Description |
|--------|-------------|
| [`WalkModePlugin`](packages/walk-mode) | First-person walking with gravity, collisions, doors and free flight |

## Development

```bash
npm install
npm run build      # builds every package in packages/, then registry.ts -> dist/
```

## Adding a plugin

Each plugin is a private workspace package in `packages/`. It is never published on its own: the root package
lists it in `bundleDependencies`, so `npm pack` puts the built plugin inside the `@xeokit/sdk-plugins` tarball and
[`registry.ts`](registry.ts) re-exports it by package name.

Naming convention:

| What | Convention | Example |
|------|------------|---------|
| package | `@xeokit/sdk-plugins-<name>` | `@xeokit/sdk-plugins-walk-mode` |
| folder | `packages/<name>` (kebab-case, no `-plugin` suffix) | `packages/walk-mode` |
| entry point | `src/index.ts` | `packages/walk-mode/src/index.ts` |

1. Copy `package.json`, `tsconfig.json` and `README.md` of `packages/walk-mode` to `packages/<name>` and rename the
   package; export the plugin from `src/index.ts`.
2. Register it in the root package: add it to `dependencies` (`"*"`) **and** `bundleDependencies` in
   `package.json`, run `npm install`, add `export * from "@xeokit/sdk-plugins-<name>";` to `registry.ts` and
   add it to the table above. Exported names must be unique across plugins (`tsc` fails on a clash), so prefix
   them with the plugin name.
3. Keep `@xeokit/xeokit-sdk` as a **peer** dependency, never a regular one, so the plugin uses the same SDK
   instance as the application (plugins must extend the app's `Plugin` class). Keep modules free of top-level
   side effects (`"sideEffects": false`).
4. Import everything from `"@xeokit/xeokit-sdk"`, extend `Plugin`, unsubscribe from viewer events in `destroy()`.
5. Add a usage example to [`../examples`](../examples).

## Publishing

`prepack` builds every plugin and bundles them into the package:

```bash
npm version patch
npm publish --access public
```
