const { readdirSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const checks = readdirSync('scripts').filter(name => /^check-.*\.cjs$/.test(name)).sort();
if (!checks.length) throw Error('No regression checks found');
for (const check of checks) {
  const result = spawnSync(process.execPath, ['scripts/' + check], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(checks.length + ' regression scripts passed');
