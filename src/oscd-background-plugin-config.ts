import {
  applyPluginConfiguration,
  type ConfigurePluginDetail,
  type PluginSet,
} from './plugin-configuration.js';
import { mergeStoredPlugins, readStoredPlugins, writeStoredPlugins } from './plugin-local-storage.js';

interface ShellLike extends HTMLElement {
  plugins: PluginSet;
}

function isShellLike(item: unknown): item is ShellLike {
  return item instanceof HTMLElement && item.localName === 'oscd-shell';
}

/** Walks up from `node` through parent nodes, hopping from a `ShadowRoot`
 * to its `host`, to find the enclosing `oscd-shell`. Needed at
 * `connectedCallback` time (no incoming event to inspect), unlike
 * {@link isShellLike}'s `event.composedPath()` use below. Real `oscd-shell`
 * renders background plugins inside its own shadow root, so this typically
 * resolves in a single hop. */
function findShell(node: Node | null): ShellLike | null {
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
function updateShellPlugins(shell: ShellLike, pluginSet: PluginSet) {
  shell.plugins = pluginSet;
  writeStoredPlugins(pluginSet);
}

/** Handles `oscd-configure-plugin` events for `oscd-shell`, delegating the
 * actual add/change/remove decision to the framework-agnostic
 * `./plugin-configuration.js` module. */
export default class OscdBackgroundPluginConfig extends HTMLElement {
  private readonly handleConfigurePlugin = (event: Event) => {
    // Background plugins are siblings of the plugin that emits the event, so
    // listening on this element would never receive that sibling's event.
    const shell = event.composedPath().find(isShellLike);
    if (!shell) {
      return;
    }

    const { detail } = event as CustomEvent<ConfigurePluginDetail>;
    const { pluginSet, error } = applyPluginConfiguration(
      shell.plugins,
      detail,
    );

    if (error) {
      console.warn(`oscd-background-plugin-config: ${error}`);
    }

    updateShellPlugins(shell, pluginSet);
  };

  connectedCallback() {
    document.addEventListener(
      'oscd-configure-plugin',
      this.handleConfigurePlugin,
    );

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
    document.removeEventListener(
      'oscd-configure-plugin',
      this.handleConfigurePlugin,
    );
  }
}
