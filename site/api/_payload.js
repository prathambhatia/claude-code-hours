// Shape check for stored summaries; mirrors expand() in index.html. Anything else is refused.
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isNum = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e9;
const ALLOWED = new Set(['v', 'f', 'l', 'g', 't', 'c', 'd', 'h', 'L', 'n', 'p', 'o']);

export function validPayload(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  if (Object.keys(p).some(k => !ALLOWED.has(k))) return false;
  return p.v === 1 && isDate(p.f) && isDate(p.l) && isDate(p.g) && p.f <= p.l && isNum(p.t) && isNum(p.c)
    && Array.isArray(p.d) && p.d.length > 0 && p.d.length <= 7400 && p.d.every(isNum)
    && Array.isArray(p.h) && p.h.length === 24 && p.h.every(isNum)
    && Array.isArray(p.L) && p.L.length === 3 && isNum(p.L[0]) && isDate(p.L[1]) && isNum(p.L[2])
    && (p.n === null || (Array.isArray(p.n) && p.n.length === 3 && isNum(p.n[0]) && isDate(p.n[1]) && isNum(p.n[2])))
    && (p.p === undefined
      || (Array.isArray(p.p) && p.p.length <= 8 && isNum(p.o)
        && p.p.every(x => Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && x[0].length <= 60 && isNum(x[1]))));
}
