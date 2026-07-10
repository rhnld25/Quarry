// Bridges the license token from the main process into the renderer as
// `window.QUARRY_LICENSE`, which the Quarry app reads on startup (loadLicense()).
const { contextBridge } = require('electron');

const arg = process.argv.find((a) => a.startsWith('--quarry-license='));
const token = arg ? arg.slice('--quarry-license='.length) : '';

if (token) {
  contextBridge.exposeInMainWorld('QUARRY_LICENSE', token);
}
