const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function dashboard(fetch) {
  let state = [], cursor = 0, effect, interval, cleanup;
  const exports = {};
  const react = { ...React, useState(initial) { const i=cursor++; if (!(i in state)) state[i]=initial; return [state[i], v => { state[i]=typeof v==='function'?v(state[i]):v; }]; }, useEffect(fn) { effect=fn; } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/page.tsx','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: n => n==='react'?react:require(n), fetch, AbortController, AbortSignal, Date, console, setInterval: fn => { interval=fn; return 1; }, clearInterval(){} });
  const render=()=>{cursor=0;return renderToStaticMarkup(exports.default());};
  render();cleanup=effect();
  return { render, state, poll:()=>interval(), cleanup };
}
const response = (result, ok=true) => ({ ok, json: async()=>result });
const tick = () => new Promise(setImmediate);
(async()=>{
  let calls=0;
  const page=dashboard(async path=>{
    calls++;
    if(path.includes('weather')) return new Promise(()=>{});
    if(path.includes('events')) return response([]);
    return response({success:true, realTime:true, timestamp:new Date().toISOString(),data:[],trafficData:{directions:{eastbound:{status:'OPEN'},westbound:{status:'CLOSED'}}}});
  });
  await tick();
  assert.equal(page.state[0].eastbound,'open');
  assert.equal(page.state[0].westbound,'closed');
  assert.equal(page.state[4],false,'history finishes while weather hangs');
  page.poll();await tick();assert.equal(calls,3,'overlapping refresh skipped');
  page.cleanup();
  console.log('F14: independent panel updates, pending-request overlap guard passed');
})().catch(error=>{console.error(error);process.exitCode=1});
module.exports={dashboard,response,tick};
