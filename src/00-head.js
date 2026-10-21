/* dsh-minecraft-ui — client bundle.
 * Hand-written single-file browser bundle, assembled from src/*.js by
 * build.mjs. Runs inside the dsh web GUI module loader.
 */
window.__ModuleLoader__.load({
  id: 'dsh-minecraft-ui',
  factory: (require) => {
    'use strict'

    const React = require('react')
    const h = React.createElement

    /** Plugin namespace: locale namespace, storage key prefix, DOM ids. */
    const MC_NS = 'minecraft-ui'
    /** localStorage key holding the persisted options. */
    const MC_STORAGE_KEY = 'dsh.minecraft-ui.v1'
    /** Marks <body> while the theme is applied (all component CSS is scoped by it). */
    const MC_BODY_ATTR = 'data-mc-theme'
    /** Marks the elements this plugin renders itself (excluded from component restyling). */
    const MC_UI_ATTR = 'data-mc-ui'
