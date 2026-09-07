const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports,require:n=>mocks[n]??require(n),console});return exports;}
(async()=>{
 let providerCalls=0;
 const route=load('src/app/api/weather/route.ts',{'next/server':{NextResponse:{json:(body,init)=>({body,status:init?.status??200})}},'@/lib/cache':{cache:{get:()=>null,getOrFetch:(_key,fn)=>fn()}},'@/lib/weather':{getWeatherData:async()=>{providerCalls++;throw Error('offline')}}});
 const unavailable=await route.GET();assert.equal(providerCalls,1);assert.equal(unavailable.status,503);assert.equal(unavailable.body.data,null);assert.equal(unavailable.body.current,undefined);
 for(const current of [{},{temperature_2m:null,wind_speed_10m:0,wind_direction_10m:0,weather_code:0},{temperature_2m:12,wind_speed_10m:-1,wind_direction_10m:0,weather_code:0}]){
 const weather=load('src/lib/weather.ts',{axios:{get:async()=>({data:{current}})}});await assert.rejects(weather.getWeatherData());
 }
 const weather=load('src/lib/weather.ts',{axios:{get:async()=>({data:{current:{temperature_2m:-2,wind_speed_10m:0,wind_direction_10m:0,weather_code:0}}})}});assert.equal((await weather.getWeatherData()).windSpeed,0);
 console.log('F10 weather fallback and numeric validation passed');
})().catch(e=>{console.error(e);process.exitCode=1});
