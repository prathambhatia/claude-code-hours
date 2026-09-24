// Prints the anonymous daily counters. Pulls the Redis credentials into a temp file, then deletes it.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const days = Number(process.argv[2]) || 14;
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cch-')), '.env');
const token = process.env.VERCEL_TOKEN ? ['--token', process.env.VERCEL_TOKEN] : [];
try {
  execFileSync('npx', ['-y', 'vercel@latest', 'env', 'pull', tmp, '--environment=production', '--yes', ...token],
    { cwd: new URL('../site', import.meta.url).pathname, stdio: 'ignore' });
  const env = Object.fromEntries(fs.readFileSync(tmp, 'utf8').split('\n')
    .map(l => l.match(/^(\w+)="?(.*?)"?$/)).filter(Boolean).map(m => [m[1], m[2]]));
  const dates = Array.from({ length: days }, (_, i) => new Date(Date.now() + 5.5 * 36e5 - i * 864e5).toISOString().slice(0, 10));
  const keys = ['stats:created:total', 'stats:views:total', ...dates.flatMap(d => [`stats:created:${d}`, `stats:views:${d}`])];
  const res = await fetch(`${env.KV_REST_API_URL}/mget/${keys.map(encodeURIComponent).join('/')}`,
    { headers: { authorization: `Bearer ${env.KV_REST_API_READ_ONLY_TOKEN || env.KV_REST_API_TOKEN}` } });
  const vals = (await res.json()).result.map(v => Number(v) || 0);
  console.log(`\n  All time: ${vals[0]} sheets created, ${vals[1]} short-link views\n`);
  console.log('  Day (IST)     Created   Views');
  dates.forEach((d, i) => console.log(`  ${d}   ${String(vals[2 + i * 2]).padStart(7)} ${String(vals[3 + i * 2]).padStart(7)}`));
  console.log('');
} finally {
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
}
