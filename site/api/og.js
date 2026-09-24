import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { load, summary } from './_store.js';

const PAPER = '#E4EBE3', RULE = '#C3D2C6', INK = '#1C2B4A', INK2 = '#4A5A75', RED = '#B3261E';

// Tiny element builder so this file needs no JSX step.
const el = (style, ...children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: children.flat() } });
const text = (style, value) => ({ type: 'div', props: { style, children: value } });

let fonts;
async function getFonts(origin) {
  if (fonts) return fonts;
  const f = async (file, name, weight) => ({ name, weight, style: 'normal', data: await (await fetch(`${origin}/fonts/og/${file}`)).arrayBuffer() });
  fonts = await Promise.all([
    f('archivo-400.ttf', 'Archivo', 400), f('archivo-600.ttf', 'Archivo', 600),
    f('archivo-800.ttf', 'Archivo', 800), f('archivo-narrow-700.ttf', 'Narrow', 700),
  ]);
  return fonts;
}

const field = (label, value, size, width) => el({ flexDirection: 'column', width, borderBottom: `1px solid ${INK2}`, paddingBottom: 8 },
  text({ fontSize: 18, color: INK2, fontFamily: 'Archivo' }, label),
  text({ fontSize: size, color: INK, fontFamily: 'Archivo', fontWeight: 600, lineHeight: 1.1 }, value));

function card(s) {
  const rules = Array.from({ length: 20 }, (_, i) => el({ position: 'absolute', left: 0, right: 0, top: 31 + i * 32, height: 1, background: RULE }));
  return el({ width: 1200, height: 630, background: PAPER, position: 'relative', flexDirection: 'column', padding: '44px 96px 36px', fontFamily: 'Archivo' },
    rules,
    el({ position: 'absolute', top: 0, bottom: 0, left: 56, width: 1, background: '#A9BDB0' }),
    el({ position: 'absolute', top: 0, bottom: 0, left: 60, width: 1, background: '#A9BDB0' }),
    el({ borderBottom: `2px solid ${INK}`, paddingBottom: 10, width: '100%' },
      text({ fontSize: 30, fontWeight: 800, color: INK }, 'Claude Code Hours')),
    el({ flex: 1, marginTop: 36, justifyContent: 'space-between' },
      el({ flexDirection: 'column', justifyContent: 'space-between' },
        el({ transform: 'rotate(-4deg)', border: `7px solid ${RED}`, borderRadius: 8, padding: '6px 30px 14px', flexDirection: 'column', marginLeft: 10, marginTop: 6 },
          text({ fontFamily: 'Narrow', fontWeight: 700, fontSize: 180, color: RED, lineHeight: 1 }, s.total),
          el({ borderTop: `4px solid ${RED}`, paddingTop: 8, justifyContent: 'space-between', gap: 40 },
            text({ fontSize: 22, fontWeight: 800, color: RED, letterSpacing: 3 }, 'HOURS'),
            text({ fontSize: 22, fontWeight: 800, color: RED, letterSpacing: 2 }, s.range.toUpperCase()))),
        el({ gap: 40 }, field('Prompts sent', s.prompts, 52, 300), field('Every working day', `${s.perDay} h`, 52, 260))),
      el({ flexDirection: 'column', gap: 18, width: 284 },
        field('Longest sitting', s.sitting, 38, 284), field('Latest all-nighter', s.night, 38, 284),
        field('After 10 PM', `${s.late} of hours`, 38, 284), field('Longest streak', `${s.streak} straight`, 38, 284))),
    text({ fontSize: 20, color: INK2, marginTop: 18 }, 'Find yours: npx claude-code-hours'));
}

function home() {
  return el({ width: 1200, height: 630, background: PAPER, flexDirection: 'column', justifyContent: 'center', padding: '0 96px', fontFamily: 'Archivo' },
    text({ fontSize: 30, fontWeight: 800, color: INK }, 'Claude Code Hours'),
    text({ fontSize: 72, fontWeight: 800, color: INK, marginTop: 24, lineHeight: 1.05 }, 'How many hours have you spent in Claude Code?'),
    el({ marginTop: 40, border: `3px solid ${RED}`, borderRadius: 8, padding: '10px 24px', alignSelf: 'flex-start' },
      text({ fontSize: 40, fontWeight: 800, color: RED }, 'npx claude-code-hours')));
}

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  let tree = home(), cache = 'public, s-maxage=604800';
  if (id) {
    let p = null;
    try { p = await load(id); } catch { /* fall back to the home card */ }
    if (p) { tree = card(summary(p)); cache = 'public, s-maxage=86400, max-age=3600'; }
  }
  const svg = await satori(tree, { width: 1200, height: 630, fonts: await getFonts(url.origin) });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(png, { headers: { 'content-type': 'image/png', 'content-length': String(png.length), 'cache-control': cache } });
}
