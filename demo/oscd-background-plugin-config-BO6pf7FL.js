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
/** A new, empty `PluginSet` with every kind present as an empty array. */
function emptyPluginSet() {
    return { menu: [], editor: [], background: [] };
}
function withoutPlugins(pluginSet, removed) {
    return PLUGIN_KINDS.reduce((result, kind) => ({
        ...result,
        [kind]: (pluginSet[kind] ?? []).filter(plugin => !(removed[kind] ?? []).some(removedPlugin => removedPlugin.name === plugin.name)),
    }), emptyPluginSet());
}
/** Whether `plugin` carries its own identity - a `src` to import from, or an
 * already-registered `tagName`. Entries with neither are partial and only
 * make sense layered onto an entry that has one. */
function isFullDefinition(plugin) {
    return typeof plugin.src === 'string' || typeof plugin.tagName === 'string';
}
/** Layers owned entries onto the current shell set, matching by name. */
function composePluginSets(base, overlay) {
    return PLUGIN_KINDS.reduce((composed, kind) => {
        const baseEntries = base[kind] ?? [];
        const overlayEntries = overlay[kind] ?? [];
        const layered = baseEntries.map((baseEntry) => {
            const override = overlayEntries.find(entry => entry.name === baseEntry.name);
            if (!override) {
                return baseEntry;
            }
            return isFullDefinition(override)
                ? override
                : { ...baseEntry, ...override };
        });
        return {
            ...composed,
            [kind]: [
                ...layered,
                ...overlayEntries.filter(entry => !hasPlugin(baseEntries, entry.name)),
            ],
        };
    }, emptyPluginSet());
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
/** Rebuilds the `PluginSet` we own from its stored, flat representation.
 * Entries with an unrecognised `kind` are ignored. */
function pluginSetFromStored(stored) {
    return stored.reduce((set, storedPlugin) => {
        const { kind, ...config } = storedPlugin;
        if (!isPluginKind(kind)) {
            return set;
        }
        const { pluginSet } = applyPluginConfiguration(set, {
            name: config.name,
            kind,
            config: config,
        });
        return pluginSet;
    }, emptyPluginSet());
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
/** The plugins configured through events; only these are persisted. */
const ownedPluginSets = new WeakMap();
/** `kind` belongs to the set, not to an entry. */
function sanitizeDetail(detail) {
    const { config } = detail;
    if (config === null || !('kind' in config)) {
        return detail;
    }
    const { kind: _bucketKey, ...rest } = config;
    return { ...detail, config: rest };
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
            const owned = ownedPluginSets.get(shell) ?? emptyPluginSet();
            const { pluginSet: nextOwned, error } = applyPluginConfiguration(owned, sanitizeDetail(detail));
            if (error) {
                console.warn(`oscd-background-plugin-config: ${error}`);
                return;
            }
            ownedPluginSets.set(shell, nextOwned);
            shell.plugins = composePluginSets(withoutPlugins(shell.plugins, owned), nextOwned);
            writeStoredPlugins(nextOwned);
        };
    }
    connectedCallback() {
        document.addEventListener('oscd-configure-plugin', this.handleConfigurePlugin);
        const shell = findShell(this);
        if (!shell) {
            return;
        }
        const owned = pluginSetFromStored(readStoredPlugins());
        ownedPluginSets.set(shell, owned);
        const composed = composePluginSets(shell.plugins, owned);
        if (JSON.stringify(composed) !== JSON.stringify(shell.plugins)) {
            shell.plugins = composed;
        }
    }
    disconnectedCallback() {
        document.removeEventListener('oscd-configure-plugin', this.handleConfigurePlugin);
    }
}

export { OscdBackgroundPluginConfig as default };
//# sourceMappingURL=oscd-background-plugin-config-BO6pf7FL.js.map
