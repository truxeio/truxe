/**
 * Babel Configuration for Heimdall API
 *
 * Enables ES modules support for Jest
 */

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
      },
    ],
  ],
}
