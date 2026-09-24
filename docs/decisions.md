# Decisions and trade-offs

Written 24/09/2026, alongside the first version. Each section says what was chosen, what it costs,
and what would make us revisit it.

## 1. A CLI plus a static page, not a web upload

Browsers can't read local files unless the user picks them, and the goal was zero picking. So the
CLI reads `history.jsonl` itself and hands the browser only aggregates. The page never sees a raw
timestamp or a prompt.

## 2. `history.jsonl`, not the session transcripts

Transcripts under `~/.claude/projects/` are deleted after 30 days by default (`cleanupPeriodDays`);
`history.jsonl` keeps every prompt ever typed (8 months, about 30k lines, on the test machine).
The cost: history only records *prompts*, not the time Claude spent working after one, so the total
is an estimate of time at the keyboard, not an exact measure.

## 3. The counting method is not described on the site or in the README

Chosen by the owner: the site shows results, not how they're computed. **This is obscurity, not
secrecy.** The npm package ships the counting code minified but readable, and anyone who opens
`dist/claude-code-hours.js` can work it out in minutes. If this repo is ever made public the method
is in `src/compute.js` in plain sight. Don't rely on it staying hidden.

The 15/30/60 gap sensitivity figures were removed from the payload as well as from the page, so a
decoded link doesn't reveal the gap either.

## 4. Short links store summaries on a server (default), `--private` stores nothing

The original design put every number in the URL fragment so nothing was uploaded. The owner asked
for a short link by default, which needs somewhere to keep the numbers. So:

- **Default:** the CLI POSTs the aggregate payload (about 0.6 KB) to `/api/r`, which stores it in
  Upstash Redis for 90 days under a random 7-character id.
- **`--private`:** the old fragment link, about 800 characters. No server ever sees it.
- **If the POST fails for any reason** the CLI quietly falls back to the private long link, so a
  store outage never stops anyone getting a result.

**What this knowingly accepts:**

- **The "nothing is uploaded" promise is gone for the default path.** Whoever can read the Redis
  database can see every stored summary: daily hours, working hours of day, and top 8 folder names.
  Folder names are often client names. There's no account, so a summary isn't tied to a person, but
  the IP that created it is visible to Vercel's request logs.
- **The upload endpoint is public.** Anyone can POST to it, not just the CLI. It accepts only the
  exact payload shape (`site/api/_payload.js`: numbers, dates, and up to 8 strings of up to 60
  characters) and caps each IP at 20 new links an hour. **It can't stop someone putting offensive
  text in a "folder name" and sharing a link on this domain.** There's no report or takedown flow
  yet; removal is a manual `DEL r:<id>` in the Upstash console.
- **Short links die after 90 days.** The page says so, and the downloadable image is the permanent
  copy. The long `--private` link never expires.
- **Free-tier ceiling.** Upstash free is 256 MB and 500k commands a month, with no card on file and
  auto-upgrade explicitly turned off, so it can't bill. Each new link costs 3 commands, each view
  that misses the edge cache costs 1 (GETs are cached for a day). That's roughly 150k new links a
  month before Upstash starts refusing, at which point the CLI falls back to long links.

**Rejected:** Vercel Blob. Its free tier allows 2,000 writes a month, and on Hobby, going over locks
the whole store for 30 days, which would break every existing short link, not just new ones.

**Revisit when:** a link is reported for abuse (build a takedown path); Upstash usage passes 50% of
the free tier; or anyone asks to delete their stored summary (there's no self-serve delete yet).

## 5. Hours are split at clock-hour boundaries

A stretch that runs across midnight is counted partly on each day, and a stretch across a DST change
uses the local clock. Grouping uses the timezone of the machine running the CLI, so the same history
run on a laptop in a different timezone gives different day totals. Accepted: people run it on their
own machine.

## 6. "Latest all-nighter" definition

The latest morning end time (before noon) of a sitting that started on an earlier calendar day. An
earlier version took the latest prompt before 5 AM, which always picked a stray 4:59 AM prompt and
told you nothing. The current rule can still call a sitting from 11:50 PM to 12:10 AM an
"all-nighter"; it just won't be the latest one for anyone who's done a real one.

## 7. Self-hosted font, strict headers

Archivo is served from the site (`site/fonts/`) instead of Google Fonts, so viewing a timesheet
makes no third-party request. The page sends `Referrer-Policy: no-referrer` and a CSP that only
allows same-origin connections. Every field read from a link or from the store is type-checked
before use, and folder names are HTML-escaped: a crafted link with `<img onerror=...>` as a folder
name renders as text (checked manually on 24/09/2026).

## Landmines

- **`site/` is the Vercel project root.** Anything placed there is published. The Upstash
  integration dropped `.agents/`, `.claude/` and `skills-lock.json` into it once, and `vercel link`
  wrote a `.env.local` with an OIDC token there. `site/.vercelignore` now excludes those, but check
  `ls -a site` after any `vercel integration` or `vercel link` command.
- **The payload shape is a contract in three places:** `src/payload.js` (CLI), `site/api/_payload.js`
  (server) and `expand()` in `site/index.html`. Change one, change all three, and bump `v`.
- **`preview.html` in the repo root is gitignored on purpose.** It has one person's real stats and
  folder names baked in.

## 8. Link previews are rendered on the server (added 24/09/2026)

LinkedIn can't attach an image from a share link; it only shows the `og:image` of a URL in the post.
So `/r/<id>` is served by `site/api/page.js`, which adds preview tags pointing at `/api/og?id=<id>`,
and `site/api/og.js` draws the card with `satori` + `@resvg/resvg-js`.

- **`@vercel/og` was tried and dropped.** Its 1.0.3 Node build loads `./hb.wasm` relative to the
  working directory and the file isn't in the package, so it crashed locally and would likely crash in
  a function bundle.
- **Private `#d=` links get no personal preview.** Crawlers never see the fragment. The LinkedIn
  button links to the home page for those and downloads the image for the user to attach.
- **LinkedIn cuts the pre-filled post text at `?` and `#`**, so the button strips both characters.
- Each preview costs one database read on a cache miss; images are cached at the edge for a day.

## 9. Anonymous usage counters, server-side only (added 24/09/2026)

To know whether anyone uses this, the server keeps plain daily counts in Redis:
`stats:created:<IST date>` (short links made) and `stats:views:<IST date>` (short-link page loads),
plus `:total` versions. No ids, IPs or payloads are attached. Read them with `npm run stats`.

- **No analytics script, deliberately.** Vercel Web Analytics was considered. It's cookieless, but it
  adds a script, and ad blockers used by much of this audience block it, so it undercounts.
- **`/r/<id>` pages are no longer edge-cached** (`no-store`) so every load reaches the counter. That
  costs a function run and 3 Redis commands per view instead of a cached response.
- **What these numbers get wrong:** the owner's own views count; bots are filtered only by a
  user-agent regex (`isBot` in `site/api/_store.js`), so unusual crawlers slip through; views of an
  expired or bad id still count; `--private` runs and home-page visits aren't counted at all.
- **Revisit if** views ever threaten the free tier (about 150k views a month uses a third of it):
  re-enable caching on `/r/` and count from the preview image or a beacon instead.
