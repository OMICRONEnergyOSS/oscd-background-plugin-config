import { expect } from '@open-wc/testing';

import {
  addPlugin,
  composePluginSets,
  applyPluginConfiguration,
  changePlugin,
  emptyPluginSet,
  findPluginIndex,
  hasPlugin,
  isPluginKind,
  removePlugin,
  type PluginSet,
  withoutPlugins,
} from './plugin-configuration.js';

interface TestPlugin {
  name: string;
  src?: string;
  icon?: string;
  active?: boolean;
  [key: string]: unknown;
}

describe('plugin-configuration', () => {
  describe('isPluginKind', () => {
    it('accepts the supported plugin kinds', () => {
      expect(isPluginKind('menu')).to.be.true;
      expect(isPluginKind('editor')).to.be.true;
      expect(isPluginKind('background')).to.be.true;
    });

    it('rejects anything else', () => {
      expect(isPluginKind('not-a-kind')).to.be.false;
    });
  });

  describe('findPluginIndex / hasPlugin', () => {
    const plugins: TestPlugin[] = [{ name: 'a' }, { name: 'b' }];

    it('finds the index of a matching plugin', () => {
      expect(findPluginIndex(plugins, 'b')).to.equal(1);
    });

    it('returns -1 when no plugin matches', () => {
      expect(findPluginIndex(plugins, 'c')).to.equal(-1);
    });

    it('reports whether a plugin is present', () => {
      expect(hasPlugin(plugins, 'a')).to.be.true;
      expect(hasPlugin(plugins, 'c')).to.be.false;
    });
  });

  describe('addPlugin', () => {
    it('appends the plugin without checking for duplicates', () => {
      const plugins: TestPlugin[] = [{ name: 'a' }];
      const result = addPlugin(plugins, { name: 'b' });
      expect(result).to.deep.equal([{ name: 'a' }, { name: 'b' }]);
      expect(plugins).to.deep.equal([{ name: 'a' }]);
    });
  });

  describe('removePlugin', () => {
    it('removes the matching plugin', () => {
      const plugins: TestPlugin[] = [{ name: 'a' }, { name: 'b' }];
      expect(removePlugin(plugins, 'a')).to.deep.equal([{ name: 'b' }]);
    });

    it('returns an equivalent array when no plugin matches', () => {
      const plugins: TestPlugin[] = [{ name: 'a' }];
      expect(removePlugin(plugins, 'missing')).to.deep.equal(plugins);
    });
  });

  describe('changePlugin', () => {
    it('merges the new config onto the existing entry, preserving other fields', () => {
      const plugins: TestPlugin[] = [
        { name: 'a', src: '/a.js', icon: 'a-icon', active: true },
      ];
      const result = changePlugin(plugins, { name: 'a', src: '/a-v2.js' });
      expect(result).to.deep.equal([
        { name: 'a', src: '/a-v2.js', icon: 'a-icon', active: true },
      ]);
    });

    it('returns an equivalent array when no plugin matches', () => {
      const plugins: TestPlugin[] = [{ name: 'a' }];
      expect(changePlugin(plugins, { name: 'missing' })).to.deep.equal(
        plugins,
      );
    });
  });

  describe('composePluginSets', () => {
    const host: PluginSet<TestPlugin> = {
      menu: [{ name: 'host', tagName: 'oscd-pHOST', icon: 'h' }],
      editor: [],
      background: [],
    };

    it('keeps host entries the overlay does not mention', () => {
      expect(composePluginSets(host, emptyPluginSet()).menu).to.deep.equal([
        { name: 'host', tagName: 'oscd-pHOST', icon: 'h' },
      ]);
    });

    it('appends overlay entries the host does not have', () => {
      const overlay: PluginSet<TestPlugin> = {
        ...emptyPluginSet(),
        menu: [{ name: 'ours', src: '/ours.js' }],
      };

      expect(composePluginSets(host, overlay).menu).to.deep.equal([
        { name: 'host', tagName: 'oscd-pHOST', icon: 'h' },
        { name: 'ours', src: '/ours.js' },
      ]);
    });

    it('lets a src-bearing overlay entry replace the host entry outright, so no stale tagName survives alongside src', () => {
      const overlay: PluginSet<TestPlugin> = {
        ...emptyPluginSet(),
        menu: [{ name: 'host', src: '/ours.js' }],
      };

      expect(composePluginSets(host, overlay).menu).to.deep.equal([
        { name: 'host', src: '/ours.js' },
      ]);
    });

    it('merges a partial overlay entry onto the host entry, which supplies the identity', () => {
      const overlay: PluginSet<TestPlugin> = {
        ...emptyPluginSet(),
        menu: [{ name: 'host', icon: 'changed' }],
      };

      expect(composePluginSets(host, overlay).menu).to.deep.equal([
        { name: 'host', tagName: 'oscd-pHOST', icon: 'changed' },
      ]);
    });

    it('tolerates a partial host set missing a kind key', () => {
      const partial = { menu: [] } as unknown as PluginSet<TestPlugin>;

      expect(composePluginSets(partial, emptyPluginSet())).to.deep.equal(
        emptyPluginSet(),
      );
    });
  });

  describe('withoutPlugins', () => {
    it('removes only entries owned by the given set', () => {
      const pluginSet: PluginSet<TestPlugin> = {
        menu: [
          { name: 'host', icon: 'host' },
          { name: 'owned', icon: 'owned' },
        ],
        editor: [],
        background: [],
      };
      const owned: PluginSet<TestPlugin> = {
        menu: [{ name: 'owned' }],
        editor: [],
        background: [],
      };

      expect(withoutPlugins(pluginSet, owned).menu).to.deep.equal([
        { name: 'host', icon: 'host' },
      ]);
    });
  });

  describe('applyPluginConfiguration', () => {
    it('treats a missing kind entry in a partial plugin set as empty', () => {
      const partial = { menu: [], editor: [] } as Partial<
        PluginSet<TestPlugin>
      > as PluginSet<TestPlugin>;

      const { pluginSet, error } = applyPluginConfiguration(partial, {
        name: 'a',
        kind: 'background',
        config: { icon: 'a-icon' },
      });

      expect(error).to.be.undefined;
      expect(pluginSet.background).to.deep.equal([
        { name: 'a', icon: 'a-icon' },
      ]);
    });

    it('adds a plugin that is not yet configured', () => {
      const { pluginSet, error } = applyPluginConfiguration(emptyPluginSet(), {
        name: 'a',
        kind: 'menu',
        config: { src: '/a.js', icon: 'a-icon' },
      });

      expect(error).to.be.undefined;
      expect(pluginSet.menu).to.deep.equal([
        { name: 'a', src: '/a.js', icon: 'a-icon' },
      ]);
    });

    it('changes (merges into) an already-configured plugin', () => {
      const withPlugin: PluginSet<TestPlugin> = {
        ...emptyPluginSet(),
        menu: [{ name: 'a', src: '/a.js', icon: 'a-icon', active: true }],
      };

      const { pluginSet, error } = applyPluginConfiguration(withPlugin, {
        name: 'a',
        kind: 'menu',
        config: { src: '/a-v2.js' },
      });

      expect(error).to.be.undefined;
      expect(pluginSet.menu).to.deep.equal([
        { name: 'a', src: '/a-v2.js', icon: 'a-icon', active: true },
      ]);
    });

    it('removes an already-configured plugin', () => {
      const withPlugin: PluginSet<TestPlugin> = {
        ...emptyPluginSet(),
        menu: [{ name: 'a', src: '/a.js' }],
      };

      const { pluginSet, error } = applyPluginConfiguration(withPlugin, {
        name: 'a',
        kind: 'menu',
        config: null,
      });

      expect(error).to.be.undefined;
      expect(pluginSet.menu).to.deep.equal([]);
    });

    it('reports an error and leaves the set unchanged when removing an unconfigured plugin', () => {
      const original = emptyPluginSet();

      const { pluginSet, error } = applyPluginConfiguration(original, {
        name: 'missing',
        kind: 'menu',
        config: null,
      });

      expect(error).to.equal('No "menu" plugin named "missing" to remove');
      expect(pluginSet).to.deep.equal(original);
    });

    it('reports an error and leaves the set unchanged for an unsupported kind', () => {
      const original = emptyPluginSet();

      const { pluginSet, error } = applyPluginConfiguration(original, {
        name: 'a',
        kind: 'not-a-kind' as never,
        config: { src: '/a.js' },
      });

      expect(error).to.equal(
        'Unsupported plugin kind "not-a-kind" for plugin "a"',
      );
      expect(pluginSet).to.deep.equal(original);
    });
  });
});
