import zlib from 'node:zlib';
import { dayKey } from './compute.js';

const tenths = ms => Math.round(ms / 36e5 * 10);
const minOfDay = t => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
const TOP = 8;

// Compact, aggregate-only shape. The site's decode() is the other half of this contract.
export function buildPayload(agg, { hideProjects = false } = {}) {
  const d = [];
  const [y, m, dd] = agg.first.split('-').map(Number);
  for (let cur = new Date(y, m - 1, dd); ; cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1)) {
    const k = dayKey(cur.getTime());
    d.push(tenths(agg.days[k] || 0));
    if (k >= agg.last) break;
  }
  const out = {
    v: 1,
    f: agg.first, l: agg.last, g: agg.today,
    t: tenths(agg.total),
    c: agg.prompts,
    d,
    h: agg.hod.map(tenths),
    L: [Math.round(agg.longest.ms / 6e4), dayKey(agg.longest.start), new Date(agg.longest.start).getHours()],
    n: agg.night ? [agg.night.endMin, dayKey(agg.night.start), minOfDay(agg.night.start)] : null,
  };
  if (!hideProjects) {
    out.p = agg.projects.slice(0, TOP).map(([name, ms]) => [name.slice(0, 60), tenths(ms)]);
    out.o = tenths(agg.projects.slice(TOP).reduce((s, [, ms]) => s + ms, 0));
  }
  return out;
}

export function encode(payload) {
  return zlib.deflateRawSync(Buffer.from(JSON.stringify(payload)), { level: 9 }).toString('base64url');
}

export function decode(str) {
  return JSON.parse(zlib.inflateRawSync(Buffer.from(str, 'base64url')).toString());
}
