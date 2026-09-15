const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const css = require('postcss').parse(fs.readFileSync('src/app/globals.css', 'utf8'));
css.walkRules(rule => {
  if (!/dashboard-content|metric-grid|status-change|:active/.test(rule.selector)) return;
  let parent = rule.parent;
  while (parent && !(parent.type === 'atrule' && parent.name === 'media' && parent.params === '(prefers-reduced-motion: no-preference)')) parent = parent.parent;
  assert.ok(parent, 'Dashboard movement must be opt-in to motion: ' + rule.selector);
});
function load(name, dependencies, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`src/components/${name}.tsx`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => dependencies[name] ?? require(name), ...globals });
  return exports.default;
}
const descendants = node => !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(descendants)];
for (const reduced of [false, true]) {
  const Ticker = load('NumberTicker', { 'motion/react': { motion: { span: 'span' }, useReducedMotion: () => reduced } });
  let previous;
  for (const value of [9, 10, 58, 12.5, -2.5, 0]) {
    const tree = Ticker({ value });
    const nodes = descendants(tree);
    assert.equal(nodes.find(n => n.props.className === 'sr-only').props.children, String(value));
    const columns = nodes.filter(n => n.props.animate);
    const digits = String(value).replace(/\D/g, '').split('').map(Number);
    assert.deepEqual(columns.map(n => n.props.animate.y), digits.map(n => `-${n * 1.1}em`));
    assert.ok(columns.every(n => n.props.initial === false && n.props.transition.duration === (reduced ? 0 : 0.9)));
    if (previous && value === 10) assert.equal(columns.at(-1).key, previous.at(-1).key, 'ones column survives 9 to 10');
    previous = columns;
  }
}
const RealTicker = load('NumberTicker', {});
assert.match(renderToStaticMarkup(React.createElement(RealTicker, { value: -2.5 })), /class="sr-only">-2.5<\/span>/);
(async () => {
  for (const supported of [false, true]) for (const reduced of [false, true]) {
    let dark = true, state = null, effects = [], transitions = 0;
    const root = { classList: { contains: () => dark, toggle: (_, value) => { dark = value; } }, dataset: {} };
    const document = { documentElement: root, cookie: '' };
    if (supported) document.startViewTransition = callback => { transitions++; callback(); return { finished: Promise.resolve() }; };
    const Toggle = load('ThemeToggle', { react: { ...React, useState: () => [state, value => { state = value; }], useRef: () => ({ current: false }), useEffect: fn => effects.push(fn) } }, { document, window: { matchMedia: () => ({ matches: reduced }) } });
    assert.equal(Toggle().props.disabled, true, 'stable disabled control before hydration');
    effects[0]();
    await Toggle().props.onClick();
    assert.equal(dark, false);
    assert.match(document.cookie, /^theme=light;/);
    assert.equal(Toggle().props['aria-label'], 'Switch to dark mode');
    await Toggle().props.onClick();
    assert.equal(dark, true);
    assert.match(document.cookie, /^theme=dark;/);
    assert.equal(transitions, supported && !reduced ? 2 : 0);
    assert.equal(root.dataset.beuiVt, undefined);
  }
  console.log('Motion checks passed: ticker updates/precision, SSR, theme directions, persistence, reduced-motion and unsupported-browser fallbacks.');
})().catch(error => { console.error(error); process.exitCode = 1; });
