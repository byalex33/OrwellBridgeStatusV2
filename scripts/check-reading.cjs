const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let stored = null, state = null, fetches = 0, samples = 0, mongoDown = false, providersDown = false;
const realNow = Date.now; let now = realNow();
Date.now = () => now;
const offline = () => { if (mongoDown) throw Error('offline'); };
const readingCollection = {
  findOne: async () => { offline(); return stored; },
  updateOne: async (_query, update) => { offline(); stored = { ...update.$set }; },
};
const matches = query => state && (!query.owner || state.owner === query.owner) && (!query.retryAt || state.retryAt <= query.retryAt.$lte);
const refreshCollection = {
  findOne: async query => { offline(); return matches(query) ? state : null; },
  updateOne: async (query, update) => {
    offline();
    if (!state && update.$setOnInsert) state = { _id: 'refresh', ...update.$setOnInsert };
    else if (update.$set && matches(query)) state = { ...state, ...update.$set };
  },
  findOneAndUpdate: async (query, update) => { offline(); if (!matches(query)) return null; state = { ...state, ...update.$set }; return state; },
};
const dependencies = {
  './mongodb': { default: async () => ({ db: () => ({ collection: name => name === 'trafficRefresh' ? refreshCollection : readingCollection }) }) },
  './traffic': { getBridgeTrafficData: async () => { fetches++; if (providersDown) throw Error('429'); return { directions: {}, overallStatus: {}, timestamp: new Date(now) }; } },
  './patterns': { recordTrafficSample: async () => { samples++; if (mongoDown) throw Error('offline'); } },
};
const mod = { exports: {} };
new Function('exports', 'require', ts.transpileModule(fs.readFileSync('src/lib/reading.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(mod.exports, name => dependencies[name]);
const reading = mod.exports;
const minutes = value => value * 60000;
const realError = console.error;
console.error = () => {};
(async () => {
  await assert.rejects(reading.getSharedTrafficReading(), { name: 'ReadingUnavailableError' }, 'empty store reports no reading');
  assert.equal(fetches, 0, 'page reads never poll providers');

  await reading.refreshTrafficReading();
  assert.equal(fetches, 1, 'scheduled refresh polls providers');
  now += minutes(1);
  for (let i = 0; i < 5; i++) await reading.getSharedTrafficReading();
  assert.equal(fetches, 1, 'fresh stored reading is served without provider calls');

  now += reading.READING_MAX_AGE_MS;
  for (let i = 0; i < 5; i++) await assert.rejects(reading.getSharedTrafficReading(), { name: 'ReadingUnavailableError' });
  assert.equal(fetches, 1, 'expired reading is reported unavailable, not refreshed by pages');

  providersDown = true;
  await assert.rejects(reading.refreshTrafficReading(), /429/);
  assert.equal(fetches, 2, 'failed refresh polls once');
  assert.equal(state.failures, 1);
  now += minutes(5);
  await assert.rejects(reading.refreshTrafficReading(), { name: 'ReadingUnavailableError' });
  assert.equal(fetches, 2, 'refresh inside the backoff skips providers');
  now += minutes(25);
  await assert.rejects(reading.refreshTrafficReading(), /429/);
  assert.equal(fetches, 3, 'the next scheduled run after the first failure retries');
  now += minutes(30);
  await assert.rejects(reading.refreshTrafficReading(), { name: 'ReadingUnavailableError' });
  assert.equal(fetches, 3, 'a second failure doubles the backoff');
  assert.equal(reading.backoffMs(10), minutes(240), 'backoff is capped at four hours');

  providersDown = false;
  now += minutes(30);
  await reading.refreshTrafficReading();
  assert.equal(fetches, 4, 'refresh resumes once the backoff passes');
  assert.equal(state.failures, 0, 'success clears the backoff');
  now += minutes(30);
  await reading.refreshTrafficReading();
  assert.equal(fetches, 5, 'cleared backoff refreshes on schedule');

  state.retryAt = new Date(now + minutes(4));
  await assert.rejects(reading.refreshTrafficReading(), { name: 'ReadingUnavailableError' });
  assert.equal(fetches, 5, 'a refresh already in flight is not duplicated');
  state.retryAt = new Date(0);

  mongoDown = true;
  now += minutes(1);
  for (let i = 0; i < 5; i++) await reading.getSharedTrafficReading();
  assert.equal(fetches, 5, 'database outage reuses the in-process reading');
  await reading.refreshTrafficReading();
  assert.equal(fetches, 6, 'scheduled refresh still fetches when the database is down');
  assert.equal(samples, 4, 'every successful provider fetch records a pattern sample, even if saving fails');
  console.log('Shared traffic reading cache checks passed');
})().catch(error => { realError(error); process.exitCode = 1; }).finally(() => { console.error = realError; Date.now = realNow; });
