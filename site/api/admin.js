import { timingSafeEqual } from 'node:crypto';
import { redis } from './_store.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function authorised(request) {
  const want = Buffer.from(process.env.ADMIN_KEY || '');
  const got = Buffer.from(request.headers.get('x-admin-key') || '');
  return want.length >= 32 && got.length === want.length && timingSafeEqual(got, want);
}

// Owner-only view of the ranking. Returns shortened ids, never the full hash.
export async function GET(request) {
  if (!authorised(request)) return json({ error: 'not allowed' }, 401);
  const [ranked, seen, names, created, views] = await redis([
    ['ZRANGE', 'rank:hours', '0', '-1', 'REV', 'WITHSCORES'],
    ['HGETALL', 'rank:seen'],
    ['HGETALL', 'rank:name'],
    ['GET', 'stats:created:total'],
    ['GET', 'stats:views:total'],
  ]);
  const last = {};
  for (let i = 0; i < (seen || []).length; i += 2) last[seen[i]] = seen[i + 1];
  const who = {};
  for (let i = 0; i < (names || []).length; i += 2) who[names[i]] = names[i + 1];
  const rows = [];
  for (let i = 0; i < ranked.length; i += 2) {
    const uid = ranked[i];
    rows.push({ id: uid.slice(0, 10), name: who[uid] || null, hours: Number(ranked[i + 1]), date: last[uid] || null, you: uid === process.env.OWNER_UID });
  }
  return json({ rows, sheets: Number(created) || 0, views: Number(views) || 0, at: new Date().toISOString() });
}
