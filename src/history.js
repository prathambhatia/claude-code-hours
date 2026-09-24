import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';

// CLAUDE_CONFIG_DIR moves everything Claude Code keeps in ~/.claude, history included.
export function historyPath(env = process.env) {
  const dir = env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(dir, 'history.jsonl');
}

// Basename that works for both POSIX and Windows paths, whichever OS we run on.
export function projectName(p) {
  if (typeof p !== 'string' || !p.trim()) return '(no folder)';
  const parts = p.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || '(no folder)';
}

function toMillis(ts) {
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts < 1e12 ? ts * 1000 : ts;
  if (typeof ts === 'string') { const n = Date.parse(ts); return Number.isNaN(n) ? null : n; }
  return null;
}

// Only the timestamp and project folder are kept; prompt text is never stored.
export async function readHistory(file) {
  const rows = [];
  let skipped = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(file, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    let o;
    try { o = JSON.parse(line); } catch { skipped++; continue; }
    const t = toMillis(o && o.timestamp);
    if (t === null) { skipped++; continue; }
    rows.push({ t, p: projectName(o.project) });
  }
  return { rows, skipped };
}
