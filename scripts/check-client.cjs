const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function dashboard(fetch) {
  let state = [], cursor = 0, effects = [], effectCursor = 0, intervals = [], tree;
  const exports = {};
  const react = { ...React, useState(initial) { const i=cursor++; if (!(i in state)) state[i]=typeof initial==='function'?initial():initial; return [state[i], v => { state[i]=typeof v==='function'?v(state[i]):v; }]; }, useEffect(fn, deps) { const i=effectCursor++; const prev=effects[i]; if(!prev || deps.some((value,index)=>value!==prev.deps[index])) effects[i]={fn,deps,cleanup:prev?.cleanup,pending:true}; } };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/page.tsx','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: n => n==='react'?react:require(n), fetch, AbortController, AbortSignal, Date, console, document: { visibilityState: "visible", addEventListener(){}, removeEventListener(){} }, window: { addEventListener(){}, removeEventListener(){} }, setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval(){} });
  const render=()=>{cursor=0;effectCursor=0;tree=exports.default();const html=renderToStaticMarkup(tree);for(const effect of effects){if(effect.pending){effect.cleanup?.();effect.cleanup=effect.fn();effect.pending=false;}}return html;};
  const elements=node=>!node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(elements)];
  const click=label=>{const button=elements(tree).find(node=>node.type==='button' && React.Children.toArray(node.props.children).includes(label));assert.ok(button,'button exists: '+label);button.props.onClick();render();};
  render();
  return { render, click, state, poll:()=>intervals[0](), age:()=>intervals[1](), cleanup:()=>effects.forEach(effect=>effect.cleanup?.()) };
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
  assert.match(page.render(), /role="status"[^>]*>Eastbound Open. Westbound Closed./);
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
  let eventsFail=false, historyRequests=0;
  const history=dashboard(async path=>{if(path.includes('events'))historyRequests++;return response(path.includes('events')?(eventsFail?{message:'unavailable'}:[{_id:'fixture',status:'CLOSED',description:'Recorded closure',direction:'eastbound',timestamp:new Date().toISOString()}]):{},!eventsFail);});
  await tick();eventsFail=true;history.poll();await tick();
  for (const [direction, expected] of [['eastbound','Bridge closed eastbound'],['westbound','Bridge closed westbound'],['both','Bridge closed in both directions'],['north','Bridge closed in at least one direction']]) {
    const legacy=dashboard(async path=>response(path.includes('events')?[{_id:'legacy',status:'CLOSED',direction,description:'Bridge closed in at least one direction',timestamp:new Date().toISOString()}]:{}));await tick();assert.ok(legacy.render().includes(expected));legacy.cleanup();
  }
  assert.match(history.render(),/History unavailable/);assert.match(history.render(),/Recorded closure/);assert.doesNotMatch(history.render(),/No recent events found/);
  eventsFail=false;history.click('Retry history');await tick();assert.equal(historyRequests,3);assert.doesNotMatch(history.render(),/History unavailable/);assert.match(history.render(),/Recorded closure/);history.cleanup();
  const rejected=dashboard(async()=>{throw Error('offline')});await tick();assert.equal(rejected.state[0].lastUpdated,'Unavailable');assert.equal(rejected.state[0].freshness,'error');rejected.cleanup();
  console.log('Client regression checks passed');
})().catch(error=>{console.error(error);process.exitCode=1});
module.exports={dashboard,response,tick};



