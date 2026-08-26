/**
 * Framework-agnostic bridge between a `PluginSet` and the flat,
 * `kind`-tagged `localStorage['plugins']` array used by
 * `compas-open-scd`, so distributions sharing that storage key stay
 * interoperable. Nothing here touches the DOM beyond the injectable
 * `Storage` argument, so it can be imported as a plain npm module.
 */

import {
  applyPluginConfiguration,
  isPluginKind,
  type PluginKind,
  type PluginLike,
  type PluginSet,
} from './plugin-configuration.js';

const STORAGE_KEY = 'plugins';

/** The flat, `kind`-tagged shape `compas-open-scd` persists under
 * `localStorage['plugins']`. */
export type StoredPlugin<P extends PluginLike = PluginLike> = P & {
  kind: PluginKind;
};

function isStoredPlugin(value: unknown): value is StoredPlugin {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { name?: unknown }).name === 'string' &&
    typeof (value as { kind?: unknown }).kind === 'string'
  );
}

/** Flattens a `PluginSet` into the flat `{ ...plugin, kind }[]` shape shared
 * with `compas-open-scd`. */
export function flattenPluginSet<P extends PluginLike>(
  pluginSet: PluginSet<P>,
): StoredPlugin<P>[] {
  return (Object.keys(pluginSet) as PluginKind[]).flatMap(kind =>
    (pluginSet[kind] ?? []).map(plugin => ({ ...plugin, kind })),
  );
}

/** Reads and parses `storage['plugins']`. Missing, malformed, or
 * individually malformed entries are dropped rather than thrown. */
export function readStoredPlugins(
  storage: Storage = localStorage,
): StoredPlugin[] {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredPlugin) : [];
  } catch {
    return [];
  }
}

/** Persists `pluginSet` to `storage['plugins']` in the flat, `kind`-tagged
 * shape shared with `compas-open-scd`. */
export function writeStoredPlugins<P extends PluginLike>(
  pluginSet: PluginSet<P>,
  storage: Storage = localStorage,
): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(flattenPluginSet(pluginSet)));
}

/**
 * Folds each stored entry onto `pluginSet`. Upsert-only: adds or updates
 * (merging, never stripping fields, per `applyPluginConfiguration`), but
 * never removes a `pluginSet` entry just because storage doesn't mention it
 * - matching `compas-open-scd`'s "built-ins always survive" merge
 * behaviour. Entries with an unrecognised `kind` are ignored.
 */
export function mergeStoredPlugins<P extends PluginLike>(
  pluginSet: PluginSet<P>,
  stored: readonly StoredPlugin<P>[],
): PluginSet<P> {
  return stored.reduce((set, storedPlugin) => {
    const { kind, ...config } = storedPlugin as StoredPlugin<P> & {
      name: string;
    };
    if (!isPluginKind(kind)) {
      return set;
    }
    const { pluginSet: next } = applyPluginConfiguration(set, {
      name: config.name,
      kind,
      config: config as unknown as Partial<P> & { name?: string },
    });
    return next;
  }, pluginSet);
}
