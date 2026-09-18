/**
 * Framework-agnostic bridge between a `PluginSet` and the flat,
 * `kind`-tagged `localStorage['plugins']` array used by
 * `compas-open-scd`, so distributions sharing that storage key stay
 * interoperable. Nothing here touches the DOM beyond the injectable
 * `Storage` argument, so it can be imported as a plain npm module.
 */
import { type PluginKind, type PluginLike, type PluginSet } from './plugin-configuration.js';
/** The flat, `kind`-tagged shape `compas-open-scd` persists under
 * `localStorage['plugins']`. */
export type StoredPlugin<P extends PluginLike = PluginLike> = P & {
    kind: PluginKind;
};
/** Flattens a `PluginSet` into the flat `{ ...plugin, kind }[]` shape shared
 * with `compas-open-scd`. */
export declare function flattenPluginSet<P extends PluginLike>(pluginSet: PluginSet<P>): StoredPlugin<P>[];
/** Reads and parses `storage['plugins']`. Missing, malformed, or
 * individually malformed entries are dropped rather than thrown. */
export declare function readStoredPlugins(storage?: Storage): StoredPlugin[];
/** Persists `pluginSet` to `storage['plugins']` in the flat, `kind`-tagged
 * shape shared with `compas-open-scd`. */
export declare function writeStoredPlugins<P extends PluginLike>(pluginSet: PluginSet<P>, storage?: Storage): void;
/** Rebuilds the `PluginSet` we own from its stored, flat representation.
 * Entries with an unrecognised `kind` are ignored. */
export declare function pluginSetFromStored<P extends PluginLike>(stored: readonly StoredPlugin<P>[]): PluginSet<P>;
