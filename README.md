[![Tests](https://github.com/OMICRONEnergyOSS/oscd-background-plugin-config/actions/workflows/test.yml/badge.svg)](https://github.com/OMICRONEnergyOSS/oscd-background-plugin-config/actions/workflows/test.yml) ![NPM Version](https://img.shields.io/npm/v/@omicronenergy/oscd-background-plugin-config)

# \<oscd-background-plugin-config>

A background plugin to support oscd-configure-plugin events

## What is this?

A background plugin that listens for `oscd-configure-plugin` events and applies the requested add / change / remove to the `oscd-shell` it is nested under. Plugin configuration is also persisted to `localStorage['plugins']` (the same key and flat, `kind`-tagged shape used by `compas-open-scd`), and is merged back onto `shell.plugins` whenever this element connects, so plugin configuration survives a page reload.

The core logic is deliberately split out of the custom element:

- `src/plugin-configuration.ts` — pure, DOM-free add/change/remove logic for a `PluginSet`.
- `src/plugin-local-storage.ts` — pure, `Storage`-injectable read/write/merge logic for the `localStorage['plugins']` bridge.
- `src/oscd-background-plugin-config.ts` — the thin `HTMLElement` adapter that wires the two modules above to `oscd-shell` via DOM events.

Both `plugin-configuration.js` and `plugin-local-storage.js` are published as standalone entry points (see `exports` in `package.json`), so this package can be imported as a plain npm module by any host - not only as an OpenSCD background plugin - to get the same add/change/remove and localStorage-persistence semantics.

## Linting and formatting

To scan the project for linting and formatting errors, run

```bash
npm run lint
```

To automatically fix linting and formatting errors, run

```bash
npm run format
```

## Testing with Web Test Runner

Full unit test coverage of `plugin-configuration.ts`, `plugin-local-storage.ts`, and the `oscd-background-plugin-config` adapter lives in the co-located `*.spec.ts` files.

To execute a single test run:

```bash
npm run test
```

To run the tests in interactive watch mode run:

```bash
npm run test:watch
```

## Tooling configs

This package uses [`@omicronenergy/oscd-tooling`](https://www.npmjs.com/package/@omicronenergy/oscd-tooling) for linting, building, bundling, testing, and git hooks. The `oscd` CLI it provides resolves its own shared configs (ESLint, TypeScript, Rollup, Web Test Runner, Web Dev Server), so this repo only keeps the minimal config it actually overrides:

- `package.json` `scripts` call `oscd <command>` (see above) instead of invoking each tool directly.
- `tsconfig.json` and `eslint.config.js` are thin wrappers that extend `@omicronenergy/oscd-tooling`'s shared configs.
- `npm run prepare` (`oscd install-hooks`) installs Git hooks into `.githooks/` and points `core.hooksPath` at them.

If you need to diverge from the shared defaults for a specific tool, override just that piece in the relevant config file - see the `@omicronenergy/oscd-tooling` README for what's overridable.

## Local Demo with `web-dev-server`

```bash
npm run start
```

To run a local development server that serves the basic demo located in `demo/index.html`

&copy; 2026 OMICRON electronics GmbH

## License

[Apache-2.0](LICENSE)
