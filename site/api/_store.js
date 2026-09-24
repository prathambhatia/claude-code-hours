export const ID = /^[a-km-np-zA-HJ-NP-Z2-9]{7}$/;

export async function redis(commands) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`store ${res.status}`);
  return (await res.json()).map(r => r.result);
}

export async function load(id) {
  if (!ID.test(id)) return null;
  const [value] = await redis([['GET', `r:${id}`]]);
  return value ? JSON.parse(value) : null;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const nice = k => { const [y, m, d] = k.split('-').map(Number); return `${d} ${MON[m - 1]} ${y}`; };
export const clock = m => `${(Math.floor(m / 60) % 12) || 12}:${String(m % 60).padStart(2, '0')} ${m < 720 ? 'AM' : 'PM'}`;

// The headline numbers for previews; same definitions as the page's records.
export function summary(p) {
  const worked = p.d.filter(v => v > 0).length || 1;
  let run = 0, best = 0;
  for (const v of p.d) { run = v > 0 ? run + 1 : 0; best = Math.max(best, run); }
  const all = p.h.reduce((a, b) => a + b, 0) || 1;
  const late = [22, 23, 0, 1, 2, 3].reduce((a, i) => a + p.h[i], 0);
  return {
    total: Math.round(p.t / 10).toLocaleString('en-US'),
    range: `${nice(p.f)} – ${nice(p.l)}`,
    first: nice(p.f),
    prompts: p.c.toLocaleString('en-US'),
    perDay: (p.t / 10 / worked).toFixed(1),
    sitting: `${Math.floor(p.L[0] / 60)}h ${p.L[0] % 60}m`,
    night: p.n ? `till ${clock(p.n[0])}` : 'none yet',
    late: `${Math.round(late / all * 100)}%`,
    streak: `${best} days`,
  };
}
