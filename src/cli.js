import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { historyPath, readHistory } from './history.js';
import { compute, hours } from './compute.js';
import { buildPayload, encode } from './payload.js';

const SITE = process.env.CLAUDE_CODE_HOURS_URL || 'https://claude-code-hours.vercel.app/';
const VERSION = '0.1.0';

const HELP = `claude-code-hours - how many hours you've spent in Claude Code

Usage: npx claude-code-hours [options]

  --private         don't save anything online; the numbers go inside a longer link
  --no-open         print the link instead of opening the browser
  --json            print the aggregate data as JSON, don't open anything
  --hide-projects   leave project folder names out of the link
  -h, --help        show this help
  -v, --version     show the version

Reads ~/.claude/history.jsonl (or $CLAUDE_CONFIG_DIR/history.jsonl) on this
computer. Only prompt times and folder names are used; what you typed is never
used or sent. For a short link, the totals (hours, dates, folder names) are
saved for 90 days. Use --private to send nothing.`;

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const bold = s => tty ? `\x1b[1m${s}\x1b[22m` : s;
const red = s => tty ? `\x1b[31m${s}\x1b[39m` : s;
const dim = s => tty ? `\x1b[2m${s}\x1b[22m` : s;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const nice = k => { const [y, m, d] = k.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
const num = (n, d = 1) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

function openUrl(url) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : ['xdg-open', [url]];
  return new Promise(resolve => {
    try {
      const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsVerbatimArguments: process.platform === 'win32' });
      child.on('error', () => resolve(false));
      child.on('spawn', () => { child.unref(); resolve(true); });
    } catch { resolve(false); }
  });
}

// Saves only the aggregate payload; returns null on any failure so the caller can fall back.
async function shortLink(payload) {
  try {
    const res = await fetch(new URL('api/r', SITE), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': `claude-code-hours/${VERSION}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const { id } = await res.json();
    return /^[A-Za-z0-9]{7}$/.test(id) ? new URL(`r/${id}`, SITE).href : null;
  } catch { return null; }
}

export async function main(argv = process.argv.slice(2)) {
  const flags = new Set(argv);
  if (flags.has('-h') || flags.has('--help')) return void console.log(HELP);
  if (flags.has('-v') || flags.has('--version')) return void console.log(VERSION);
  const unknown = argv.filter(a => !['--no-open', '--json', '--hide-projects', '--private'].includes(a));
  if (unknown.length) { console.error(`Unknown option: ${unknown[0]}\n\n${HELP}`); process.exitCode = 2; return; }

  const file = historyPath();
  if (!fs.existsSync(file)) {
    console.error(`No Claude Code history found at ${file}.\n` +
      `Use Claude Code on this computer first, or set CLAUDE_CONFIG_DIR if you keep its files somewhere else.`);
    process.exitCode = 1; return;
  }

  const { rows } = await readHistory(file);
  const agg = compute(rows);
  if (!agg) { console.error(`${file} has no prompts in it yet.`); process.exitCode = 1; return; }

  const payload = buildPayload(agg, { hideProjects: flags.has('--hide-projects') });
  if (flags.has('--json')) return void console.log(JSON.stringify(payload, null, 2));

  const worked = Object.values(agg.days).filter(ms => ms > 0).length;
  const total = hours(agg.total);
  const lines = [
    '',
    `  ${red(bold(`${Math.round(total).toLocaleString('en-US')} hours`))} in Claude Code`,
    '',
    `  First prompt      ${nice(agg.first)}`,
    `  Days worked       ${worked.toLocaleString('en-US')}`,
    `  Per working day   ${num(total / worked)} h`,
  ];
  if (!flags.has('--hide-projects')) {
    lines.push('', `  ${bold('Top projects')}`);
    const top = agg.projects.slice(0, 5), w = Math.max(...top.map(([n]) => n.length), 12);
    for (const [name, ms] of top) lines.push(`  ${name.padEnd(w)}   ${num(hours(ms)).padStart(8)} h`);
  }
  console.log(lines.join('\n') + '\n');

  const privateUrl = `${SITE}#d=${encode(payload)}`;
  let url = privateUrl, note = 'The numbers travel inside the link; nothing was saved online.';
  if (!flags.has('--private')) {
    const short = await shortLink(payload);
    if (short) { url = short; note = 'Saved your totals (not your prompts) for 90 days. Use --private to skip that.'; }
    else note = 'Couldn\'t make a short link, so the numbers travel inside this longer one instead.';
  }
  const opened = !flags.has('--no-open') && await openUrl(url);
  console.log(`  ${opened ? 'Opened' : 'Your timesheet:'} ${url === privateUrl && opened ? 'your timesheet in the browser.' : url}`);
  console.log(dim(`  ${note}\n`));
}
