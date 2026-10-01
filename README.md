# xeokit-sdk-plugins

Plugins for [xeokit-sdk](https://github.com/xeokit/xeokit-sdk). Each plugin is a separate npm package
in `packages/` and is installed on its own, next to the SDK:

```bash
npm install @xeokit/xeokit-sdk @xeokit-sdk-plugins/walk-mode
```

| Package | Description |
|---------|-------------|
| [`@xeokit-sdk-plugins/walk-mode`](packages/walk-mode) | First-person walking with gravity, collisions, doors and free flight |

## Development

```bash
npm install
npm run build      # compiles every package: src/index.ts -> dist/
```

## Adding a plugin

Naming convention:

| What | Convention | Example |
|------|------------|---------|
| npm package | `@xeokit-sdk-plugins/<name>` | `@xeokit-sdk-plugins/walk-mode` |
| folder | `packages/<name>` (kebab-case, no `-plugin` suffix) | `packages/walk-mode` |
| entry point | `src/index.ts` | `packages/walk-mode/src/index.ts` |

1. Copy `package.json`, `tsconfig.json` and `README.md` of `packages/walk-mode` to `packages/<name>` and rename the
   package; export the plugin from `src/index.ts`.
2. Keep `@xeokit/xeokit-sdk` as a **peer** dependency, never a regular one, so the plugin uses the same SDK
   instance as the application (plugins must extend the app's `Plugin` class).
3. Import everything from `"@xeokit/xeokit-sdk"`, extend `Plugin`, unsubscribe from viewer events in `destroy()`.
4. Add a usage example to [`../examples`](../examples).

## Publishing

Each package is versioned and published independently (`prepack` builds it):

```bash
npm version patch -w packages/walk-mode
npm publish -w packages/walk-mode --access public
```
