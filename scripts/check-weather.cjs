const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports,require:n=>mocks[n]??require(n),console,Error,...globals});return exports;}
(async()=>{
 let providerCalls=0;
 const route=load('src/app/api/weather/route.ts',{'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status??200})}},'@/lib/cache':{cache:load('src/lib/cache.ts',{}).cache},'@/lib/weather':{getWeatherData:async()=>{providerCalls++;throw Error('offline')}}});
 const unavailable=await route.GET();assert.equal(providerCalls,1);assert.equal(unavailable.status,503);assert.equal(unavailable.body.data,null);assert.equal(unavailable.body.current,undefined);
 for(const current of [{},{temperature_2m:null,wind_speed_10m:0,wind_direction_10m:0,weather_code:0,time:Date.now()/1000},{temperature_2m:12,wind_speed_10m:-1,wind_direction_10m:0,weather_code:0,time:Date.now()/1000}]){
 const weather=load('src/lib/weather.ts',{axios:{get:async()=>({data:{current}})}});await assert.rejects(weather.getWeatherData());
 }
 const weather=load('src/lib/weather.ts',{axios:{get:async()=>({data:{current:{temperature_2m:-2,wind_speed_10m:0,wind_direction_10m:0,weather_code:0,time:Date.now()/1000}}})}});assert.equal((await weather.getWeatherData()).windSpeed,0);
 const old=load('src/lib/weather.ts',{axios:{get:async()=>({data:{current:{temperature_2m:12,wind_speed_10m:20,wind_direction_10m:0,weather_code:0,time:0}}})}});await assert.rejects(old.getWeatherData(),/stale/);
 let clock=Date.now();class Clock extends Date {static now(){return clock;}}
 const modelTime=new Date(clock-29*60000).toISOString();const realCache=load('src/lib/cache.ts',{}, {Date:Clock}).cache;let offline=false;
 const cachedRoute=load('src/app/api/weather/route.ts',{'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status??200})}},'@/lib/cache':{cache:realCache},'@/lib/weather':{getWeatherData:async()=>{if(offline)throw Error('offline');return {timestamp:modelTime,temperature:12,windSpeed:10,windDirection:0,description:'Clear',icon:''};}}},{Date:Clock});
 assert.equal((await cachedRoute.GET()).status,200);clock+=61000;offline=true;const expired=await cachedRoute.GET();assert.equal(expired.status,503);assert.equal(expired.body.data,null);
 console.log('F10/F22 weather fallback and numeric validation passed');
})().catch(e=>{console.error(e);process.exitCode=1});
