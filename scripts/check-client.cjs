const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function dashboard(fetch) {
  let state = [], cursor = 0, effects = [], intervals = [], cleanups;
  const exports = {};
  const react = { ...React, useState(initial) { const i=cursor++; if (!(i in state)) state[i]=initial; return [state[i], v => { state[i]=typeof v==='function'?v(state[i]):v; }]; }, useEffect(fn) { effects.push(fn); } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/page.tsx','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: n => n==='react'?react:require(n), fetch, AbortController, AbortSignal, Date, console, document: { visibilityState: "visible", addEventListener(){}, removeEventListener(){} }, window: { addEventListener(){}, removeEventListener(){} }, setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval(){} });
  const render=()=>{cursor=0;return renderToStaticMarkup(exports.default());};
  render();cleanups=effects.map(fn=>fn());
  return { render, state, poll:()=>intervals[0](), age:()=>intervals[1](), cleanup:()=>cleanups.forEach(fn=>fn?.()) };
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
  assert.equal(page.state[5],false,'history finishes while weather hangs');
  page.poll();await tick();assert.equal(calls,3,'overlapping refresh skipped');
  page.state[0].observedAt = '2020-01-01T12:00:00Z';
  page.age();
  assert.equal(page.state[0].eastbound,'unknown');
  assert.equal(page.state[0].freshness,'stale');
  assert.doesNotMatch(page.render(), /undefined mph/);
  page.cleanup();
  for (const direction of ['eastbound','westbound','both']) {
    const fallback=dashboard(async path=>response(path.includes('bridge-status') ? {success:true,fallback:true,data:[{status:'CLOSED',direction,timestamp:'2020-01-01T12:00:00Z'}]} : path.includes('events') ? [] : {}));
    await tick();assert.equal(fallback.state[0].eastbound,'unknown');assert.equal(fallback.state[0].westbound,'unknown');assert.equal(fallback.state[4],null);fallback.cleanup();
  }
  const badWeather=dashboard(async path=>response(path.includes('weather')?{success:false,data:{temperature:12,windSpeed:25,windDirection:270}}:path.includes('events')?[]:{}));
  assert.match(badWeather.render(), /Loading weather/);
  await tick();assert.equal(badWeather.state[1],null);assert.match(badWeather.render(),/Weather unavailable/);badWeather.cleanup();
  let eventsFail=false;
  const history=dashboard(async path=>response(path.includes('events')?(eventsFail?{message:'unavailable'}:[{_id:'fixture',status:'CLOSED',description:'Recorded closure',direction:'eastbound',timestamp:new Date().toISOString()}]):{},!eventsFail));
  await tick();eventsFail=true;history.poll();await tick();
  assert.match(history.render(),/History unavailable/);assert.match(history.render(),/Recorded closure/);assert.doesNotMatch(history.render(),/No recent events found/);history.cleanup();
  console.log('F08/F09/F10/F14/F16: independent panel updates, pending-request overlap guard passed');
  console.log('F08/F09/F10/F14: independent panel updates, pending-request overlap guard passed');
  console.log('F08/F09/F14: independent panel updates, pending-request overlap guard passed');
  const rejected=dashboard(async()=>{throw Error('offline')});await tick();assert.equal(rejected.state[0].lastUpdated,'Unavailable');assert.equal(rejected.state[0].freshness,'error');rejected.cleanup();
  console.log('F14: independent panel updates, pending-request overlap guard passed');
})().catch(error=>{console.error(error);process.exitCode=1});
module.exports={dashboard,response,tick};



