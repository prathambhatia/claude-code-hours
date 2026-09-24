import { randomInt } from 'node:crypto';
import { validPayload } from './_payload.js';

const TTL = 90 * 24 * 3600;      // short links last 90 days
const MAX_BODY = 16 * 1024;
const PER_HOUR = 20;             // new links per IP per hour
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ID = /^[a-km-np-zA-HJ-NP-Z2-9]{7}$/;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

async function redis(commands) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`store ${res.status}`);
  return (await res.json()).map(r => r.result);
}

export async function POST(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'too large' }, 413);
  let p;
  try { p = JSON.parse(text); } catch { return json({ error: 'not json' }, 400); }
  if (!validPayload(p)) return json({ error: 'invalid' }, 400);

  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const bucket = `rl:${ip}:${Math.floor(Date.now() / 36e5)}`;
  const id = Array.from({ length: 7 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  try {
    const [count] = await redis([['INCR', bucket], ['EXPIRE', bucket, '3600']]);
    if (count > PER_HOUR) return json({ error: 'slow down' }, 429);
    const [saved] = await redis([['SET', `r:${id}`, JSON.stringify(p), 'EX', String(TTL), 'NX']]);
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
    // cached at the edge so repeat views of a popular link don't hit the database
    return new Response(value, { headers: { 'content-type': 'application/json', 'cache-control': 'public, s-maxage=86400' } });
  } catch { return json({ error: 'store unavailable' }, 503); }
}
