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

export type PluginKind = 'menu' | 'editor' | 'background';

/** The minimal shape this module understands. Extra host-owned fields are
 * preserved but never inspected. */
export interface PluginLike {
  name: string;
  [key: string]: unknown;
}

/** A flat, per-kind collection of plugin entries. Plugin groups are not
 * supported: each kind is a plain array of entries. */
export type PluginSet<P extends PluginLike = PluginLike> = Record<
  PluginKind,
  P[]
>;

export interface ConfigurePluginDetail<P extends PluginLike = PluginLike> {
  name: string;
  kind: PluginKind;
  /** The new (partial) plugin config, or `null` to remove the plugin. */
  config: (Partial<P> & { name?: string }) | null;
}

export interface ApplyPluginConfigurationResult<
  P extends PluginLike = PluginLike,
> {
  pluginSet: PluginSet<P>;
  /** Set when the requested configuration could not be applied, for example
   * an unsupported `kind`, or removing/changing a plugin that isn't
   * currently configured. `pluginSet` is returned unchanged in that case. */
  error?: string;
}

const PLUGIN_KINDS: readonly PluginKind[] = ['menu', 'editor', 'background'];

export function isPluginKind(kind: string): kind is PluginKind {
  return (PLUGIN_KINDS as readonly string[]).includes(kind);
}

export function findPluginIndex<P extends PluginLike>(
  plugins: readonly P[],
  name: string,
): number {
  return plugins.findIndex(plugin => plugin.name === name);
}

export function hasPlugin<P extends PluginLike>(
  plugins: readonly P[],
  name: string,
): boolean {
  return findPluginIndex(plugins, name) >= 0;
}

/** Appends a new plugin entry. Does not check for an existing entry with the
 * same name — callers needing upsert semantics should use
 * {@link applyPluginConfiguration}. */
export function addPlugin<P extends PluginLike>(
  plugins: readonly P[],
  plugin: P,
): P[] {
  return [...plugins, plugin];
}

/** Removes the plugin named `name`, if present. Returns the original array
 * (same reference) when no matching entry exists. */
export function removePlugin<P extends PluginLike>(
  plugins: readonly P[],
  name: string,
): P[] {
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
export function changePlugin<P extends PluginLike>(
  plugins: readonly P[],
  config: Partial<P> & { name: string },
): P[] {
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
export function applyPluginConfiguration<P extends PluginLike>(
  pluginSet: PluginSet<P>,
  detail: ConfigurePluginDetail<P>,
): ApplyPluginConfigurationResult<P> {
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
        [kind]: addPlugin(current, { ...config, name } as P),
      },
    };
  }

  return {
    pluginSet,
    error: `No "${kind}" plugin named "${name}" to remove`,
  };
}
