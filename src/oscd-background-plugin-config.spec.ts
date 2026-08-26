import { expect } from '@open-wc/testing';

import OscdBackgroundPluginConfig from './oscd-background-plugin-config.js';
import type { PluginSet } from './plugin-configuration.js';

customElements.define(
  'oscd-background-plugin-config',
  OscdBackgroundPluginConfig,
);

type ShellElement = HTMLElement & { plugins: PluginSet };

function createUnconnectedShellAndPlugin(
  initialPlugins: PluginSet = { menu: [], editor: [], background: [] },
): {
  shell: ShellElement;
  plugin: HTMLElement;
  connect: () => void;
} {
  const shell = document.createElement('oscd-shell') as ShellElement;
  shell.plugins = initialPlugins;
  const oscdBackgroundPluginConfig = document.createElement('oscd-background-plugin-config');
  shell.append(oscdBackgroundPluginConfig);
  return {
    shell,
    plugin: oscdBackgroundPluginConfig,
    connect: () => document.body.append(shell),
  };
}

function createShellAndPlugin(): {
  shell: ShellElement;
  plugin: HTMLElement;
} {
  const { shell, plugin, connect } = createUnconnectedShellAndPlugin();
  connect();
  return { shell, plugin };
}

function dispatchConfigurePlugin(
  bridge: HTMLElement,
  detail: Record<string, unknown>,
) {
  bridge.dispatchEvent(
    new CustomEvent('oscd-configure-plugin', {
      bubbles: true,
      composed: true,
      detail,
    }),
  );
}

describe('oscd-background-plugin-config', () => {
  let shell: ShellElement;
  let bridge: HTMLElement;

  beforeEach(() => {
    // The adapter reads/writes the real `localStorage['plugins']` key by
    // default; clear it so tests never leak state into one another.
    localStorage.clear();
    ({ shell, plugin: bridge } = createShellAndPlugin());
  });

  afterEach(() => {
    shell.remove();
    localStorage.clear();
  });

  it('adds a configured plugin to the shell', () => {
    dispatchConfigurePlugin(bridge, {
      name: 'Configured menu',
      kind: 'menu',
      config: { src: '/menu.js', icon: 'menu' },
    });

    expect(shell.plugins.menu).to.deep.equal([
      { name: 'Configured menu', src: '/menu.js', icon: 'menu' },
    ]);
  });

  it('removes a configured plugin from the shell', () => {
    dispatchConfigurePlugin(bridge, {
      name: 'Configured menu',
      kind: 'menu',
      config: { src: '/menu.js', icon: 'menu' },
    });

    dispatchConfigurePlugin(bridge, {
      name: 'Configured menu',
      kind: 'menu',
      config: null,
    });

    expect(shell.plugins.menu).to.deep.equal([]);
  });

  it('warns and leaves the shell unchanged when the configuration is invalid', () => {
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);

    try {
      dispatchConfigurePlugin(bridge, {
        name: 'Never configured',
        kind: 'menu',
        config: null,
      });
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings).to.have.lengthOf(1);
    expect(warnings[0][0]).to.include('Never configured');
    expect(shell.plugins.menu).to.deep.equal([]);
  });

  it('ignores events that do not bubble through an oscd-shell', () => {
    const orphanBridge = document.createElement(
      'oscd-background-plugin-config',
    );
    document.body.append(orphanBridge);

    dispatchConfigurePlugin(orphanBridge, {
      name: 'Configured menu',
      kind: 'menu',
      config: { src: '/menu.js' },
    });

    expect(shell.plugins.menu).to.deep.equal([]);
    orphanBridge.remove();
  });

  it('stops listening once removed from the DOM', () => {
    bridge.remove();

    dispatchConfigurePlugin(bridge, {
      name: 'Configured menu',
      kind: 'menu',
      config: { src: '/menu.js' },
    });

    expect(shell.plugins.menu).to.deep.equal([]);
  });

  it('persists the current plugin set to localStorage after a change', () => {
    dispatchConfigurePlugin(bridge, {
      name: 'Configured menu',
      kind: 'menu',
      config: { src: '/menu.js', icon: 'menu' },
    });

    expect(JSON.parse(localStorage.getItem('plugins') ?? '[]')).to.deep.equal([
      { name: 'Configured menu', src: '/menu.js', icon: 'menu', kind: 'menu' },
    ]);
  });

  it('merges stored plugins onto the shell on connect without removing host-configured plugins', () => {
    shell.remove();
    localStorage.setItem(
      'plugins',
      JSON.stringify([
        { name: 'Stored menu', kind: 'menu', src: '/stored.js' },
      ]),
    );

    const unconnected = createUnconnectedShellAndPlugin({
      menu: [{ name: 'Host menu', src: '/host.js' }],
      editor: [],
      background: [],
    });
    unconnected.connect();

    expect(unconnected.shell.plugins.menu).to.deep.equal([
      { name: 'Host menu', src: '/host.js' },
      { name: 'Stored menu', src: '/stored.js' },
    ]);
    unconnected.shell.remove();
  });

  it('does not reassign shell.plugins on connect when storage already matches', () => {
    const initialPlugins: PluginSet = {
      menu: [{ name: 'Menu plugin', src: '/menu.js' }],
      editor: [],
      background: [],
    };
    localStorage.setItem(
      'plugins',
      JSON.stringify([
        { name: 'Menu plugin', kind: 'menu', src: '/menu.js' },
      ]),
    );

    const trackedShell = document.createElement('oscd-shell') as ShellElement;
    let assignments = 0;
    let currentPlugins = initialPlugins;
    Object.defineProperty(trackedShell, 'plugins', {
      get: () => currentPlugins,
      set: (value: PluginSet) => {
        assignments += 1;
        currentPlugins = value;
      },
    });
    const trackedBridge = document.createElement(
      'oscd-background-plugin-config',
    );
    trackedShell.append(trackedBridge);

    document.body.append(trackedShell);

    expect(assignments).to.equal(0);
    trackedShell.remove();
  });

  it('does nothing on connect when it is not nested under an oscd-shell', () => {
    localStorage.setItem(
      'plugins',
      JSON.stringify([{ name: 'Stored menu', kind: 'menu', src: '/s.js' }]),
    );

    const orphanBridge = document.createElement(
      'oscd-background-plugin-config',
    );

    expect(() => document.body.append(orphanBridge)).to.not.throw();

    orphanBridge.remove();
  });

  it('finds the shell through a shadow root, as real oscd-shell renders background plugins inside its own shadow DOM', () => {
    localStorage.setItem(
      'plugins',
      JSON.stringify([{ name: 'Stored menu', kind: 'menu', src: '/s.js' }]),
    );

    const shadowShell = document.createElement('oscd-shell') as ShellElement;
    shadowShell.plugins = { menu: [], editor: [], background: [] };
    const shadowRoot = shadowShell.attachShadow({ mode: 'open' });
    const shadowBridge = document.createElement(
      'oscd-background-plugin-config',
    );
    shadowRoot.append(shadowBridge);

    document.body.append(shadowShell);

    expect(shadowShell.plugins.menu).to.deep.equal([
      { name: 'Stored menu', src: '/s.js' },
    ]);
    shadowShell.remove();
  });
});
