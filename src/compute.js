const MIN = 60e3;
const GAP = 30 * MIN;
const TAIL = 5 * MIN;

export const dayKey = t => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const minuteOfDay = t => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };

// rows: [{ t: epoch ms, p: folder name }]. All grouping uses the machine's local timezone.
export function compute(rows, now = Date.now()) {
  if (!rows.length) return null;
  rows = [...rows].sort((a, b) => a.t - b.t);

  const days = {}, hod = Array(24).fill(0), proj = {};
  let total = 0, blockStart = rows[0].t;
  let longest = { ms: 0, start: rows[0].t };
  let night = null;

  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i], next = rows[i + 1];
    const joined = next && next.t - cur.t <= GAP;
    const end = joined ? next.t : cur.t + TAIL;

    proj[cur.p] = (proj[cur.p] || 0) + (end - cur.t);
    total += end - cur.t;
    // split at clock-hour edges so days and hours of the day stay exact across midnight and DST
    for (let a = cur.t; a < end;) {
      const d = new Date(a);
      const edge = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime();
      const b = Math.min(end, edge), k = dayKey(a);
      days[k] = (days[k] || 0) + (b - a);
      hod[d.getHours()] += b - a;
      a = b;
    }

    if (!joined) {
      const len = cur.t + TAIL - blockStart;
      if (len > longest.ms) longest = { ms: len, start: blockStart };
      // an all-nighter: a sitting that crossed midnight and finished before noon
      const endMin = minuteOfDay(cur.t);
      if (dayKey(blockStart) < dayKey(cur.t) && endMin < 720 && (!night || endMin > night.endMin))
        night = { endMin, start: blockStart };
      if (next) blockStart = next.t;
    }
  }

  return {
    firstTs: rows[0].t,
    first: dayKey(rows[0].t),
    last: dayKey(rows[rows.length - 1].t),
    today: dayKey(now),
    prompts: rows.length,
    total, days, hod, longest, night,
    projects: Object.entries(proj).sort((a, b) => b[1] - a[1]),
  };
}

export const hours = ms => ms / 36e5;
