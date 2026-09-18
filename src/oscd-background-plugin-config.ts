import {
  applyPluginConfiguration,
  composePluginSets,
  type ConfigurePluginDetail,
  emptyPluginSet,
  type PluginSet,
  withoutPlugins,
} from './plugin-configuration.js';
import {
  pluginSetFromStored,
  readStoredPlugins,
  writeStoredPlugins,
} from './plugin-local-storage.js';

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

/** The plugins configured through events; only these are persisted. */
const ownedPluginSets = new WeakMap<ShellLike, PluginSet>();

/** `kind` belongs to the set, not to an entry. */
function sanitizeDetail(detail: ConfigurePluginDetail): ConfigurePluginDetail {
  const { config } = detail;
  if (config === null || !('kind' in config)) {
    return detail;
  }
  const { kind: _bucketKey, ...rest } = config as Record<string, unknown>;
  return { ...detail, config: rest as ConfigurePluginDetail['config'] };
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
    const owned = ownedPluginSets.get(shell) ?? emptyPluginSet();
    const { pluginSet: nextOwned, error } = applyPluginConfiguration(
      owned,
      sanitizeDetail(detail),
    );

    if (error) {
      console.warn(`oscd-background-plugin-config: ${error}`);
      return;
    }

    ownedPluginSets.set(shell, nextOwned);
    shell.plugins = composePluginSets(
      withoutPlugins(shell.plugins, owned),
      nextOwned,
    );
    writeStoredPlugins(nextOwned);
  };

  connectedCallback() {
    document.addEventListener(
      'oscd-configure-plugin',
      this.handleConfigurePlugin,
    );

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
    document.removeEventListener(
      'oscd-configure-plugin',
      this.handleConfigurePlugin,
    );
  }
}
