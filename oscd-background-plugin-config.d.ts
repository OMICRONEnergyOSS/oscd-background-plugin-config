/** Handles `oscd-configure-plugin` events for `oscd-shell`, delegating the
 * actual add/change/remove decision to the framework-agnostic
 * `./plugin-configuration.js` module. */
export default class OscdBackgroundPluginConfig extends HTMLElement {
    private readonly handleConfigurePlugin;
    connectedCallback(): void;
    disconnectedCallback(): void;
}
