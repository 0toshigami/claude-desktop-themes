import type { Theme } from '../types'
import { THUMBS } from './thumbs'

// The themes. Each one's own stylesheet, if it has one, is themes/<id>.css: patterns over the window, decorations
// on Claude's parts ([data-cds=AssistantMessage], ...) and reactions to html[data-theme-event=tool|error|done].
export const THEMES: Theme[] = [
  { id: 'claude', name: 'Claude', tagline: "Claude's own colors" },
  {
    id: 'sunset-cloud', name: 'Sunset Cloud',
    tagline: 'A violet dusk, slow clouds, a coral glow rising from the bottom of the window',
    bg: '#2b2030', text: '#f7e8e2', accent: '#ff8a6b',
    vars: {
      'cds-radius': '10px', 'cds-radius-composer': '20px', 'cds-panel-radius': '16px',
      'cds-shadow-sm': '0 2px 10px rgba(255, 138, 107, .10)',
      'cds-shadow-md': '0 6px 22px rgba(255, 138, 107, .14)',
      'cds-shadow-lg': '0 12px 36px rgba(255, 138, 107, .18)',
    },
    status: { idle: '☁ dusk', tool: '☁ {tool}…', error: '⛈ {tool} failed', done: '🌇 done' },
    deco: `<circle cx="200" cy="140" r="60" fill="#ff8a6b" opacity=".18"/>
<ellipse cx="120" cy="40" rx="26" ry="8" fill="#f7e8e2" opacity=".12"/>`,
  },
  {
    id: 'sakura', name: 'Sakura', tagline: 'Falling petals, round corners, a gentle bounce',
    bg: '#fff4f6', text: '#4b2a35', accent: '#e0567f',
    vars: {
      'cds-radius': '14px', 'cds-radius-composer': '24px', 'cds-panel-radius': '22px',
      'cds-shadow-sm': '0 2px 10px rgba(224, 86, 127, .10)',
      'cds-shadow-md': '0 6px 20px rgba(224, 86, 127, .14)',
      'cds-shadow-lg': '0 12px 32px rgba(224, 86, 127, .18)',
      'cds-ease-out': 'cubic-bezier(.34, 1.56, .64, 1)', 'cds-dur-base': '.3s',
    },
    status: { idle: '🌸', tool: '🌸 {tool}…', error: '🥀 {tool} failed', done: '🌸 done' },
    deco: `<g fill="#f4a6bd"><ellipse cx="100" cy="20" rx="5" ry="3" transform="rotate(30 100 20)"/>
<ellipse cx="190" cy="90" rx="5" ry="3" transform="rotate(-20 190 90)"/>
<ellipse cx="130" cy="125" rx="4" ry="2.5" transform="rotate(60 130 125)"/></g>`,
  },
  {
    id: 'terminal', name: 'Terminal', tagline: 'A green phosphor tube: scanlines, glowing text, square corners',
    bg: '#0a110c', text: '#b9f6c6', accent: '#39e87a', font: "'Cascadia Code', Consolas, monospace",
    vars: {
      'cds-radius': '0px', 'cds-radius-composer': '0px', 'cds-panel-radius': '0px',
      'cds-shadow-sm': '0 0 0 1px rgba(57, 232, 122, .25)',
      'cds-shadow-md': '0 0 0 1px rgba(57, 232, 122, .35), 0 0 14px rgba(57, 232, 122, .15)',
      'cds-shadow-lg': '0 0 0 1px rgba(57, 232, 122, .45), 0 0 24px rgba(57, 232, 122, .2)',
      // (snappy, not 0s: a transition of 0s never ends, and parts that wait for its end would stay)
      'cds-dur-base': '40ms', 'cds-dur-slow': '.1s',
    },
    status: { idle: '[SYS] online', tool: '[EXEC] {tool}', error: '[ERR] {tool} failed', done: '[SYS] done' },
    deco: `<g opacity=".25">${Array.from({ length: 35 }, (_, i) => `<rect y="${i * 4}" width="240" height="1" fill="#000"/>`).join('')}</g>`,
  },
  {
    id: 'night-sea', name: 'Night Sea', tagline: 'Stars over a slow wave, for long nights of code',
    bg: '#0f1a2c', text: '#dce6fa', accent: '#5aaeff',
    vars: {
      'cds-radius': '8px', 'cds-radius-composer': '16px', 'cds-panel-radius': '14px',
      'cds-shadow-md': '0 6px 22px rgba(90, 174, 255, .12)',
      'cds-shadow-lg': '0 12px 34px rgba(90, 174, 255, .16)',
    },
    status: { idle: '🌙', tool: '🌊 {tool}…', error: '🌊 {tool} failed', done: '✨ done' },
    deco: `<g fill="#dce6fa"><circle cx="90" cy="18" r="1.2"/><circle cx="170" cy="40" r="1"/><circle cx="215" cy="12" r="1.4"/></g>
<path d="M0 128 Q30 118 60 128 T120 128 T180 128 T240 128 V140 H0 Z" fill="#5aaeff" opacity=".35"/>`,
  },
  {
    id: 'old-paper', name: 'Old Paper', tagline: 'Ivory grain, browned edges, a large first letter like an old book',
    bg: '#f2e9d6', text: '#3a2f22', accent: '#a5522c', font: "Georgia, 'Times New Roman', serif",
    vars: {
      'cds-radius': '3px', 'cds-radius-composer': '4px', 'cds-panel-radius': '4px',
      'cds-shadow-sm': '0 1px 0 rgba(58, 47, 34, .08)',
      'cds-shadow-md': '0 1px 0 rgba(58, 47, 34, .08), 0 6px 14px -6px rgba(58, 47, 34, .25)',
      'cds-shadow-lg': '0 1px 0 rgba(58, 47, 34, .1), 0 12px 24px -8px rgba(58, 47, 34, .3)',
      'cds-dur-base': '.35s',
    },
    status: { idle: '✒', tool: '✒ {tool}…', error: '✒ {tool}: a red ink blot', done: '✒ end of page' },
    deco: `<rect width="240" height="140" rx="10" fill="none" stroke="#8c5f32" stroke-width="10" opacity=".12"/>`,
  },
  // The live wallpapers: a scene the extension draws behind the window (its name in the extension's SCENES), and the
  // look themes/_wallpaper.css gives the page over it (wall-* vars)
  live('moonlit', 'Moonlit', 'A crescent moon, drifting clouds, twinkling stars',
    ['#0d1530', '#dbe2f5', '#d9c98f'], 'radial-gradient(120% 90% at 75% 10%, #1a2a5e, #0d1530 60%, #090f24)',
    'rgba(22, 32, 70, .6)', 'rgba(217, 201, 143, .3)', 'a quiet night to build ☾',
    { idle: '☾', tool: '☾ {tool}…', error: '☁ {tool} failed', done: '✦ done' },
    tiles(grid((x, y) => Math.hypot(x - 25, y - 4) <= 3.3 && Math.hypot(x - 26.4, y - 3.2) > 2.8), '#d9c98f', '#3a3524')
    + tiles(grid((x, y) => ell(x, y, 16, 10, 5, 1.2) <= 1), '#7088d8', '#18214a', 'S')),
  live('clawd', 'Clawd', 'A turning orange spark, drifting embers, Clawd on patrol',
    ['#1f1714', '#f2e6df', '#d97757'], bands(.04, 'radial-gradient(90% 80% at 70% 30%, #3a2219, #1f1714 55%, #150f0d)'),
    'rgba(46, 30, 24, .65)', 'rgba(217, 119, 87, .3)', 'what shall we spark today?',
    { idle: '✳', tool: '✳ {tool}…', error: '✳ {tool} failed', done: '✳ done' },
    tiles(grid((x, y) => {
      const dx = x - 23, dy = y - 6, r = Math.hypot(dx, dy)
      return r <= 1.2 || (r <= 4.5 && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)))
    }), '#d97757', '#3b1d12', '%')
    + tiles(grid((x, y) => y >= 13 && y <= 15 && x >= 12 && x <= 18 && !(y === 15 && x % 2 === 1)), '#d97757', '#3b1d12', '#')
    + tiles([[13, 13], [17, 13]], '#2a1a14', '#d97757', 'o')),
  live('cloud-drift', 'Cloud Drift', 'White clouds over a bright sky, birds gliding by',
    ['#d8ecfa', '#1d3447', '#2f78bd'], bands(.22, 'linear-gradient(#4fa3e8, #86c3f0 55%, #b6dbf6)'),
    'rgba(255, 255, 255, .6)', 'rgba(47, 120, 189, .3)', 'blue skies ahead',
    { idle: '☁', tool: '☁ {tool}…', error: '☂ {tool} failed', done: '☀ done' },
    tiles(grid((x, y) => ell(x, y, 22, 4, 4.5, 1.3) <= 1 || ell(x, y, 13, 11, 4, 1.1) <= 1), '#ffffff', '#9db3c6', ':')),
  live('honu-lagoon', 'Honu Lagoon', 'A sea turtle swimming across a lagoon, light rays and bubbles',
    ['#0f3a44', '#e3f6f2', '#5fd0b8'], bands(.14, 'linear-gradient(#35a6f0, #1d7ad8 45%, #1650b2)'),
    'rgba(15, 58, 68, .6)', 'rgba(95, 208, 184, .3)', 'swim along, slow and steady',
    { idle: '🐢', tool: '🐢 {tool}…', error: '🫧 {tool} failed', done: '🐢 done' },
    tiles(grid((x, y) => ell(x, y, 19, 8, 3, 1.6) <= 1), '#7d9a3e', '#253012', 'X')
    + tiles(grid((x, y) => ell(x, y, 23, 8, .8, .6) <= 1 || ell(x, y, 20, 5.5, 1.2, .5) <= 1 || ell(x, y, 20, 10.5, 1.2, .5) <= 1), '#a3c06e', '#253012')),
  live('koi-pond', 'Koi Pond', 'Koi circling a pond between lily pads, rings on the water',
    ['#11332d', '#e4f2ea', '#ef8a4a'], bands(.12, 'linear-gradient(175deg, #4aa08c, #2f8070 50%, #1f6156)'),
    'rgba(17, 51, 45, .6)', 'rgba(239, 138, 74, .3)', 'still water, clear mind',
    { idle: '◌', tool: '◌ {tool}…', error: '◌ {tool} failed', done: '◎ done' },
    tiles(grid((x, y) => ell(x, y, 19, 9, 2.6, 1) <= 1 || (x === 15 && Math.abs(y - 9) <= 1)), '#e8742c', '#4a1d08')
    + tiles(grid((x, y) => ell(x, y, 26, 4, 2, 1.4) <= 1), '#4f8a3c', '#1d3a14', 'S')),
  live('jellyfish', 'Jellyfish', 'Jellyfish rising through deep water, bells pulsing',
    ['#0a1830', '#dfe7fb', '#a58cf0'], bands(.07, 'linear-gradient(#174784, #0c2b58 50%, #071a3a)'),
    'rgba(12, 28, 58, .6)', 'rgba(165, 140, 240, .3)', 'drifting into deep work',
    { idle: '◠', tool: '◠ {tool}…', error: '◠ {tool} failed', done: '◠ done' },
    tiles(grid((x, y) => (y <= 5 && ell(x, y, 22, 5, 3.2, 2.2) <= 1) || (y > 5 && y < 11 && (x === 20 || x === 22 || x === 24))), '#9a7fe0', '#1a1033', '%')),
  live('lantern-night', 'Lantern Night', 'Paper lanterns drifting down a river at night',
    ['#0b1424', '#efe6d2', '#f2a541'], 'linear-gradient(#070c1c, #24305e 29%, #0e1a30 30%, #08111f 60%, #050a14)',
    'rgba(11, 20, 36, .6)', 'rgba(242, 165, 65, .3)', 'let your ideas drift',
    { idle: '🏮', tool: '🏮 {tool}…', error: '🏮 {tool} went out', done: '🏮 done' },
    tiles(grid((x, y) => y === 4 && x >= 7), '#04070e', '#131c30', ' ')
    + tiles(grid((x, y) => y === 7 && Math.abs(x - 20) <= 2), '#3a1a14', '#170905', ' ')
    + tiles(grid((x, y) => y >= 8 && y <= 10 && Math.abs(x - 20) <= 1), '#ffd889', '#c46a1c', 'S')
    + tiles(grid((x, y) => y === 11 && Math.abs(x - 20) <= 2), '#4a2e1c', '#1e120a', ' ')
    + tiles([[26, 6], [12, 6], [27, 5]], '#f4a347', '#7a3a0c', 't')),
  live('fireflies', 'Fireflies', 'Fireflies wandering and blinking over tall grass',
    ['#0b130e', '#e3eedc', '#d8e86a'], bands(.03, 'radial-gradient(120% 80% at 50% 110%, #1b3522, #0c1710 60%, #070c09)'),
    'rgba(14, 26, 18, .65)', 'rgba(216, 232, 106, .28)', 'a warm glow for late work',
    { idle: '✧', tool: '✧ {tool}…', error: '✧ {tool} failed', done: '✦ done' },
    tiles([[12, 4], [19, 7], [26, 3], [23, 11], [9, 9]], '#e6f26e', '#2c3308')
    + tiles(grid((x, y) => y >= 15), '#3f7d3c', '#16300f', 'S')),
  live('neon-rain', 'Neon Rain', 'Rain over a city at night, neon signs buzzing, umbrellas passing by',
    ['#0c1020', '#e3e8f6', '#ff5fa2'], 'linear-gradient(#05070f, #0b1024 40%, #1e1838 75%, #34203f)',
    'rgba(12, 16, 32, .6)', 'rgba(255, 95, 162, .3)', 'rain outside, code inside',
    { idle: '☔', tool: '☔ {tool}…', error: '⚡ {tool} failed', done: '🌃 done' },
    tiles(grid((x, y) => (y >= 8 && (x <= 10 || x >= 26)) || (y >= 13 && x > 10 && x < 26)), '#1b2242', '#2b355a', 'S')
    + tiles([[8, 10], [10, 12], [27, 9], [28, 12], [14, 14], [22, 14]], '#f3c56b', '#6a4a10')
    + tiles(grid((x, y) => x === 11 && y >= 9 && y <= 12), '#1c0b1a', '#ff5fa2', 'N')),
]

// A live wallpaper's theme: colors [bg, text, accent], the look over its scene, its status line and preview tiles
function live(id: string, name: string, tagline: string, [bg, text, accent]: [string, string, string], sky: string,
  glass: string, rim: string, greet: string, status: NonNullable<Theme['status']>, deco: string): Theme {
  return {
    id, name, tagline, bg, text, accent, wallpaper: id, status, deco,
    vars: {
      'cds-radius': '8px', 'cds-radius-composer': '16px', 'cds-panel-radius': '14px',
      'wall-sky': sky, 'wall-halo': bg, 'wall-glass': glass, 'wall-rim': rim, 'wall-greet': JSON.stringify(greet),
    },
  }
}

// A sky with two soft upright bands of light over it, a of white at their brightest (as light falls through water or
// haze)
function bands(a: number, sky: string) {
  const w = (k: number) => `rgba(255, 255, 255, ${+(a * k).toFixed(3)})`
  return `linear-gradient(90deg, ${w(0)} 16%, ${w(1)} 25%, ${w(0)} 35%, ${w(0)} 66%, ${w(.7)} 77%, ${w(0)} 88%), ${sky}`
}

// Preview tiles, as the wallpapers draw them, on an 8px grid over the preview's window (30 by 17 cells; the first 7
// are its sidebar)
function ell(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
}
function grid(inside: (x: number, y: number) => boolean) {
  const cells: [number, number][] = []
  for (let y = 0; y < 17; y++) for (let x = 7; x < 30; x++) if (inside(x, y)) cells.push([x, y])
  return cells
}
function tiles(cells: [number, number][], fill: string, ink: string, ch = 't') {
  return `<g font-family="Consolas, monospace" font-size="7" font-weight="bold" text-anchor="middle">${cells.map(([x, y]) =>
    `<rect x="${x * 8 + .5}" y="${y * 8 + .5}" width="7" height="7" rx="1" fill="${fill}"/><text x="${x * 8 + 4}" y="${y * 8 + 6.5}" fill="${ink}">${ch}</text>`).join('')}</g>`
}

const mix = (a: string, b: string, k: number) =>
  '#' + [1, 3, 5].map(i => {
    const x = parseInt(a.slice(i, i + 2), 16), y = parseInt(b.slice(i, i + 2), 16)
    return Math.round(x + (y - x) * k).toString(16).padStart(2, '0')
  }).join('')

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)
const px = (v: string | undefined, fallback: number) => (v && /^\d+(\.\d+)?px$/.test(v) ? parseFloat(v) : fallback)

// A small Claude window in the theme's colors and corners: sidebar, a message each way, the prompt box and its send
// button, and the theme's own decoration on top
export const preview = (t: Theme) => {
  const bg = t.bg ?? '#262624', text = t.text ?? '#f5f4ef', accent = t.accent ?? '#d97757'
  const side = mix(bg, text, .04), bubble = mix(bg, text, .1), muted = mix(text, bg, .55)
  const font = esc(t.font ?? "'Segoe UI', sans-serif")
  const r = Math.min(px(t.vars?.['cds-radius'], 6), 11), box = Math.min(px(t.vars?.['cds-radius-composer'], 12), 14)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="140" viewBox="0 0 240 140">
<clipPath id="w"><rect width="240" height="140" rx="10"/></clipPath><g clip-path="url(#w)">
<rect width="240" height="140" fill="${bg}"/>
<rect width="56" height="140" fill="${side}"/>
<rect x="9" y="14" width="38" height="6" rx="3" fill="${accent}"/>
<rect x="9" y="28" width="32" height="5" rx="2.5" fill="${muted}"/>
<rect x="9" y="39" width="36" height="5" rx="2.5" fill="${muted}"/>
<rect x="9" y="50" width="26" height="5" rx="2.5" fill="${muted}"/>
<rect x="148" y="12" width="82" height="22" rx="${r}" fill="${bubble}"/>
<text x="158" y="27" font-family="${font}" font-size="10" fill="${text}">Hi, Claude!</text>
<text x="66" y="54" font-family="${font}" font-size="10" fill="${text}">Hi! What shall we make?</text>
<rect x="66" y="62" width="150" height="5" rx="2.5" fill="${muted}"/>
<rect x="66" y="72" width="120" height="5" rx="2.5" fill="${muted}"/>
<rect x="66" y="102" width="164" height="28" rx="${box}" fill="${bubble}" stroke="${mix(bubble, text, .15)}"/>
<circle cx="216" cy="116" r="8" fill="${accent}"/>
${t.deco ?? ''}</g>
</svg>`
}

// A person's own theme, from <id>.json in their themes folder (and <id>.css beside it): a simple theme only, its
// fields checked as the extension checks them, so nothing it would refuse gets in; undefined for a file that is not one
export const parseUserTheme = (json: string, css?: string): Theme | undefined => {
  let t: Record<string, unknown>
  try { t = JSON.parse(json) } catch { return undefined }
  const str = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max
  const hex = (v: unknown) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
  if (!t || typeof t !== 'object' || typeof t.id !== 'string' || !/^[a-z][a-z0-9-]{1,40}$/.test(t.id)) return undefined
  if (!str(t.name, 60) || !hex(t.bg) || !hex(t.text) || !hex(t.accent)) return undefined
  const vars = Object.fromEntries(Object.entries(t.vars && typeof t.vars === 'object' ? t.vars : {})
    .filter(([k, v]) => /^[a-z][a-z0-9-]{0,80}$/.test(k) && str(v, 500)))
  const s = t.status as Record<string, unknown> | undefined
  const status = s && ['idle', 'tool', 'error', 'done'].every(k => str(s[k], 80))
    ? { idle: String(s.idle), tool: String(s.tool), error: String(s.error), done: String(s.done) } : undefined
  return {
    id: t.id, name: String(t.name), tagline: str(t.tagline, 200) ? String(t.tagline) : '',
    bg: String(t.bg), text: String(t.text), accent: String(t.accent),
    font: str(t.font, 200) ? String(t.font) : undefined, vars, status,
    deco: str(t.deco, 40000) ? String(t.deco) : undefined, css: css || undefined,
  }
}

// A tile for the strip: a wallpaper theme as its scene captured (THUMBS), any other as its small window; a ring in
// its accent when on
export const tile = (t: Theme, on: boolean) => {
  const ring = on ? `<rect x="2" y="2" width="236" height="136" rx="12" fill="none" stroke="${t.accent ?? '#d97757'}" stroke-width="5"/>` : ''
  const shot = t.wallpaper && THUMBS[t.wallpaper]
  if (!shot) return preview(t).replace('</svg>', `${ring}</svg>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="240" height="140" viewBox="0 0 240 140">
<clipPath id="w"><rect width="240" height="140" rx="12"/></clipPath>
<image clip-path="url(#w)" width="240" height="140" preserveAspectRatio="xMidYMid slice" href="${shot}" xlink:href="${shot}"/>${ring}
</svg>`
}
