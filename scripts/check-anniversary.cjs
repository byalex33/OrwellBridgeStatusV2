const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const source = ts.transpileModule(fs.readFileSync('src/components/AnniversaryToast.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

for (const enabled of [true, false]) for (const stored of [null, '1', 'blocked']) {
  let visible = false, effect, timer, cleared, saved, delay;
  const events = [];
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: name => name === 'react' ? {
      useState: () => [visible, value => { visible = value; }],
      useEffect: fn => { effect = fn; },
    } : name === '@/components/TracwellAnalytics' ? {
      analytics: enabled ? { track: (...args) => events.push(args) } : undefined,
    } : require(name),
    localStorage: {
      getItem: () => { if (stored === 'blocked') throw Error('Blocked'); return stored; },
      setItem: (key, value) => { if (stored === 'blocked') throw Error('Blocked'); saved = [key, value]; },
    },
    window: {
      setTimeout: (fn, ms) => { timer = fn; delay = ms; return 42; },
      clearTimeout: id => { cleared = id; },
    },
  });
  const render = () => exports.default();
  assert.doesNotMatch(renderToStaticMarkup(render()), /Dismiss thank-you/);
  const cleanup = effect();
  assert.equal(events.length, 0);
  if (stored === '1') { assert.equal(timer, undefined); continue; }
  assert.equal(delay, 1800);
  timer();
  const tree = render();
  assert.match(renderToStaticMarkup(tree), /A lot of bridge checks/);
  assert.equal(events.length, 0, 'Showing the toast must not count as dismissal');
  const elements = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(elements)];
  elements(tree).find(node => node.type === 'button').props.onClick();
  assert.doesNotMatch(renderToStaticMarkup(render()), /Dismiss thank-you/);
  assert.deepEqual(JSON.parse(JSON.stringify(events)), enabled ? [['anniversary_toast_dismissed', { anniversary: 2 }]] : []);
  if (stored !== 'blocked') assert.deepEqual(saved, ['orwell-anniversary-2-dismissed', '1']);
  cleanup();
  assert.equal(cleared, 42);
}
console.log('Anniversary checks passed: delayed reveal, dismissal tracking, unavailable analytics, returning visits, blocked storage and timer cleanup.');
