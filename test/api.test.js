process.env.TZ = 'UTC';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validPayload } from '../site/api/_payload.js';
import { compute } from '../src/compute.js';
import { buildPayload } from '../src/payload.js';

const real = () => buildPayload(compute([
  { t: Date.parse('2026-03-02T23:00:00Z'), p: 'shop' },
  { t: Date.parse('2026-03-03T00:10:00Z'), p: 'shop' },
]));

test('the payload the CLI builds is accepted by the server', () => {
  assert.equal(validPayload(real()), true);
  assert.equal(validPayload(buildPayload(compute([{ t: 1e12, p: 'x' }]), { hideProjects: true })), true);
});

test('the server refuses anything outside the expected shape', () => {
  const bad = [
    null, [], 'x',
    { ...real(), extra: 'text' },
    { ...real(), v: 2 },
    { ...real(), f: '<script>' },
    { ...real(), d: ['1'] },
    { ...real(), h: [1, 2, 3] },
    { ...real(), p: [['x'.repeat(61), 1]], o: 0 },
    { ...real(), p: Array(9).fill(['x', 1]), o: 0 },
    { ...real(), t: -1 },
  ];
  for (const p of bad) assert.equal(validPayload(p), false, JSON.stringify(p)?.slice(0, 80));
});
