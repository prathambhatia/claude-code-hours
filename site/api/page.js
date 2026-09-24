import { redis, ID, istDay, isBot, summary } from './_store.js';

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Serves /r/<id>: the normal page, with preview tags so LinkedIn and others show this person's card.
export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const html = await (await fetch(`${url.origin}/`)).text();
  let p = null;
  if (ID.test(id)) {
    // not cached, so every real page load is counted; preview crawlers and scripts are skipped
    const count = isBot(request) ? [] : [['INCR', `stats:views:${istDay()}`], ['INCR', 'stats:views:total']];
    try { const [value] = await redis([['GET', `r:${id}`], ...count]); p = value ? JSON.parse(value) : null; }
    catch { /* the page itself reports the problem */ }
  }
  const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };
  if (!p) return new Response(html, { headers });

  const s = summary(p);
  const title = `${s.total} hours in Claude Code`;
  const desc = `Longest sitting ${s.sitting}. ${s.late} after 10 PM. ${s.streak} in a row. Find yours: npx claude-code-hours`;
  const img = `${url.origin}/r/${id}/card.png`;
  const tags = `<!--og-->
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(`${url.origin}/r/${id}`)}">
<meta property="og:site_name" content="Claude Code Hours">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:secure_url" content="${esc(img)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(`Timesheet stamped with ${s.total} hours in Claude Code`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<!--/og-->`;
  const out = html.replace(/<!--og-->[\s\S]*?<!--\/og-->/, tags).replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  return new Response(out, { headers });
}
