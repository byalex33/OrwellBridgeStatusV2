const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const tick = () => new Promise(setImmediate);
function alerts({ enabled = true, ios = false, existing = false, saveOk = true, permission = 'granted' } = {}) {
  let state = [], cursor = 0, effect, tree, requests = [], permissionRequests = 0, unsubscribed = 0;
  const subscription = { toJSON: () => ({ endpoint: 'https://push.example/sub', keys: { auth: 'private', p256dh: 'private' } }), unsubscribe: async () => { unsubscribed++; } };
  const registration = { pushManager: { getSubscription: async () => existing ? subscription : null, subscribe: async () => subscription } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/ClosureAlerts.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, require: name => name === 'react' ? { ...React, useState(value) { const i = cursor++; if (!(i in state)) state[i] = value; return [state[i], value => { state[i] = value; }]; }, useEffect(fn) { effect ??= fn; } } : require(name),
    navigator: { userAgent: ios ? 'iPhone' : 'Chrome', platform: '', maxTouchPoints: 0, doNotTrack: '1', serviceWorker: { register: async () => registration, ready: Promise.resolve(registration) } },
    matchMedia: () => ({ matches: false }), window: { isSecureContext: true, PushManager: {}, Notification: {} },
    Notification: { permission: 'default', requestPermission: async () => { permissionRequests++; return permission; } },
    fetch: async (url, options) => { requests.push({ url, options }); return { ok: options?.method ? saveOk : true, json: async () => ({ enabled, publicKey: 'AQID' }) }; }, atob, Uint8Array,
  });
  const render = () => { cursor = 0; tree = exports.default(); return renderToStaticMarkup(tree); };
  const elements = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(elements)];
  render(); effect();
  return { render, requests, click: async () => { const button = elements(tree).find(node => node.type === 'button'); assert(button); button.props.onClick(); await tick(); render(); }, permissionRequests: () => permissionRequests, unsubscribed: () => unsubscribed };
}
(async () => {
  const page = alerts(); await tick(); page.render(); assert.equal(page.permissionRequests(), 0);
  await page.click(); assert.equal(page.permissionRequests(), 1); assert.match(page.render(), /alerts are on/);
  const post = page.requests.find(call => call.options?.method === 'POST'); assert.equal(post.url, '/api/push/subscriptions'); assert.equal(JSON.parse(post.options.body).analyticsConsent, false);
  await page.click(); assert.equal(page.unsubscribed(), 1); assert.match(page.render(), /alerts are off/); assert(page.requests.some(call => call.options?.method === 'DELETE'));
  const disabled = alerts({ enabled: false }); await tick(); assert.doesNotMatch(disabled.render(), /<button/); assert.equal(disabled.permissionRequests(), 0);
  const iphone = alerts({ ios: true }); await tick(); assert.match(iphone.render(), /Add to Home Screen/); assert.equal(iphone.requests.length, 0);
  const failed = alerts({ saveOk: false }); await tick(); failed.render(); await failed.click(); assert.equal(failed.unsubscribed(), 1); assert.match(failed.render(), /Could not save/);
  const denied = alerts({ permission: 'denied' }); await tick(); denied.render(); await denied.click(); assert.match(denied.render(), /Notifications are blocked/); assert(!denied.requests.some(call => call.options?.method === 'POST'));
  const offFailure = alerts({ existing: true, saveOk: false }); await tick(); offFailure.render(); await offFailure.click(); assert.equal(offFailure.unsubscribed(), 0); assert.match(offFailure.render(), /Could not turn off/);
  const handlers = {}, notifications = [], opened = []; let work, closed = false, installed = false;
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), { self: { skipWaiting: async () => { installed = true; }, addEventListener: (type, handler) => { handlers[type] = handler; }, registration: { showNotification: async (...args) => { notifications.push(args); } }, clients: { openWindow: async url => { opened.push(url); } } } });
  handlers.install({ waitUntil: promise => { work = promise; } }); await work; assert(installed);
  const payload = { title: 'Bridge closure', body: 'Eastbound is closed.', id: 'event-123', url: '/?notification=bridge-closure' };
  handlers.push({ data: { json: () => payload }, waitUntil: promise => { work = promise; } }); await work;
  assert.equal(notifications[0][1].tag, 'bridge-closure-event-123'); assert.equal(notifications[0][1].icon, '/icon-192.png');
  for (const data of [null, { ...payload, id: '../bad' }, { ...payload, url: 'https://evil.test' }, { ...payload, body: 'x'.repeat(501) }]) handlers.push({ data: { json: () => data }, waitUntil: () => assert.fail('Invalid payload displayed') });
  handlers.push({ data: { json: () => { throw Error(); } }, waitUntil: () => assert.fail('Invalid JSON displayed') });
  assert.equal(notifications.length, 1);
  handlers.notificationclick({ notification: { close: () => { closed = true; }, data: { url: 'https://evil.test' } }, waitUntil: promise => { work = promise; } }); await work;
  assert(closed); assert.deepEqual(opened, ['/?notification=bridge-closure']);
  console.log('Push client checks passed: click-only consent, opt-in/out, disabled config, iPhone guidance, rollback, validated push and fixed click URL.');
})().catch(error => { console.error(error); process.exitCode = 1; });
