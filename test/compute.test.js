// Run with TZ=UTC semantics regardless of the host so day and hour buckets are predictable.
process.env.TZ = 'UTC';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compute, hours } from '../src/compute.js';
import { buildPayload, encode, decode } from '../src/payload.js';
import { projectName } from '../src/history.js';

const MIN = 60e3;
const at = iso => Date.parse(iso);
const row = (iso, p = 'app') => ({ t: at(iso), p });

test('prompts close together form one stretch, plus a 5 minute tail', () => {
  const a = compute([row('2026-03-02T10:00:00Z'), row('2026-03-02T10:20:00Z')]);
  assert.equal(a.total, 25 * MIN);
});

test('a long gap starts a new stretch', () => {
  const a = compute([row('2026-03-02T10:00:00Z'), row('2026-03-02T11:00:00Z')]);
  assert.equal(a.total, 10 * MIN);
});

test('parallel sessions in different folders are not double counted', () => {
  const a = compute([
    row('2026-03-02T10:00:00Z', 'a'), row('2026-03-02T10:05:00Z', 'b'),
    row('2026-03-02T10:10:00Z', 'a'), row('2026-03-02T10:15:00Z', 'b'),
  ]);
  assert.equal(a.total, 20 * MIN);
  assert.equal(a.projects.length, 2);
});

test('input order does not matter', () => {
  const rows = [row('2026-03-02T10:20:00Z'), row('2026-03-02T10:00:00Z')];
  assert.equal(compute(rows).total, 25 * MIN);
});

test('a stretch across midnight is split between the two days and hours', () => {
  const a = compute([row('2026-03-02T23:50:00Z'), row('2026-03-03T00:10:00Z')]);
  assert.equal(a.days['2026-03-02'], 10 * MIN);
  assert.equal(a.days['2026-03-03'], 15 * MIN);
  assert.equal(a.hod[23], 10 * MIN);
  assert.equal(a.hod[0], 15 * MIN);
});

test('all-nighter: latest morning finish of a sitting that crossed midnight', () => {
  const rows = [];
  for (let t = at('2026-03-02T21:00:00Z'); t <= at('2026-03-03T06:30:00Z'); t += 20 * MIN) rows.push({ t, p: 'x' });
  const a = compute(rows);
  assert.equal(a.night.endMin, 6 * 60 + 20);
  assert.equal(new Date(a.night.start).toISOString(), '2026-03-02T21:00:00.000Z');
  assert.ok(Math.abs(hours(a.longest.ms) - (9 + 20 / 60 + 5 / 60)) < 1e-9);
});

test('no all-nighter when every sitting ends the day it began', () => {
  assert.equal(compute([row('2026-03-02T10:00:00Z')]).night, null);
});

test('empty history returns null', () => {
  assert.equal(compute([]), null);
});

test('folder names from POSIX and Windows paths', () => {
  assert.equal(projectName('/Users/me/code/shop-api'), 'shop-api');
  assert.equal(projectName('C:\\Users\\me\\code\\shop-api\\'), 'shop-api');
  assert.equal(projectName(undefined), '(no folder)');
});

test('payload round-trips and stays small for two years of daily use', () => {
  const rows = [];
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let day = 0; day < 760; day++) {
    const base = at('2024-09-01T08:00:00Z') + day * 864e5;
    for (let i = 0; i < 40; i++) rows.push({ t: base + Math.floor(rnd() * 14 * 36e5), p: `project-with-a-long-name-${i % 12}` });
  }
  const payload = buildPayload(compute(rows, at('2026-09-30T12:00:00Z')));
  const str = encode(payload);
  assert.deepEqual(decode(str), payload);
  assert.equal(payload.d.length, 760);
  const url = `https://claude-code-hours.vercel.app/#d=${str}`;
  assert.ok(url.length < 8000, `url is ${url.length} chars`);
});

test('hide-projects leaves folder names out of the payload', () => {
  const p = buildPayload(compute([row('2026-03-02T10:00:00Z', 'secret-client')]), { hideProjects: true });
  assert.ok(!JSON.stringify(p).includes('secret-client'));
});
