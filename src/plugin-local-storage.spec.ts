import { expect } from '@open-wc/testing';

import {
  flattenPluginSet,
  pluginSetFromStored,
  readStoredPlugins,
  writeStoredPlugins,
  type StoredPlugin,
} from './plugin-local-storage.js';
import type { PluginSet } from './plugin-configuration.js';

interface TestPlugin {
  name: string;
  src?: string;
  icon?: string;
  [key: string]: unknown;
}

/** Minimal in-memory `Storage` so these tests never touch the real
 * `localStorage` (and can't leak state between test files). */
function createFakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function emptyPluginSet(): PluginSet<TestPlugin> {
  return { menu: [], editor: [], background: [] };
}

describe('plugin-local-storage', () => {
  describe('flattenPluginSet', () => {
    it('flattens each kind into a single array tagged with kind', () => {
      const pluginSet: PluginSet<TestPlugin> = {
        menu: [{ name: 'Menu plugin' }],
        editor: [{ name: 'Editor plugin' }],
        background: [{ name: 'Background plugin' }],
      };

      expect(flattenPluginSet(pluginSet)).to.deep.equal([
        { name: 'Menu plugin', kind: 'menu' },
        { name: 'Editor plugin', kind: 'editor' },
        { name: 'Background plugin', kind: 'background' },
      ]);
    });

    it('tolerates a partial PluginSet missing a kind key', () => {
      const pluginSet = { menu: [{ name: 'Menu plugin' }] } as PluginSet<TestPlugin>;

      expect(flattenPluginSet(pluginSet)).to.deep.equal([
        { name: 'Menu plugin', kind: 'menu' },
      ]);
    });

    it('tolerates a kind key whose value is undefined', () => {
      const pluginSet = {
        menu: [{ name: 'Menu plugin' }],
        editor: undefined,
      } as unknown as PluginSet<TestPlugin>;

      expect(flattenPluginSet(pluginSet)).to.deep.equal([
        { name: 'Menu plugin', kind: 'menu' },
      ]);
    });
  });

  describe('readStoredPlugins / writeStoredPlugins', () => {
    it('round-trips a written PluginSet', () => {
      const storage = createFakeStorage();
      const pluginSet: PluginSet<TestPlugin> = {
        menu: [{ name: 'Menu plugin', src: '/menu.js' }],
        editor: [],
        background: [],
      };

      writeStoredPlugins(pluginSet, storage);

      expect(readStoredPlugins(storage)).to.deep.equal([
        { name: 'Menu plugin', src: '/menu.js', kind: 'menu' },
      ]);
    });

    it('returns an empty array when nothing is stored', () => {
      expect(readStoredPlugins(createFakeStorage())).to.deep.equal([]);
    });

    it('returns an empty array for malformed JSON', () => {
      const storage = createFakeStorage();
      storage.setItem('plugins', '{not json');

      expect(readStoredPlugins(storage)).to.deep.equal([]);
    });

    it('returns an empty array when the stored value is not an array', () => {
      const storage = createFakeStorage();
      storage.setItem('plugins', JSON.stringify({ not: 'an array' }));

      expect(readStoredPlugins(storage)).to.deep.equal([]);
    });

    it('drops individually malformed entries', () => {
      const storage = createFakeStorage();
      storage.setItem(
        'plugins',
        JSON.stringify([
          { name: 'Valid', kind: 'menu' },
          { name: 'Missing kind' },
          { kind: 'menu' },
          null,
          'not an object',
        ]),
      );

      expect(readStoredPlugins(storage)).to.deep.equal([
        { name: 'Valid', kind: 'menu' },
      ]);
    });
  });

  describe('pluginSetFromStored', () => {
    it('buckets stored entries by kind', () => {
      const stored: StoredPlugin<TestPlugin>[] = [
        { name: 'Stored menu', kind: 'menu', src: '/menu.js' },
        { name: 'Stored editor', kind: 'editor', src: '/editor.js' },
      ];

      expect(pluginSetFromStored(stored)).to.deep.equal({
        menu: [{ name: 'Stored menu', src: '/menu.js' }],
        editor: [{ name: 'Stored editor', src: '/editor.js' }],
        background: [],
      });
    });

    it('drops the kind key from the reconstructed entry', () => {
      const stored: StoredPlugin<TestPlugin>[] = [
        { name: 'Stored menu', kind: 'menu', src: '/menu.js' },
      ];

      expect(pluginSetFromStored(stored).menu[0]).to.not.have.property('kind');
    });

    it('ignores stored entries with an unrecognised kind', () => {
      const stored = [
        { name: 'Validator plugin', kind: 'validator', src: '/v.js' },
      ] as unknown as StoredPlugin<TestPlugin>[];

      expect(pluginSetFromStored(stored)).to.deep.equal(emptyPluginSet());
    });

    it('round-trips a written PluginSet', () => {
      const pluginSet = {
        ...emptyPluginSet(),
        menu: [{ name: 'Menu plugin', src: '/menu.js', icon: 'menu' }],
      };
      const storage = createFakeStorage();
      writeStoredPlugins(pluginSet, storage);

      expect(pluginSetFromStored(readStoredPlugins(storage))).to.deep.equal(
        pluginSet,
      );
    });
  });
});
