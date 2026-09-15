import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createTracwell } from 'tracwell';

const output = ts.transpileModule(fs.readFileSync('src/components/TracwellAnalytics.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function mount(environment, browser) {
  const effects = [];
  const configs = [];
  const context = {
    exports: {},
    process: { env: { NODE_ENV: environment } },
    ...(browser ? { document: {} } : {}),
    require(name) {
      if (name === 'react') return { useEffect: effect => effects.push(effect) };
      assert.equal(name, 'tracwell');
      return { createTracwell: config => { configs.push(config); return {}; } };
    },
  };
  vm.runInNewContext(output, context);
  context.exports.default();
  assert.equal(configs.length, 0, 'Rendering must not initialize analytics');
  effects[0]();
  effects[0](); // Strict Mode effect replay.
  context.exports.default();
  effects[1](); // Remounts must reuse the client.
  return configs;
}

assert.equal(mount('development', true).length, 0);
assert.equal(mount('production', false).length, 0);
const configs = mount('production', true);
assert.equal(configs.length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(configs[0])), {
  projectKey: 'tw_live_a3d8db4110f747f6ac554dfa91ae71b6',
  collectionMode: 'private',
  consent: 'granted',
  respectDoNotTrack: true,
});

const handlers = new Map();
const events = [];
let installEffect;
const installContext = {
  exports: {},
  require(name) {
    if (name === 'react') return { useState: () => [false, () => {}], useEffect: effect => { installEffect = effect; } };
    if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
    assert.equal(name, '@/components/TracwellAnalytics');
    return { analytics: { track: (...args) => events.push(args) } };
  },
  matchMedia: () => ({ matches: false, addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) }),
  navigator: {},
  window: { addEventListener: (name, fn) => handlers.set(name, fn), removeEventListener: name => handlers.delete(name) },
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/InstallApp.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, installContext);
installContext.exports.default();
const cleanup = installEffect();
handlers.get('change')();
assert.equal(events.length, 0, 'Rendering or display changes must not report an installation');
handlers.get('appinstalled')();
assert.deepEqual(JSON.parse(JSON.stringify(events)), [['app_installed', { source: 'browser' }]]);
cleanup();
assert.equal(handlers.size, 0);

// Exercise the installed SDK with DNT enabled. Any browser side effect fails.
globalThis.window = new Proxy({}, { get() { throw new Error('DNT must prevent browser side effects'); } });
globalThis.document = {};
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { doNotTrack: '1' } });
const blocked = createTracwell(configs[0]);
assert.equal(blocked.track('notification_preferences_saved', { direction: 'both' }), undefined);
assert.equal(blocked.page(), undefined);
assert.equal(blocked.getSession(), undefined);
await blocked.shutdown();
console.log('Analytics checks passed: browser-only singleton, no development collection, completed installation, private mode and DNT suppression.');
