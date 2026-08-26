/**
 * Framework-agnostic plugin-configuration logic shared by the
 * `oscd-background-plugin-config` custom element and any other host (for
 * example a `compas-open-scd`-style Lit app) that wants the same add /
 * change / remove semantics for `oscd-configure-plugin` events without
 * depending on this package's `HTMLElement` wrapper.
 *
 * Nothing in this module touches the DOM or `customElements`, so it can be
 * imported as a plain npm module.
 *
 * Plugin entries are treated structurally: only `name` is read or written by
 * this module. Any other fields (`active`, `position`, `translations`, ...)
 * are carried through untouched on merge and are never stripped.
 */
const PLUGIN_KINDS = ['menu', 'editor', 'background'];
function isPluginKind(kind) {
    return PLUGIN_KINDS.includes(kind);
}
function findPluginIndex(plugins, name) {
    return plugins.findIndex(plugin => plugin.name === name);
}
function hasPlugin(plugins, name) {
    return findPluginIndex(plugins, name) >= 0;
}
/** Appends a new plugin entry. Does not check for an existing entry with the
 * same name — callers needing upsert semantics should use
 * {@link applyPluginConfiguration}. */
function addPlugin(plugins, plugin) {
    return [...plugins, plugin];
}
/** Removes the plugin named `name`, if present. Returns the original array
 * (same reference) when no matching entry exists. */
function removePlugin(plugins, name) {
    const index = findPluginIndex(plugins, name);
    if (index < 0) {
        return [...plugins];
    }
    const next = [...plugins];
    next.splice(index, 1);
    return next;
}
/** Merges `config` onto the existing entry named `config.name`, preserving
 * any fields the new config does not mention. Returns the original array
 * (same reference) when no matching entry exists. */
function changePlugin(plugins, config) {
    const index = findPluginIndex(plugins, config.name);
    if (index < 0) {
        return [...plugins];
    }
    const next = [...plugins];
    next[index] = { ...next[index], ...config };
    return next;
}
/**
 * Applies a single `oscd-configure-plugin` event detail to a `PluginSet`,
 * returning a new `PluginSet` (existing entries are never mutated in place).
 *
 * Decision table (mirrors `hasPlugin`/`hasConfig` from
 * `compas-open-scd`'s `handleConfigurationPluginEvent`):
 * - has plugin, has config   -\> change (merge)
 * - has plugin, no config    -\> remove
 * - no plugin, has config    -\> add
 * - no plugin, no config     -\> no-op, reported via `error`
 */
function applyPluginConfiguration(pluginSet, detail) {
    const { name, kind, config } = detail;
    if (!isPluginKind(kind)) {
        return {
            pluginSet,
            error: `Unsupported plugin kind "${kind}" for plugin "${name}"`,
        };
    }
    const current = pluginSet[kind] ?? [];
    const pluginExists = hasPlugin(current, name);
    const hasConfig = config !== null;
    if (pluginExists && hasConfig) {
        return {
            pluginSet: {
                ...pluginSet,
                [kind]: changePlugin(current, { ...config, name }),
            },
        };
    }
    if (pluginExists && !hasConfig) {
        return {
            pluginSet: { ...pluginSet, [kind]: removePlugin(current, name) },
        };
    }
    if (!pluginExists && hasConfig) {
        return {
            pluginSet: {
                ...pluginSet,
                [kind]: addPlugin(current, { ...config, name }),
            },
        };
    }
    return {
        pluginSet,
        error: `No "${kind}" plugin named "${name}" to remove`,
    };
}

/**
 * Framework-agnostic bridge between a `PluginSet` and the flat,
 * `kind`-tagged `localStorage['plugins']` array used by
 * `compas-open-scd`, so distributions sharing that storage key stay
 * interoperable. Nothing here touches the DOM beyond the injectable
 * `Storage` argument, so it can be imported as a plain npm module.
 */
const STORAGE_KEY = 'plugins';
function isStoredPlugin(value) {
    return (typeof value === 'object' &&
        value !== null &&
        typeof value.name === 'string' &&
        typeof value.kind === 'string');
}
/** Flattens a `PluginSet` into the flat `{ ...plugin, kind }[]` shape shared
 * with `compas-open-scd`. */
function flattenPluginSet(pluginSet) {
    return Object.keys(pluginSet).flatMap(kind => (pluginSet[kind] ?? []).map(plugin => ({ ...plugin, kind })));
}
/** Reads and parses `storage['plugins']`. Missing, malformed, or
 * individually malformed entries are dropped rather than thrown. */
function readStoredPlugins(storage = localStorage) {
    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isStoredPlugin) : [];
    }
    catch {
        return [];
    }
}
/** Persists `pluginSet` to `storage['plugins']` in the flat, `kind`-tagged
 * shape shared with `compas-open-scd`. */
function writeStoredPlugins(pluginSet, storage = localStorage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(flattenPluginSet(pluginSet)));
}
/**
 * Folds each stored entry onto `pluginSet`. Upsert-only: adds or updates
 * (merging, never stripping fields, per `applyPluginConfiguration`), but
 * never removes a `pluginSet` entry just because storage doesn't mention it
 * - matching `compas-open-scd`'s "built-ins always survive" merge
 * behaviour. Entries with an unrecognised `kind` are ignored.
 */
function mergeStoredPlugins(pluginSet, stored) {
    return stored.reduce((set, storedPlugin) => {
        const { kind, ...config } = storedPlugin;
        if (!isPluginKind(kind)) {
            return set;
        }
        const { pluginSet: next } = applyPluginConfiguration(set, {
            name: config.name,
            kind,
            config: config,
        });
        return next;
    }, pluginSet);
}

function isShellLike(item) {
    return item instanceof HTMLElement && item.localName === 'oscd-shell';
}
/** Walks up from `node` through parent nodes, hopping from a `ShadowRoot`
 * to its `host`, to find the enclosing `oscd-shell`. Needed at
 * `connectedCallback` time (no incoming event to inspect), unlike
 * {@link isShellLike}'s `event.composedPath()` use below. Real `oscd-shell`
 * renders background plugins inside its own shadow root, so this typically
 * resolves in a single hop. */
function findShell(node) {
    let current = node;
    while (current) {
        if (isShellLike(current)) {
            return current;
        }
        current = current instanceof ShadowRoot ? current.host : current.parentNode;
    }
    return null;
}
/** Assigns `pluginSet` to `shell.plugins` and persists it to
 * `localStorage['plugins']`, matching `compas-open-scd`'s "store on every
 * change" behaviour. */
function updateShellPlugins(shell, pluginSet) {
    shell.plugins = pluginSet;
    writeStoredPlugins(pluginSet);
}
/** Handles `oscd-configure-plugin` events for `oscd-shell`, delegating the
 * actual add/change/remove decision to the framework-agnostic
 * `./plugin-configuration.js` module. */
class OscdBackgroundPluginConfig extends HTMLElement {
    constructor() {
        super(...arguments);
        this.handleConfigurePlugin = (event) => {
            // Background plugins are siblings of the plugin that emits the event, so
            // listening on this element would never receive that sibling's event.
            const shell = event.composedPath().find(isShellLike);
            if (!shell) {
                return;
            }
            const { detail } = event;
            const { pluginSet, error } = applyPluginConfiguration(shell.plugins, detail);
            if (error) {
                console.warn(`oscd-background-plugin-config: ${error}`);
            }
            updateShellPlugins(shell, pluginSet);
        };
    }
    connectedCallback() {
        document.addEventListener('oscd-configure-plugin', this.handleConfigurePlugin);
        const shell = findShell(this);
        const stored = readStoredPlugins();
        if (!shell || stored.length === 0) {
            return;
        }
        const merged = mergeStoredPlugins(shell.plugins, stored);
        if (JSON.stringify(merged) !== JSON.stringify(shell.plugins)) {
            updateShellPlugins(shell, merged);
        }
    }
    disconnectedCallback() {
        document.removeEventListener('oscd-configure-plugin', this.handleConfigurePlugin);
    }
}

export { OscdBackgroundPluginConfig as default };
//# sourceMappingURL=oscd-background-plugin-config-DJOX6bnY.js.map
