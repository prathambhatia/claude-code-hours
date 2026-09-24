import { timingSafeEqual } from 'node:crypto';
import { redis, ID } from './_store.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function authorised(request) {
  const want = Buffer.from(process.env.ADMIN_KEY || '');
  const got = Buffer.from(request.headers.get('x-admin-key') || '');
  return want.length >= 32 && got.length === want.length && timingSafeEqual(got, want);
}

// Owner-only: trace a short link (/r/<id>) back to the name behind it, via link:<id> -> uid -> rank:name.
async function whois(id) {
  if (!ID.test(id)) return json({ error: 'not found' }, 404);
  const [uid] = await redis([['GET', `link:${id}`]]);
  if (!uid) return json({ id, name: null }); // no ranked run behind this link (no uid, or expired)
  const [name] = await redis([['HGET', 'rank:name', uid]]);
  return json({ id, name: name || null });
}

// Owner-only view of the ranking. Returns shortened ids, never the full hash.
export async function GET(request) {
  if (!authorised(request)) return json({ error: 'not allowed' }, 401);
  const id = new URL(request.url).searchParams.get('id');
  if (id) return whois(id);
  const [ranked, seen, names, links, created, views] = await redis([
    ['ZRANGE', 'rank:hours', '0', '-1', 'REV', 'WITHSCORES'],
    ['HGETALL', 'rank:seen'],
    ['HGETALL', 'rank:name'],
    ['HGETALL', 'rank:link'],
    ['GET', 'stats:created:total'],
    ['GET', 'stats:views:total'],
  ]);
  const last = {};
  for (let i = 0; i < (seen || []).length; i += 2) last[seen[i]] = seen[i + 1];
  const who = {};
  for (let i = 0; i < (names || []).length; i += 2) who[names[i]] = names[i + 1];
  const lastLink = {};
  for (let i = 0; i < (links || []).length; i += 2) lastLink[links[i]] = links[i + 1];
  const uids = [];
  for (let i = 0; i < ranked.length; i += 2) uids.push(ranked[i]);
  // rank:link keeps the latest id even after that short link's 90-day TTL expires,
  // so confirm each one still resolves before showing it as live
  const withLink = uids.map((uid, i) => ({ uid, i, link: lastLink[uid] })).filter(r => r.link);
  const exists = withLink.length ? await redis(withLink.map(r => ['EXISTS', `r:${r.link}`])) : [];
  const live = new Set(withLink.filter((r, i) => Number(exists[i]) === 1).map(r => r.i));
  const rows = uids.map((uid, i) => ({
    id: uid.slice(0, 10),
    name: who[uid] || null,
    hours: Number(ranked[i * 2 + 1]),
    date: last[uid] || null,
    link: live.has(i) ? lastLink[uid] : null,
    you: uid === process.env.OWNER_UID,
  }));
  return json({ rows, sheets: Number(created) || 0, views: Number(views) || 0, at: new Date().toISOString() });
}
