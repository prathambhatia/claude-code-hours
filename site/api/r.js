import { randomInt } from 'node:crypto';
import { validPayload } from './_payload.js';
import { redis, ID, istDay } from './_store.js';

const TTL = 90 * 24 * 3600;      // short links last 90 days
const MAX_BODY = 16 * 1024;
const PER_HOUR = 20;             // new links per IP per hour
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

export async function POST(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'too large' }, 413);
  let p;
  try { p = JSON.parse(text); } catch { return json({ error: 'not json' }, 400); }
  if (!validPayload(p)) return json({ error: 'invalid' }, 400);

  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const bucket = `rl:${ip}:${Math.floor(Date.now() / 36e5)}`;
  // anonymous per-person key from the CLI (a hash), so re-runs replace rather than add to the ranking
  const uid = /^[a-f0-9]{64}$/.test(request.headers.get('x-cch-uid') || '') ? request.headers.get('x-cch-uid') : null;
  let name = null;
  try { name = decodeURIComponent(request.headers.get('x-cch-name') || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60) || null; } catch {}
  const id = Array.from({ length: 7 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  try {
    const [count] = await redis([['INCR', bucket], ['EXPIRE', bucket, '3600']]);
    if (count > PER_HOUR) return json({ error: 'slow down' }, 429);
    const [saved] = await redis([
      ['SET', `r:${id}`, JSON.stringify(p), 'EX', String(TTL), 'NX'],
      ['INCR', `stats:created:${istDay()}`], ['INCR', 'stats:created:total'],
      // link:<id> -> uid (id to name) and rank:link uid -> id (name to latest live link), kept in sync
      ...(uid ? [['ZADD', 'rank:hours', String(p.t / 10), uid], ['HSET', 'rank:seen', uid, istDay()], ['SET', `link:${id}`, uid, 'EX', String(TTL)], ['HSET', 'rank:link', uid, id], ...(name ? [['HSET', 'rank:name', uid, name]] : [])] : []),
    ]);
    if (saved !== 'OK') return json({ error: 'try again' }, 503);
  } catch { return json({ error: 'store unavailable' }, 503); }
  return json({ id, expiresInDays: 90 }, 201);
}

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!ID.test(id)) return json({ error: 'not found' }, 404);
  try {
    const [value] = await redis([['GET', `r:${id}`]]);
    if (!value) return json({ error: 'not found' }, 404, { 'cache-control': 'public, s-maxage=300' });
    const p = JSON.parse(value);
    const [above, n] = await redis([['ZCOUNT', 'rank:hours', `(${p.t / 10}`, '+inf'], ['ZCARD', 'rank:hours']]);
    p.rank = { above: Number(above) || 0, n: Number(n) || 0 };
    // cached at the edge so repeat views of a popular link don't hit the database
    return new Response(JSON.stringify(p), { headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=86400' } });
  } catch { return json({ error: 'store unavailable' }, 503); }
}
