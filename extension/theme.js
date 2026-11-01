// desktop-themes: Claude Desktop's theme, changed while it runs. A content script in the extension the /themes strip
// installs (the React DevTools slot, loaded when REACT_PROFILE=1). It reads two files of this extension's folder, which
// the desktop-themes mod rewrites:
// - theme.json, each second: { id, bg, text, accent, font?, vars?, wallpaper?, motion?, speed?, cell?, veil?, css? }, {} for Claude's own. The three colors become
//   Claude's design tokens (--cds-*, plain colors) and its older ones (--bg-*, --text-*, --accent-brand, "H S% L%");
//   vars sets any other custom property (--cds-radius, --cds-shadow-md, ...); css is the theme's own stylesheet.
// - event.json, 3 times a second: { n, kind, tool, state, at }. A new n marks <html> with data-theme-event (kind:
//   tool, error or done) and data-theme-tool for 1.2 s, and with data-theme-state (state: thinking or waiting) until
//   the next, for the theme's css to react to.
// <html data-theme="<id>"> marks the theme while one is on.
(() => {
  const read = name => fetch(chrome.runtime.getURL(name), { cache: 'no-store' }).then(r => r.text());
  const root = document.documentElement;

  const ok = c => /^#[0-9a-f]{6}$/i.test(c);
  const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255);
  const hex = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k); // k of the way from a to b
  const hsl = ([r, g, b]) => {
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2, d = hi - lo;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    const h = !d ? 0 : hi === r ? ((g - b) / d + 6) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return `${Math.round(h * 60)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
  };
  const luma = ([r, g, b]) => .2126 * r + .7152 * g + .0722 * b;

  // The page is the person's logged-in Claude: a theme's CSS may load nothing from outside it. Refused whole: @import,
  // url() of anything but data:, image-set(), old script hooks, and backslashes (CSS escapes could spell url( past this;
  // write the character itself instead).
  const safe = css => typeof css === 'string' && css.length <= 200000 && !/\\/.test(css)
    && !/@import|image-set|expression\s*\(|-moz-binding|behavior\s*:|javascript:/i.test(css)
    && !/url\(\s*(?!['"]?data:)/i.test(css);

  const varsOf = t => {
    const vars = [];
    if (ok(t.bg) && ok(t.text) && ok(t.accent)) {
      const bg = rgb(t.bg), tx = rgb(t.text), ac = rgb(t.accent);
      const at = (a, b, k) => hex(mix(a, b, k));
      const second = at(tx, bg, .35), muted = at(tx, bg, .55), hover = at(ac, tx, .15), tint = at(bg, ac, .15);
      const on = luma(ac) > .55 ? '#000000' : '#ffffff';
      const cds = {
        'page-bg': t.bg, 'surface-0': t.bg, 'surface-1': at(bg, tx, .03), 'surface-2': at(bg, tx, .06), 'surface-3': at(bg, tx, .09),
        'neutral-900': t.text, 'neutral-600': second, 'neutral-400': muted,
        'text-primary': t.text, 'undimmed-text-primary': t.text,
        'text-secondary': second, 'undimmed-text-secondary': second, 'text-stays-secondary': second, 'undimmed-text-stays-secondary': second,
        'text-muted': muted, 'undimmed-text-muted': muted,
        'role-accent-450': t.accent, 'role-accent-fill': t.accent, 'fill-accent': t.accent, 'text-accent': t.accent,
        'clay': t.accent, 'clay-emphasized': t.accent, 'fill-brand': t.accent,
        'role-accent-400': hover, 'role-accent-fill-hover': hover, 'fill-accent-hover': hover, 'fill-brand-hover': hover,
        'role-accent-on': on, 'on-accent': on, 'on-brand': on,
        'bg-accent': tint, 'role-accent-100': tint, 'role-accent-800': tint,
      };
      for (const [k, v] of Object.entries(cds)) vars.push([`cds-${k}`, v]);
      // for the parts that paint a fixed color (the mod's themes/_base.css): the sidebar's, for one
      vars.push(['desktop-theme-backdrop', at(bg, tx, .04)]);
      // ponytail: one ramp for light and dark themes alike (bg-100 the window, the rest a step toward the text);
      // Claude's own ramps differ by mode, so a theme against the app's mode may look flat in places
      [.06, 0, .03, .05, .08, .1].forEach((k, i) => vars.push([`bg-${i}00`, hsl(mix(bg, tx, k))]));
      [0, 0, .25, .25, .5, .5].forEach((k, i) => vars.push([`text-${i}00`, hsl(mix(tx, bg, k))]));
      for (const k of ['accent-brand', 'brand-100', 'accent-000', 'accent-100', 'accent-200']) vars.push([k, hsl(ac)]);
    }
    // (a font installed on this computer, by name: letters, digits, spaces, commas, quotes and dashes)
    if (typeof t.font === 'string' && /^[\w\s,"'-]{1,200}$/.test(t.font))
      for (const k of ['cds-font-sans', 'cds-font-sans-display', 'font-anthropic-sans', 'font-anthropic-serif', 'font-sans'])
        vars.push([k, t.font]);
    // (any other custom property: a plain value, no ; { } < > and the same url() rule as the css)
    for (const [k, v] of Object.entries(t.vars ?? {}))
      if (/^[a-z][a-z0-9-]{0,80}$/.test(k) && typeof v === 'string' && v.length <= 500 && !/[;{}<>]/.test(v) && safe(v))
        vars.push([k, v]);
      else console.warn('desktop-themes: var refused', k);
    return vars;
  };

  // Claude's own colors, for whatever a theme leaves alone, follow its light or dark mode: the page takes the theme's
  // mode, so they read on its background (a light theme in the dark mode left white writing and dark tooltips on
  // pink). The app's own value is kept beside it, data-theme-was-mode, and comes back with Claude's own colors; a
  // value the app sets meanwhile (its appearance setting changed) is kept there too.
  // (only light, dark and system: data-mode means other things too, data-mode=code on the recents list)
  let mode;
  const MODES = '[data-mode=light],[data-mode=dark],[data-mode=system]';
  // (data-theme-set-mode marks the value this script put there: a theme changed for another is not the app's)
  const syncMode = () => {
    for (const el of document.querySelectorAll(MODES)) {
      if (mode && el.dataset.mode !== mode) {
        if (el.dataset.mode !== el.getAttribute('data-theme-set-mode')) el.setAttribute('data-theme-was-mode', el.dataset.mode);
        el.dataset.mode = mode;
        el.setAttribute('data-theme-set-mode', mode);
      } else if (!mode && el.hasAttribute('data-theme-was-mode')) {
        el.dataset.mode = el.getAttribute('data-theme-was-mode');
        el.removeAttribute('data-theme-was-mode');
        el.removeAttribute('data-theme-set-mode');
      }
    }
  };
  let queued = false; // (once a frame at most: a streaming reply changes the page many times a second)
  new MutationObserver(() => {
    if (queued || !mode) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; syncMode(); });
  }).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-mode'] });

  // The live wallpapers: a scene drawn in characters on a canvas under the page (z-index -1; the theme's css makes the
  // page's own background see-through and paints the sky on <html>). A grid of cells: a shape's cells are tiles, a
  // colored square with a dark character, and loose faint characters glow around it; the characters keep changing.
  // What stays in place (stars, a moon, grass) is drawn cell by cell on the grid; what moves (clouds, a turtle, koi) is
  // a sprite, a small picture in characters drawn at any point between cells, so it glides. Thirty frames a second; a
  // page that asks for less motion gets one still frame. Scenes are code here, picked by name (theme.json's
  // wallpaper): nothing in theme.json runs on the person's logged-in page.
  // (CELL: a cell's size in pixels, theme.json's cell: 22, 18 or 14; scenes are drawn in cells, so a smaller one draws
  // them smaller, not finer)
  let CELL = 22;
  const GLYPHS = 'St%;:X', LOOSE = ".:',o";
  const hash = (a, b, c = 0) => {
    let h = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  // (a cell's character, changing about once a second, each cell on its own beat)
  const glyph = (set, x, y, t) => set[Math.floor(hash(x, y, Math.floor(t * 1.2 + hash(y, x) * 7)) * set.length)];

  // Shapes on the grid, in cells. ell: how far a cell is inside an ellipse (1 its edge); drift: the middle of
  // something w cells wide that crosses the window left to right at v cells a second and comes round again (f where it
  // starts); near: a loose character on some of the cells; twinkle: a star; rising: specks drifting up
  const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
  const drift = (cols, f, t, v, w) => { const span = cols + w * 2; return ((f * span + t * v) % span) - w; };
  const near = (x, y, fg, a = .3, odds = .5) => (hash(x, y, 3) < odds ? { fg, a } : undefined);
  const twinkle = (x, y, t, fg, odds) => {
    const s = hash(x, y, 9);
    if (s < odds) return { ch: s < odds / 3 ? '+' : '.', fg, a: .2 + .5 * (.5 + .5 * Math.sin(t * (1 + s * 200) + s * 1000)) };
  };
  const rising = (x, y, t, v, odds) => hash(x, Math.floor(y + t * v), 11) < odds;

  // Sprites. A picture is rows of characters, '.' for nothing and each other character a key of its palette:
  // { bg, fg, a } a tile, { fg, a, ch? } a loose character. sketch: a w × h picture from pieces [row, column, text]
  // (a space in the text leaves what is there); shape: one from a test of each cell; flip: the picture facing the
  // other way; frame: one of several pictures, in turn, rate a second; tint: a palette of shades of one color
  const sketch = (w, h, parts) => {
    const g = Array.from({ length: h }, () => Array(w).fill('.'));
    for (const [r, c, s] of parts) [...s].forEach((ch, i) => { if (ch !== ' ' && g[r]?.[c + i]) g[r][c + i] = ch; });
    return g.map(r => r.join(''));
  };
  const shape = (w, h, at) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => at(x, y)).join(''));
  const flip = art => art.map(r => [...r].reverse().join(''));
  const frame = (frames, t, rate, phase = 0) => frames[Math.floor(t * rate + phase) % frames.length];
  const shade = (c, k) => hex(mix(rgb(c), k > 0 ? [1, 1, 1] : [0, 0, 0], Math.abs(k)));
  const tint = (bg, fg, alphas) => Object.fromEntries(alphas.map((a, i) => [String(i + 1), { bg, fg, a }]));
  // (the loose characters around a picture: the empty cells beside its tiles, about half of them; worked out once)
  const halos = new WeakMap();
  const haloOf = art => {
    if (!halos.has(art)) {
      const on = (x, y) => (art[y]?.[x] ?? '.') !== '.', out = [];
      for (let y = -1; y <= art.length; y++)
        for (let x = -1; x <= art[0].length; x++)
          if (!on(x, y) && [-1, 0, 1].some(i => [-1, 0, 1].some(j => on(x + i, y + j))) && hash(x + 50, y + 50, 5) < .45) out.push([x, y]);
      halos.set(art, out);
    }
    return halos.get(art);
  };

  // A cloud w cells wide, long and low with a puff on top (the night's); its key 1 to 4, dim at the back to bright at
  // the front, the way it drifts
  const clouds = new Map();
  const cloudArt = w => {
    if (!clouds.has(w)) {
      const cx = w / 2, inside = (x, y) => Math.min(ell(x, y, cx, 3, w / 2, 1.6), ell(x, y, cx + w * .1, 1.4, w * .28, 1.2)) <= 1;
      clouds.set(w, shape(w + 1, 6, (x, y) => (inside(x, y) ? String(1 + Math.min(3, Math.floor(4 * x / (w + 1)))) : '.')));
    }
    return clouds.get(w);
  };
  // (a dot pattern on the right of the window, as light on water)
  const matrix = (x, y, cols, fg) => (x > cols * .82 && y % 2 === 0 && hash(x, y, 90) < .55 ? { ch: '-', fg, a: .14 } : undefined);

  // The pictures
  const CLAWD = ['.#######.', '.#o###o#.', '#########', '.#######.'];
  const CLAWDS = [[...CLAWD, '.#.#.#.#.'], [...CLAWD, '#.#.#.#..']];
  // a jellyfish: a dome with two bright spots, a rim flared wider than it, a skirt below, and six long straight
  // tentacles of tiles broken by gaps and loose rings; its bell squeezes and relaxes in two frames
  const jelly = ph => sketch(13, 22, [
    ...(ph ? [[0, 4, 'BBBBB'], [1, 2, 'BBBBBBBBB'], [2, 1, 'BBpBBBBBpBB'], [3, 0, 'RRRRRRRRRRRRR']]
      : [[0, 3, 'BBBBBBB'], [1, 1, 'BBBBBBBBBBB'], [2, 1, 'BBpBBBBBpBB'], [3, 1, 'RRRRRRRRRRR']]),
    [4, 3, 'kkkkkkk'],
    ...[1, 3, 5, 7, 9, 11].flatMap((c, k) => Array.from({ length: 16 }, (_, i) => {
      const r = hash(k, i, 7);
      return r < .18 ? [] : [[5 + i, c, r < .42 ? 'o' : 'l']];
    }).flat()),
  ]);
  const JELLIES = [jelly(0), jelly(1)];
  const jellyPal = c => ({
    B: { bg: c, fg: shade(c, -.6), a: .72 }, p: { bg: shade(c, .55), fg: c, a: .85 }, R: { bg: shade(c, .15), fg: shade(c, -.6), a: .78 },
    k: { bg: shade(c, -.15), fg: shade(c, -.65), a: .6 }, l: { bg: c, fg: shade(c, -.6), a: .62 }, o: { ch: 'o', fg: shade(c, .3), a: .5 },
  });
  // a firefly: one bright cell, a soft glow round it, a loose spark or two
  const FLIES = [['a..', '.Y.', '..c'], ['..b', '.Y.', '...'], ['...', '.Y.', 'b.a']];
  const FLY_PAL = { Y: { bg: '#e9f57a', fg: '#2c3308', a: 1 }, a: { ch: ':', fg: '#e9f57a', a: .55 }, b: { ch: "'", fg: '#e9f57a', a: .55 }, c: { ch: 'o', fg: '#e9f57a', a: .4 } };
  // a shooting star going down to the right: a bright head and a tail fading behind it, up and to the left (each
  // tail character on its own key, brightest nearest the head); and its twin going left
  const METEOR = sketch(8, 4, [[0, 0, '11'], [1, 2, '22'], [2, 4, '33'], [3, 6, '4H']]);
  const METEORS = [METEOR, flip(METEOR)];
  const meteorPal = ch => ({
    H: { bg: '#fff6d0', fg: '#3a3524', a: 1 }, 4: { ch, fg: '#fff6d0', a: .85 }, 3: { ch, fg: '#fff6d0', a: .6 },
    2: { ch, fg: '#dbe2f5', a: .4 }, 1: { ch, fg: '#dbe2f5', a: .2 },
  });
  const METEOR_PALS = [meteorPal('\\'), meteorPal('/')];
  // (one comes every SKYFALL seconds, at its own place and way, and crosses in FALL seconds)
  const SKYFALL = 12, FALL = 1.5;
  const meteor = (cols, rows, t) => {
    const k = Math.floor(t / SKYFALL), p = (t - k * SKYFALL) / FALL;
    if (p >= 1) return [];
    const left = hash(k, 3) < .5, run = 26 * p; // (cells along its way so far)
    const hx = cols * (.25 + .5 * hash(k, 1)) + (left ? -run : run), hy = rows * (.05 + .25 * hash(k, 2)) + run * .5;
    return [{ art: METEORS[+left], pal: METEOR_PALS[+left], key: 40, a: Math.sin(Math.PI * p),
      x: left ? hx : hx - 7, y: hy - 3 }];
  };
  const BIRDS = [['v'], ['^']], BIRD_PAL = { v: { ch: 'v', fg: '#3f6280', a: .8 }, '^': { ch: '^', fg: '#3f6280', a: .8 } };
  const FLOCK = [[0, 0], [2, -1], [4, 0], [1.5, 1.5]];

  // (x and y as parts of the window, width in cells, cells a second)
  const CLOUDS = [[.08, .14, 26, .6], [.55, .36, 22, .45], [.3, .6, 24, .5], [.85, .8, 18, .7]];
  const NIGHT = tint('#7088d8', '#18214a', [.35, .5, .65, .82]);
  const JELLY = [[.25, '#9a7fe0', .6, .7], [.82, '#ef8f63', .9, .95], [.06, '#ec92c6', .75, .9], [.55, '#7fb4ef', 1.1, .6]]
    .map(([x, c, v, a]) => [x, jellyPal(c), v, a]);

  // A cloud of a bright sky, from its seed, one of four kinds by seed % 4: heaped (a few domes on a flat base), a long
  // thin streak, a small puff, or a tall tower (one big dome between two smaller); its tiles brightest on top and
  // greyer toward its base (keys 4 to 1), its top edge ragged
  const skies = new Map();
  const skyArt = seed => {
    if (!skies.has(seed)) {
      const r = j => hash(seed, j, 3), kind = seed % 4;
      // (each kind: how many domes, their radii, from the middle one out, and the base's thickness in rows)
      const [n, R0, R1, base] = [[3 + Math.floor(r(2) * 2), 2.4, 4.2, 1], [6 + Math.floor(r(2) * 3), 1.1, 1.8, 1],
        [2, 1.6, 2.4, 1], [3, 2.6, 5.2, 2]][kind];
      // (domes walked left to right, each overlapping the last, the middle ones biggest)
      const domes = [];
      for (let i = 0, cx = 0; i < n; i++) {
        const mid = 1 - Math.abs(i - (n - 1) / 2) / Math.max(1, (n - 1) / 2), R = R0 + (R1 - R0) * (kind === 3 ? mid ** 2 : mid * .6 + r(10 + i) * .4);
        cx = i ? cx + R * .95 : R;
        domes.push([cx, R]);
        cx += R * .45;
      }
      const W = domes[n - 1][0] + domes[n - 1][1], lift = x => Math.max(0, ...domes.map(([cx, R]) => (Math.abs(x - cx) < R ? Math.sqrt(R * R - (x - cx) ** 2) * .75 : 0)));
      const H = Math.ceil(Math.max(...domes.map(d => d[1])) * .75 + base);
      skies.set(seed, shape(Math.ceil(W) + 1, H, (x, y) => {
        const up = H - 1 - y, h = Math.ceil(base + lift(x + .5) - .35); // (rows above the bottom one; this column's height)
        const end = x + .5 < domes[0][0] - domes[0][1] * .7 || x + .5 > domes[n - 1][0] + domes[n - 1][1] * .7;
        if (up >= h || (end && up >= base) || (up === h - 1 && h > 2 && hash(seed * 7 + x, 1, 4) < .25)) return '.';
        return String(1 + Math.min(3, Math.floor(4 * up / H)));
      }));
    }
    return skies.get(seed);
  };
  const DAY_TOPS = {
    4: { bg: '#ffffff', fg: '#9db3c6', a: .96 }, 3: { bg: '#f2f6fa', fg: '#93a9bd', a: .93 },
    2: { bg: '#e0e9f1', fg: '#869cb0', a: .9 }, 1: { bg: '#cad7e3', fg: '#7a90a4', a: .86 },
  };
  // a thin high streak of cirrus, loose characters only
  const WISP = ['~-~~.~~-~~~.-~', '..~~-~.~~~....'], WISP_PAL = { '~': { ch: '~', fg: '#ffffff', a: .55 }, '-': { ch: '-', fg: '#ffffff', a: .45 } };
  // ([seed, x and y as parts of the window, cells a second, strength]) far clouds: small and dim, high and slow; near
  // ones: big, bright, low and fast, crossing in front of the birds; wisps: highest and fastest
  const FAR = [[2, .1, .14, .8, .65], [5, .55, .08, .95, .6], [6, .8, .3, .75, .65], [9, .35, .3, .85, .6], [10, .95, .2, 1, .65]];
  const NEAR = [[0, .15, .48, 1.6, 1], [3, .62, .42, 1.9, 1], [4, .88, .72, 1.7, 1], [7, .36, .78, 2.2, 1], [8, .05, .86, 1.5, 1]];
  const CIRRUS = [[.2, .05, 2.6], [.7, .13, 2.2]];
  const skySprite = (cols, rows, t) => ([seed, fx, fy, v, a]) => {
    const art = skyArt(seed), w = art[0].length;
    return { art, pal: DAY_TOPS, a, halo: '#ffffff', x: drift(cols, fx, t, v, w) - w / 2, y: fy * rows - art.length / 2, key: seed };
  };

﻿  // (from the reference picture: 97 by 47 cells, 56 colors, keyed 0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRST)
  const REEF_COLORS = ["#2b9ee6","#53ddf9","#06aceb","#69ebfa","#e1f6f5","#21bbef","#3074ee","#007cef","#0499eb","#05befa","#1ccaf9","#01b5fa","#0281e1","#7c4d36","#033a9a","#40b9cd","#e5b77f","#01adf9","#0188f4","#946a62","#cbd5ac","#2561a5","#101b29","#b7a976","#35d4f9","#043a78","#01a0f9","#f4e9bf","#0163da","#01a6f8","#0191f8","#874fe2","#0142a9","#6e7cc9","#015ad2","#016ce4","#0198f8","#f3688c","#0488b8","#116c66","#9bf4f7","#0155ca","#014ec1","#f6cc38","#373b95","#5fc04f","#08508b","#0148b7","#ee7e3a","#163b5d","#a8a7e3","#3b9662","#555cba","#f6e5ab","#97df4f","#1f2d89"];
  const REEF_W = 97, REEF_H = 47;
  const REEF_THINGS = {
    turtle: { c: 24, r: 10, art: ['.........................', '.......ppjMMNN.....pKpK..', '.....pMMjnddjdj..pRPmRPN.', '...NMdndjddd4dddNRPkmDDp.', '..jdgdk44ddjmDPSgRDkRRR..', '.jndddddNPDDJJSSRrRRkp...', '..ddpPRRSSDDNSRrnnpC.....', '.DnRRRRgkDDDNrrRkPSSC....', '..KnngDDDDDngggp.DDJRp...', '.....kDkDPk.......NJSR...', '....PDPjDR.........nDPN..', '...RPDnRK...........gDN..', '..P..Rp..............pC..', '.........................'] },
    clownA: { c: 11, r: 20, art: ['........', '..dmMP..', '.M4M44M.', '.ddM4dM.', '........'] },
    clownB: { c: 16, r: 24, art: ['.........', '....pM...', '.LlMM4MC.', '.mM4MM4M.', '.........'] },
    tang: { c: 26, r: 27, art: ['.........', '...pp....', '.y6eeeFP.', '.66666pH.', '.........'] },
    yellow: { c: 48, r: 20, art: ['............', '........HP..', '.......HHHH.', '...DH...Hj..', '..HHHH......', '...HH...lHH.', '........HHH.', '............'] },
    crab: { c: 29, r: 42, art: ['BmgjM.', '.MMMdg', 'M..jM.', 'j.....'] },
    idolA: { c: 61, r: 19, art: ['.......', '....4..', '..mR...', '.4mrmH.', '.4m4m..', '..m4...', '.......'] },
    idolB: { c: 63, r: 25, art: ['........', '...4....', '..m.....', '.4m.mH..', '.rm4N...', '..m44...', '........'] },
    star: { c: 3, r: 35, art: ['............', '.....M......', '............', '..MMMMMMM...', '..MMMMHM....', '....MMMM....', '...MM..MM...', '............', '............'] },
    weedL: { c: 0, r: 10, art: ['........', '........', '.P......', '.JN.....', '..J.....', '...J....', '...J.D..', '..J..J..', '.JD.JJ..', '.JD.P.DN', '..PPD..S', '..JJ..JS', '.JP..DS.', '.PD.DS..', '.P.DJJ.S', '...P.P.S', '....D.JJ', '......J.', '........', '........', '........', '........', '........', '........'] },
    weedM: { c: 16, r: 31, art: ['..........', '..........', '..J.......', '..J..DJ...', '...J..S...', '..JJ.JP...', '..J.JP....', '..P.DD.D..', '...P.P.J..', '....D.PD..', '.....DP...'] },
    weedR: { c: 87, r: 17, art: ['..........', '..........', '..........', '..........', '......J.J.', '....J.PJJ.', '....J..JD.', '.....JJ.J.', '......J.J.', '......P...', '..........', '..........', '..........', '..........'] },
  };
  // The lagoon's creatures, lifted from a reference picture of a reef, each kept where the picture has it (the
  // picture laid over the window right of the sidebar, SIDE cells, and stretched to it); clear water around them
  const REEF_KEYS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const REEF_PAL = Object.fromEntries(REEF_COLORS.map((c, i) => [REEF_KEYS[i], { bg: c, fg: shade(c, -.1), a: .96 }]));
  const placeOf = (th, cols, rows) => [SIDE + th.c * (cols - SIDE) / REEF_W, th.r * rows / REEF_H];
  // Their frames, made from the one picture each has by moving some of its cells. nudge: the cells where
  // pick(x, y, key) holds, moved by (dx, dy); parts: a picture split into its separate pieces (the yellow fish, three
  // in one picture), each with its offset in it
  const nudge = (art, pick, dx, dy) => {
    const g = art.map(r => [...r]), moved = [];
    art.forEach((row, y) => [...row].forEach((k, x) => { if (k !== '.' && pick(x, y, k)) { moved.push([x + dx, y + dy, k]); g[y][x] = '.'; } }));
    for (const [x, y, k] of moved) if (g[y]?.[x] !== undefined) g[y][x] = k;
    return g.map(r => r.join(''));
  };
  const parts = art => {
    const seen = new Set(), out = [];
    art.forEach((row, y) => [...row].forEach((k, x) => {
      if (k === '.' || seen.has(`${x},${y}`)) return;
      const cells = [], todo = [[x, y]];
      seen.add(`${x},${y}`);
      while (todo.length) {
        const [cx, cy] = todo.pop();
        cells.push([cx, cy]);
        for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]])
          if ((art[ny]?.[nx] ?? '.') !== '.' && !seen.has(`${nx},${ny}`)) { seen.add(`${nx},${ny}`); todo.push([nx, ny]); }
      }
      const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]), x0 = Math.min(...xs), y0 = Math.min(...ys);
      const own = shape(Math.max(...xs) - x0 + 1, Math.max(...ys) - y0 + 1, (px, py) => (cells.some(([a, b]) => a === px + x0 && b === py + y0) ? art[py + y0][px + x0] : '.'));
      if (cells.length > 2) out.push({ dx: x0, dy: y0, art: own });
    }));
    return out;
  };
  // (a fish's tail beating: its back third up a row, then down; tail on the left when it faces right)
  const wag = (art, facesRight) => {
    const w = art[0].length, tail = (x) => (facesRight ? x < w * .36 : x >= w * .64);
    return [art, nudge(art, x => tail(x), 0, -1), art, nudge(art, x => tail(x), 0, 1)];
  };
  const both = frames => [frames, frames.map(flip)]; // ([as drawn, facing the other way])
  const T0 = REEF_THINGS;
  const REEF_FRAMES = {
    clownA: both(wag(T0.clownA.art, true)), clownB: both(wag(T0.clownB.art, true)),
    tang: both(wag(T0.tang.art, false)), idolA: both(wag(T0.idolA.art, false)), idolB: both(wag(T0.idolB.art, false)),
    yellow: parts(T0.yellow.art).map(p => ({ ...p, frames: wag(p.art, false) })),
    // (the turtle's flippers, the rows below its shell, outline and all, sweeping back and forward)
    turtle: (() => {
      const a = T0.turtle.art, fl = (x, y) => y >= a.length * .64;
      return [a, nudge(a, fl, -1, 0), nudge(a, fl, -1, 1), nudge(a, fl, 0, 1)];
    })(),
    // (the crab's legs stepping and claws raised by turns)
    crab: (() => {
      const a = T0.crab.art, h = a.length;
      return [a, nudge(nudge(a, (x, y) => y === h - 1, 1, 0), (x, y) => y === 0, 0, -1), a, nudge(a, (x, y) => y === h - 1, -1, 0)];
    })(),
    // (the starfish lifting one arm tip now and then)
    star: (() => { const a = T0.star.art; return [a, a, a, nudge(a, (x, y) => y <= 1, 0, -1)]; })(),
  };
  // (seaweed swaying: each row shifted, more toward its top)
  const swaying = (art, t, i) => ({
    w: art[0].length + 4, h: art.length,
    field: (gx, gy) => {
      const off = Math.round(Math.sin(t * 1.2 + gy * .45 + i * 2) * 1.3 * (art.length - gy) / art.length), k = art[gy][gx - 2 - off];
      return k && k !== '.' ? { c: REEF_PAL[k], sx: gx - 2 - off, sy: gy } : undefined;
    },
  });

  // The pond's koi, three kinds (Kohaku white and red, Showa white, black and red, Ogon gold), from above and big: a
  // body round a spine (the places its head has just been, a cell apart), a darker rim, eyes, two side fins that
  // paddle, two small ones behind, and a long forked tail that swishes; its patches are laid on by place along it
  // (u) and across it (v), so they stay on it as it bends
  const CARP_R = [1.8, 2.8, 3.4, 3.8, 3.9, 3.9, 3.7, 3.4, 3, 2.6, 2.2, 1.8, 1.4, 1.1, .9, .8], CARP_LEN = CARP_R.length + 5;
  const CARP_PAL = (() => {
    const p = {
      w: { bg: '#f3eee5', fg: '#a59f94', a: .95 }, r: { bg: '#de3a2a', fg: '#6e140c', a: .95 }, k: { bg: '#1f1c1b', fg: '#6a6560', a: .95 },
      g: { bg: '#f2b52c', fg: '#7a5208', a: .95 }, l: { bg: '#f8d769', fg: '#8a6110', a: .95 }, e: { bg: '#120c0a', fg: '#5a504a', a: .97 },
      f: { bg: '#e6e2d8', fg: '#9a948a', a: .78 }, F: { bg: '#f5cc4f', fg: '#8a6110', a: .8 },
    };
    for (const k of 'wrkgl') p[k.toUpperCase() + '_'] = { ...p[k], bg: shade(p[k].bg, -.16) }; // (the rim)
    return p;
  })();
  // (each kind: its patches as [u, v, radius, key] over a base color, and its fin color)
  const CARP_KINDS = [
    { base: 'w', fin: 'f', spots: [[2, .6, 1.3, 'r'], [5.5, 1.6, 1.9, 'r'], [9.5, -1.3, 1.8, 'r'], [13, .8, 1.2, 'r']] },
    { base: 'w', fin: 'f', spots: [[1, 0, 1.5, 'r'], [3.5, -1.6, 1.9, 'k'], [6, 1.2, 2.2, 'r'], [8, 2, 1.6, 'k'], [10, -1, 2, 'r'], [12, -.6, 1.6, 'k'], [14.5, .4, 1.2, 'k']] },
    { base: 'g', fin: 'F', spots: [] },
  ];
  // (each its own loop, [middle x, y, reach x, y, turns across per turn down, way round], so they seldom meet)
  const CARP_LOOPS = [[.74, .3, .15, .17, 1, 1], [.26, .42, .13, .24, 1, -1], [.56, .66, .2, .12, 1, -1]];
  const carpPath = (cols, rows, i, s) => {
    const [mx, my, rx, ry, k, dir] = CARP_LOOPS[i];
    return [SIDE + (cols - SIDE) * (mx + rx * Math.cos(s * k * dir + i * 2)), rows * (my + ry * Math.sin(s * dir + i * 2))];
  };
  const carp = (cols, rows, t, i) => {
    // (z: its size, by the window's width: its shape is worked out in its own units, z cells each)
    const z = Math.min(.75, Math.max(.5, (cols - SIDE) / 90));
    let s = t * (.06 + i * .01);
    const spine = [carpPath(cols, rows, i, s)];
    for (let n = 0; spine.length < CARP_LEN && n < 20000; n++) {
      const q = carpPath(cols, rows, i, s -= .002), [lx, ly] = spine[spine.length - 1];
      if (Math.hypot(q[0] - lx, q[1] - ly) >= z) spine.push(q);
    }
    const norm = spine.map((_, k) => {
      const [ax, ay] = spine[Math.max(0, k - 1)], [bx, by] = spine[Math.min(spine.length - 1, k + 1)], d = Math.hypot(ax - bx, ay - by) || 1;
      return [-(ay - by) / d, (ax - bx) / d];
    });
    const xs = spine.map(p => p[0]), ys = spine.map(p => p[1]), ox = Math.min(...xs) - 6, oy = Math.min(...ys) - 6;
    const kind = CARP_KINDS[i], P = CARP_PAL;
    // (the tail swishing side to side, more toward its end; the side fins paddling)
    const swish = u => Math.sin(t * 3.2 + i * 2) * 1.3 * Math.max(0, u - 9) / 11;
    const paddle = 4.8 + .7 * Math.sin(t * 2.4 + i);
    return {
      x: ox, y: oy, w: Math.ceil(Math.max(...xs) - ox + 7), h: Math.ceil(Math.max(...ys) - oy + 7), key: i, shadow: '#0b3430',
      field: (gx, gy) => {
        const wx = ox + gx + .5, wy = oy + gy + .5;
        let u = 0, d = Infinity;
        spine.forEach(([px, py], j) => { const e = Math.hypot(wx - px, wy - py); if (e < d) { d = e; u = j; } });
        d /= z;
        const [nx, ny] = norm[u], dx = (wx - spine[u][0]) / z, dy = (wy - spine[u][1]) / z;
        const v = dx * nx + dy * ny - swish(u), av = Math.abs(v), seed = { sx: u + i * 40, sy: Math.round(v * 1.5) };
        if (u < CARP_R.length && av <= CARP_R[u] && d <= CARP_R[u] + 1) {
          if (u >= 1 && u <= 2 && Math.abs(av - 1.8) < .55) return { c: P.e, ...seed };
          const spot = kind.spots.find(([su, sv, sr]) => Math.hypot(u - su, v - sv) < sr);
          let key = spot ? spot[3] : kind.base;
          if (kind.base === 'g' && av < .9 && u > 1) key = 'l'; // (Ogon: a light stripe down its back)
          return { c: av > CARP_R[u] - .8 ? P[key.toUpperCase() + '_'] : P[key], ...seed };
        }
        // (the tail: widening over its last five places and past its end, its two lobes swept back, a notch between)
        if (u >= CARP_R.length) {
          const a = u - CARP_R.length + (u === spine.length - 1 ? Math.max(0, dy * nx - dx * ny) : 0);
          if (av <= .7 + Math.min(a, 4.5) * .5 && a <= 4 + av * .8 && !(a > 4 && av < (a - 4) * 1.4 + .5)) return { c: P[kind.fin], ...seed };
        }
        if (u >= 3 && u <= 8 && ((u - 5.5) / 2.2) ** 2 + ((av - paddle) / 1.6) ** 2 <= 1) return { c: P[kind.fin], ...seed };
        if (u >= 9 && u <= 12 && ((u - 10.5) / 1.3) ** 2 + ((av - 3) / 1.1) ** 2 <= 1) return { c: P[kind.fin], ...seed };
      },
    };
  };
  // Lily pads in clusters at the window's corners (x and y as parts of the window right of the sidebar, radius in
  // cells, where the notch points), some with a lotus on them (x, y, radius); the first listed lies on top
  const LILIES = [[.8, .06, 4.2, 2.4], [.95, .14, 6.5, 2], [.99, .42, 5, 2.8], [.01, .55, 5.5, .2], [.2, .97, 4.8, -1.6], [.04, .95, 6.5, -.9], [.97, .95, 5.5, -2.2]];
  const LOTUS = [[.82, .08, 3.2], [.18, .87, 3.2]];
  const LILY_PAL = {
    pad: { bg: '#5c9a43', fg: '#2c5520', a: .93 }, rim: { bg: '#3f7a31', fg: '#1d3d15', a: .93 }, vein: { bg: '#86c066', fg: '#3a6a2a', a: .93 },
    petal: { bg: '#f28bb8', fg: '#8a2d55', a: .95 }, inner: { bg: '#f9c3da', fg: '#a2466e', a: .95 }, heart: { bg: '#f6d03f', fg: '#7a5a08', a: .97 },
    shadow: { bg: '#0b3430', fg: '#0b3430', ch: '', a: .35 },
  };
  const lilyAt = (x, y, cols, rows, t) => {
    const W = cols - SIDE;
    for (const [fx, fy, r] of LOTUS) {
      const cx = SIDE + fx * W, cy = fy * rows, dx = x + .5 - cx, dy = y + .5 - cy, d = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
      const p = r * (.55 + .45 * Math.abs(Math.cos(4 * th + fx * 9))) * (1 + .07 * Math.sin(t * .8 + fx * 5)); // (the petals, breathing)
      if (d < .9) return LILY_PAL.heart;
      if (d < p * .55) return LILY_PAL.inner;
      if (d < p) return LILY_PAL.petal;
    }
    for (const [fx, fy, r, notch] of LILIES) {
      const cx = SIDE + fx * W, cy = fy * rows, dx = x + .5 - cx, dy = y + .5 - cy, d = Math.hypot(dx, dy);
      if (d > r) continue;
      const th = Math.atan2(dy, dx), off = Math.abs(((th - notch) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (off < .3 && d > .4) continue; // (the notch)
      if (d > r - .8) return LILY_PAL.rim;
      const spoke = Math.abs(((((th - notch) * 11 / (Math.PI * 2)) % 1) + 1) % 1 - .5); // (.5 on a vein)
      return d < .8 || (d > 1.2 && spoke > .5 - .35 / d) ? LILY_PAL.vein : LILY_PAL.pad;
    }
  };

  // A paper lantern on its little boat, seen from the river bank: a dark roof, glowing paper sides with a mark on
  // them, a wooden base on a boat, and its light trembling on the water below; near ones big, far ones small. The
  // flame flickers (some of the paper dims a moment) and the reflection wavers, a frame each
  const LANTERN_NEAR = ['..RRRR..', '.RRRRRR.', 'RRRRRRRR', '.pPPPPp.', '.pPPKPp.', '.pPKKPp.', '.pPPPPp.', '.pPPPPp.', '.WWWWWW.', 'wwwwwwww', '.wwwwww.'];
  const LANTERN_FAR = ['RRRRR', '.pPp.', '.pKp.', '.WWW.', 'wwwww'];
  const flicker = art => art.map((r, y) => (y === 3 || y === art.length - 4 ? r.replace(/P/g, 'p') : r));
  const REFLECT_NEAR = [['..rrrr..', '...rr...', '..r..r..', '...rr...', '....r...'], ['.rrrrr..', '..rr.r..', '...rr...', '..r.....', '...r....'], ['..rrrrr.', '..r.rr..', '...rr...', '.....r..', '....r...']];
  const REFLECT_FAR = [['.rrr.', '..r..', '.r...'], ['rrr..', '.r.r.', '..r..'], ['.rrrr', '..r..', '...r.']];
  const lanternArts = (art, reflects) => [art, flicker(art)].flatMap(a => reflects.map(r => [...a, ...r]));
  const LANTERN_ARTS = [lanternArts(LANTERN_FAR, REFLECT_FAR), lanternArts(LANTERN_NEAR, REFLECT_NEAR)];
  const LANTERN_PAL = {
    R: { bg: '#3a1a14', fg: '#170905', a: .95 }, P: { bg: '#ffd889', fg: '#c46a1c', a: .97 }, p: { bg: '#f4a347', fg: '#7a3a0c', a: .95 },
    K: { bg: '#e07a2a', fg: '#5a2a08', a: .95 }, W: { bg: '#4a2e1c', fg: '#1e120a', a: .95 }, w: { bg: '#2e1c12', fg: '#120a06', a: .92 },
    r: { bg: '#f6b04e', fg: '#7a3a0c', a: .4 },
  };
  // (each lantern: where it starts across, how far out on the river (0 the far bank, 1 the near), cells a second)
  const LANTERNS = [[.05, .1, .12], [.4, .05, .1], [.75, .18, .14], [.2, .35, .2], [.6, .42, .18], [.9, .3, .22], [.12, .72, .3], [.5, .85, .26], [.82, .68, .32]];
  // (the far bank's line, where the river starts: a part of the window down)
  const BANK = .3;
  const lantern = (cols, rows, t, i, [fx, depth, v]) => {
    const near = depth > .5, art = frame(LANTERN_ARTS[+near], t, 2.2, i * 1.7);
    const top = rows * BANK + 1 + depth * (rows * (1 - BANK) - 16);
    return { art, pal: LANTERN_PAL, key: 60 + i, a: .7 + .3 * depth, glow: { r: near ? 7 : 4, color: '#ffb347', a: near ? .42 : .28 },
      x: drift(cols, fx, t, v, art[0].length), y: top + Math.sin(t * .8 + i * 2) * .5 };
  };

  // A city at night in the rain, seen from across the street: buildings tall at the sides and low in the middle, a
  // dimmer row behind them, their windows lit (one goes out or on now and then), red lights blinking on some roofs.
  // (STREET: the rows at the bottom the buildings stand on: a curb, then the wet street)
  const STREET = 3;
  const cities = new Map();
  const cityOf = (cols, rows) => {
    const id = `${cols},${rows},${SIDE}`;
    if (!cities.has(id)) {
      const mid = SIDE + (cols - SIDE) / 2, half = Math.max(1, (cols - SIDE) / 2);
      // (a row of buildings 4 to 8 cells wide, taller toward the sides: each column's [height, its building's first
      // column, last column, its building's number])
      const row = (seed, lo, hi, pow) => {
        const out = [];
        for (let x = 0, b = 0; x < cols; b++) {
          const w = 4 + Math.floor(hash(b, seed) * 5), e = Math.min(1, Math.abs(x + w / 2 - mid) / half);
          const h = Math.round(rows * (lo + hi * e ** pow * (.6 + .4 * hash(b, seed + 1))));
          for (let i = 0; i < w; i++) out[x + i] = [h, x, x + w - 1, b];
          x += w;
        }
        return out;
      };
      cities.set(id, { near: row(1, .08, .52, 2), far: row(5, .16, .48, 1.4) });
    }
    return cities.get(id);
  };
  const CITY = {
    wall: { bg: '#1b2242', fg: '#2b355a', a: .95 }, roof: { bg: '#2a3358', fg: '#3a4570', a: .95 },
    dark: { bg: '#232b4e', fg: '#323c64', a: .95 }, far: { bg: '#121730', fg: '#1b2140', a: .75 },
    farWin: { bg: '#6a5a3a', fg: '#2a2416', a: .5 },
    win: [{ bg: '#f3c56b', fg: '#6a4a10', a: .85 }, { bg: '#ffe2a0', fg: '#7a5a18', a: .85 }, { bg: '#8fd3ff', fg: '#1d4a6a', a: .75 }],
  };
  // (rain slanting down to the left on tracks across the grid: each drop a bright head and a dim tail, then a gap)
  const RAIN_V = 11, RAIN_K = .3;
  const rain = (x, y, t) => {
    const q = Math.floor(y - t * RAIN_V), track = Math.floor(x + y * RAIN_K), m = ((q % 3) + 3) % 3;
    if (m < 2 && hash(track, Math.floor(q / 3), 27) < .09) return { ch: '/', fg: '#a9c4f0', a: m ? .6 : .28 };
  };
  // (the street: a curb, then drops landing in rings, and the neon and the windows smeared on the wet road, wavering)
  const SMEAR = ['#ff5fa2', '#4fe3ff', '#f3c56b'];
  const street = (x, y, t) => {
    if (y === 0) return { ch: '_', fg: '#3a4570', a: .55 };
    if (hash(x, y, 40 + Math.floor(t * 3)) < .025) return { ch: 'o', fg: '#a9c4f0', a: .5 };
    if (hash(x, Math.floor(t * 1.5) + y, 41) < .12) return { ch: y === 1 ? '|' : '~', fg: SMEAR[Math.floor(hash(x, 42) * 3)], a: .28 };
  };
  // A neon sign hung on a building at each side, its letters stacked in a frame of tubes; it buzzes: now and then a
  // letter flickers out (its lower-case key, the same letter dim), and every nine seconds the whole sign a moment
  const neon = (word, c) => {
    const tube = ch => ({ ch, fg: c, a: .9 }), pal = { '+': tube('+'), '-': tube('-'), '|': tube('|') };
    for (const ch of word) {
      pal[ch] = { bg: '#1c0b1a', fg: c, a: .95, ch };
      pal[ch.toLowerCase()] = { bg: '#1c0b1a', fg: shade(c, -.55), a: .9, ch };
    }
    const art = sketch(3, word.length + 2, [[0, 0, '+-+'], ...[...word].map((ch, i) => [i + 1, 0, `|${ch}|`]), [word.length + 1, 0, '+-+']]);
    return { c, pal, arts: [art, ...[...word].map((_, i) => art.map((r, y) => (y === i + 1 ? r.toLowerCase() : r)))] };
  };
  const SIGNS = [neon('RAMEN', '#ff5fa2'), neon('HOTEL', '#4fe3ff')];
  const signs = (cols, rows, t) => {
    const { near } = cityOf(cols, rows), ground = rows - STREET, W = cols - SIDE;
    return SIGNS.flatMap((s, i) => {
      // (on the tallest building in its side's outer third, hung from its inner wall)
      let best;
      for (let x = Math.floor(SIDE + (i ? W * .7 : 0)); x < (i ? cols : SIDE + W * .3); x++) if (!best || near[x][0] > best[0]) best = near[x];
      if (!best || best[0] < s.arts[0].length + 3) return [];
      const k = Math.floor(t * 4), art = hash(k, i, 51) < .1 ? s.arts[1 + Math.floor(hash(k, i, 52) * (s.arts.length - 1))] : s.arts[0];
      const a = (t + i * 4.5) % 9 < .3 ? .3 : 1;
      return [{ art, pal: s.pal, key: 70 + i, a, x: i ? best[1] - 2 : best[2], y: ground - best[0] + 2, glow: { r: 6, color: s.c, a: .35 * a } }];
    });
  };
  // People under umbrellas walking along the pavement, legs stepping, drops falling from the umbrella's rim
  const WALK = [
    ['..uUu..', '.uUUUu.', 'uUUUUUu', 'd..|..d', '...h...', '..cCc..', '..cCc..', '..l.l..'],
    ['..uUu..', '.uUUUu.', 'uUUUUUu', '...|...', 'd..h..d', '..cCc..', '..cCc..', '...l...'],
  ];
  const walkPal = c => ({
    U: { bg: c, fg: shade(c, -.6), a: .95 }, u: { bg: shade(c, -.25), fg: shade(c, -.7), a: .95 },
    d: { ch: '.', fg: '#bcd2f5', a: .6 }, '|': { ch: '|', fg: '#8a92b0', a: .9 },
    h: { bg: '#3a3550', fg: '#1a1828', a: .95 }, c: { bg: '#252a42', fg: '#121526', a: .95 },
    C: { bg: '#2f3554', fg: '#151a2e', a: .95 }, l: { bg: '#1c2034', fg: '#0c0e18', a: .95 },
  });
  // (each: where it starts across, cells a second, going left, its umbrella)
  const WALKERS = [[.97, 1.5, false, walkPal('#ff5fa2')], [.98, 1.1, true, walkPal('#f2c14e')]];
  // Lightning far off now and then, and when a tool fails: a jagged bolt over the roofs at one side, flashing twice
  const STORM = 23;
  const boltArt = k => {
    const out = [];
    for (let y = 0, c = 4; y < 12; y++) {
      const s = Math.floor(hash(k, y, 61) * 3) - 1;
      c = Math.max(0, Math.min(8, c + s));
      out.push('.'.repeat(c) + (s < 0 ? '/' : s > 0 ? '\\' : '|') + '.'.repeat(8 - c));
    }
    return out;
  };
  const BOLT_PAL = Object.fromEntries(['/', '\\', '|'].map(ch => [ch, { ch, fg: '#eef3ff', a: 1 }]));
  const lightning = (cols, rows, t) => {
    const err = root.dataset.themeEvent === 'error', k = err ? -1 : Math.floor(t / STORM), p = err ? 0 : t - k * STORM;
    if (!(p < .1 || (p > .2 && p < .32))) return [];
    const W = cols - SIDE, fx = hash(k, 62) < .5 ? .06 + .14 * hash(k, 63) : .78 + .14 * hash(k, 63);
    return [{ art: boltArt(k), pal: BOLT_PAL, key: 80, x: SIDE + W * fx, y: rows * .03, glow: { r: 16, color: '#a9bcff', a: .45 } }];
  };

  // A scene: cell, what stays in place: (x, y) of a cell, the grid's cols and rows, and the time in seconds → what
  // the cell shows ({ bg, fg, a } a tile, { fg, a, ch? } a loose character, one of LOOSE unless ch) or nothing; and
  // sprites, what moves: (cols, rows, t) → [{ x, y (cells, between them too), key (its characters' own seed), and
  // either art and pal (a picture) or field, w and h (a shape worked out each frame: (gx, gy) of a cell in its w × h
  // box → { c, sx?, sy? } its look and its character's seed, or nothing); a? (all its tiles' strength), halo? (a
  // picture only: the color of the loose characters round it), shadow? (the color of its tiles' shadow, a
  // cell down and right), glow? ({ r cells, color #rrggbb, a } a soft light round its middle) }], drawn over the cells
  const SCENES = {
    // a crescent moon, clouds drifting in front of it, twinkling stars, and now and then a shooting star behind the
    // clouds
    moonlit: {
      cell: (x, y, cols, rows, t) => {
        const mx = Math.round(cols * .74), my = Math.round(rows * .22), R = 6.5;
        const d1 = Math.hypot(x - mx, y - my), d2 = Math.hypot(x - mx - 3.4, y - my + 1.8);
        if (d1 <= R && d2 > R * .85) return { bg: '#d9c98f', fg: '#3a3524', a: .9 };
        if (d1 <= R + 1.6 && d2 > R * .85 + .6 && hash(x, y, 5) < .45) return { fg: '#d9c98f', a: .25 + .15 * Math.sin(t * 2 + x) };
        return twinkle(x, y, t, '#dbe2f5', .014);
      },
      sprites: (cols, rows, t) => [...meteor(cols, rows, t), ...CLOUDS.map(([fx, fy, w, v], i) =>
        ({ art: cloudArt(w), pal: NIGHT, halo: '#8ea2e6', x: drift(cols, fx, t, v, w) - w / 2, y: fy * rows - 3, key: i }))],
    },

    // an orange spark turning slowly in a warm glow, its rays breathing in and out, embers rising from it, code
    // characters twinkling round the dark, and Clawd walking his patrol along the bottom, legs scuttling
    clawd: {
      cell: (x, y, cols, rows, t) => {
        // (the spark: how much of this cell its rays cover, from four points in it, so their edges come out clean)
        const cx = cols * .8, cy = rows * .3;
        let cover = 0, glow = false;
        for (const [sx, sy] of [[.25, .25], [.75, .25], [.25, .75], [.75, .75]]) {
          const dx = x + sx - cx, dy = y + sy - cy, r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
          if (r <= 1.2) { cover++; continue; }
          for (let k = 0; k < 11; k++) {
            let da = Math.abs(ang - (k * Math.PI * 2 / 11 + t * .04)) % (Math.PI * 2);
            da = Math.min(da, Math.PI * 2 - da);
            if (da >= Math.PI / 2) continue;
            // (each ray its own length, breathing; thick at the root and tapering to a rounded tip)
            const len = 6.5 + 5 * hash(k, 1) + Math.sin(t * 1.4 + k) * .7, along = r * Math.cos(da), off = r * Math.sin(da);
            if (along <= len && off <= .35 + .55 * (1 - along / len) ** .7) { cover++; break; }
            if (along <= len + 1.2 && off <= 1.6) glow = true;
          }
        }
        // (it stays at least .6 bright in the chat's column: it is the scene)
        if (cover >= 2) return { bg: '#d97757', fg: '#3b1d12', a: (.55 + .1 * cover) * (1 - .35 * Math.min(1, Math.hypot(x + .5 - cx, y + .5 - cy) / 12)), floor: .6 };
        if (glow) return near(x, y, '#e9a083', .25, .3);
        if (rising(x, y, t, 1.2, .006)) return { ch: '.', fg: '#e9a083', a: .5 };
        const s = hash(x, y, 13);
        if (s < .008) return { ch: '<>()=$/*'[Math.floor(s * 1000) % 8], fg: '#d97757', a: .15 + .3 * (.5 + .5 * Math.sin(t * 1.3 + s * 900)) };
      },
      sprites: (cols, rows, t) => {
        const lo = cols * .2, hi = cols * .9 - 9, p = (t * 2.2 / (hi - lo)) % 2;
        return [
          { art: ['.'], pal: {}, x: cols * .8 - .5, y: rows * .3 - .5, key: 2, glow: { r: 12, color: '#d97757', a: .3 + .05 * Math.sin(t * 1.4) } },
          { art: frame(CLAWDS, t, 5), pal: { '#': { bg: '#d97757', fg: '#3b1d12', a: .95 }, o: { bg: '#2a1a14', fg: '#d97757', a: .95 } },
            x: lo + (hi - lo) * (p < 1 ? p : 2 - p), y: rows - 8, key: 1 },
        ];
      },
    },

    // a bright sky in layers: high wisps, small dim clouds far off, flocks of birds beating their wings, and big
    // clouds of four kinds sweeping by in front, fast
    'cloud-drift': {
      sprites: (cols, rows, t) => [
        ...CIRRUS.map(([fx, fy, v], i) => ({ art: WISP, pal: WISP_PAL, key: 60 + i, x: drift(cols, fx, t, v, 14) - 7, y: fy * rows })),
        ...FAR.map(skySprite(cols, rows, t)),
        ...[0, 1].flatMap(f => FLOCK.map(([bx, by], j) => ({ art: frame(BIRDS, t, 3, j * .5), pal: BIRD_PAL, key: 20 + f * 4 + j,
          x: drift(cols, hash(f, 21), t, 2.4 + f * .4, 6) + bx, y: rows * (.25 + .25 * f) + Math.sin(t * .7 + f) * 1.5 + by }))),
        ...NEAR.map(skySprite(cols, rows, t)),
      ],
    },

    // a clear lagoon and its creatures in pixel tiles, each moving its own body: a sea turtle sweeping its flippers as
    // it glides across, clownfish and a blue tang and yellow fish beating their tails, moorish idols hovering, a crab
    // stepping sideways, a starfish lifting an arm, seaweed swaying
    'honu-lagoon': {
      size: 18, // (cells no bigger than 18px: the creatures keep the picture's own scale, 97 cells across)
      // (the water as the other scenes have it: bubbles rising, specks drifting up, sparkles, light on it)
      cell: (x, y, cols, rows, t) => {
        for (let i = 0; i < 9; i++)
          if (x === Math.floor(hash(i, 31) * cols) + Math.round(Math.sin(t + i))
            && y === Math.round(rows - ((t * 1.8 * (1 + hash(i, 32)) + hash(i, 33) * rows) % (rows + 4)))) return { ch: 'o', fg: '#e8fbff', a: .65 };
        if (rising(x, y, t, .5, .008)) return { ch: '.', fg: '#cdeefa', a: .35 };
        return twinkle(x, y, t, '#e8fbff', .006) ?? matrix(x, y, cols, '#e8fbff');
      },
      sprites: (cols, rows, t) => {
        const T = REEF_THINGS, F = REEF_FRAMES, out = [];
        const add = (art, x, y, key, extra = {}) => out.push({ art, pal: REEF_PAL, key, x, y, ...extra });
        // (one that swims on from its place in the picture and comes round again, left the way it faces)
        const swim = (name, v, left) => {
          const w = T[name].art[0].length, [x] = placeOf(T[name], cols, rows), f = (x + w / 2 + w) / (cols + w * 2);
          const run = drift(cols, left ? 1 - f : f, t, v, w);
          return (left ? cols - run : run) - w / 2;
        };
        ['weedL', 'weedM', 'weedR'].forEach((n, i) => { const [x, y] = placeOf(T[n], cols, rows); out.push({ ...swaying(T[n].art, t, i), x: x - 2, y, key: 150 + i }); });
        const [sx, sy] = placeOf(T.star, cols, rows);
        add(frame(F.star, t, .6), sx, sy, 7);
        const [, ty] = placeOf(T.turtle, cols, rows);
        add(frame(F.turtle, t, 2.2), swim('turtle', .8, false), ty + Math.sin(t * .6) * .8, 1, { shadow: '#0b3d7a' });
        const [, yy] = placeOf(T.yellow, cols, rows), yx = swim('yellow', 1.3, true);
        F.yellow.forEach((p, i) => add(frame(p.frames, t, 4, i * 1.3), yx + p.dx + Math.sin(t * .9 + i * 2) * .8, yy + p.dy + Math.sin(t * 1.1 + i) * .7, 20 + i));
        const [, gy] = placeOf(T.tang, cols, rows);
        add(frame(F.tang[0], t, 5), swim('tang', 2, true), gy + Math.sin(t * 1.4) * .5, 3);
        // (the clownfish dart back and forth about their places, turning as they go; the idols hover and turn)
        ['clownA', 'clownB'].forEach((n, i) => {
          const [x, y] = placeOf(T[n], cols, rows), a = t * .7 + i * 2.2;
          add(frame(F[n][Math.cos(a) < 0 ? 1 : 0], t, 5, i * 2), x + Math.sin(a) * 2.5, y + Math.sin(t * 1.3 + i) * .6, 4 + i);
        });
        ['idolA', 'idolB'].forEach((n, i) => {
          const [x, y] = placeOf(T[n], cols, rows), a = t * .45 + i * 1.7;
          add(frame(F[n][Math.cos(a) > 0 ? 1 : 0], t, 3, i * 2), x + Math.sin(a) * 1.5, y + Math.sin(t * .8 + i) * .8, 8 + i);
        });
        const [cx, cy] = placeOf(T.crab, cols, rows);
        add(frame(F.crab, t, 6), cx + Math.sin(t * .9) * 4, cy, 6);
        return out;
      },
    },

    // big koi from above (Kohaku, Showa, Ogon), bending as they swim slow loops, tails swishing; lily pads with veins
    // and a notch in clusters at the corners, two lotus flowers opening and closing a little; deeper water in the
    // middle, pink petals afloat, rings spreading, faint letters on the water
    'koi-pond': {
      cell: (x, y, cols, rows, t) => {
        const lily = lilyAt(x, y, cols, rows, t);
        if (lily) return lily;
        if (lilyAt(x - 1, y - 1, cols, rows, t)) return LILY_PAL.shadow;
        if (hash(x - Math.floor(t * .3), y + Math.floor(t * .12), 77) < .004) return { bg: '#f4b6cc', fg: '#8a2d55', a: .85 };
        for (let i = 0; i < 5; i++) {
          const rr = (t * 1.6 + i * 3.7) % 10, d = Math.hypot(x - (SIDE + hash(i, 61) * (cols - SIDE)), y - hash(i, 62) * rows);
          if ((Math.abs(d - rr) < .5 || Math.abs(d - rr + 2.2) < .5) && hash(x, y, 63) < .7) return { ch: 'o', fg: '#d6f1e8', a: .4 * (1 - rr / 10) };
        }
        const deep = ell(x, y, SIDE + (cols - SIDE) * .5, rows * .45, (cols - SIDE) * .2, rows * .28);
        if (deep < 1) return { bg: '#0d3a38', fg: '#0d3a38', ch: '', a: .45 * (1 - deep) };
        if (hash(x, y, 71) < .03) return { ch: 'abcdeghkmnopqtu_.*'[Math.floor(hash(x, y, 72) * 18)], fg: '#cfeee6', a: .2 };
        return twinkle(x, y, t, '#e8fbf6', .004);
      },
      sprites: (cols, rows, t) => [0, 1, 2].map(i => carp(cols, rows, t, i)),
    },

    // big jellyfish drifting up through deep water, bells pulsing, long tentacles trailing; a current of rings
    // sweeping round a corner, specks rising
    jellyfish: {
      cell: (x, y, cols, rows, t) => {
        const cx = -cols * .15, cy = -rows * .35, R = rows * .75 + cols * .1, d = Math.hypot(x - cx, y - cy);
        if (Math.abs(d - R) < .55 && (((Math.atan2(y - cy, x - cx) * R - t * 3) % 3) + 3) % 3 < 1) return { ch: 'o', fg: '#dbe8ff', a: .55 };
        if (Math.abs(d - R - 1.6) < .55 && hash(x, y, 71) < .4) return { ch: '~', fg: '#9cc8ff', a: .35 };
        if (rising(x, y, t, .6, .01)) return { ch: '.', fg: '#9cc8ff', a: .35 };
      },
      sprites: (cols, rows, t) => JELLY.map(([fx, pal, v, a], i) => {
        const span = rows + 34;
        // (no halo: round the tentacles it filled the gaps between them; they carry their own rings)
        return { art: frame(JELLIES, t, 1.1, i * .5), pal, a, key: i,
          x: fx * cols + Math.sin(t * .35 + i) * 2.5 - 6.5, y: rows + 4 - ((t * v + i * span / 4) % span) };
      }),
    },

    // lantern night (toro nagashi): paper lanterns on little boats drifting down a dark river, near ones big and bright,
    // far ones small; their light flickers and trembles on the water. Over the river a far bank of dark roofs with a
    // few lit windows, their light on the water too; stars over it; slow ripples
    'lantern-night': {
      cell: (x, y, cols, rows, t) => {
        const bank = Math.round(rows * BANK), roof = bank - 1 - Math.floor(2.6 * (.5 + .5 * Math.sin(x * .21)) + hash(Math.floor(x / 3), 7) * 2.2);
        if (y < roof) return twinkle(x, y, t, '#fff1cf', .012);
        if (y < bank) {
          if (y < bank - 1 && hash(x, y, 41) < .07) return { bg: '#f2b65a', fg: '#6a3a0c', a: .55 + .3 * Math.sin(t * .7 + x) ** 2 };
          return { bg: '#04070e', fg: '#131c30', a: .97 };
        }
        // (a lit window's light on the water just below the bank, broken by the ripples)
        if (y < bank + 4 && hash(x, bank - 2, 41) < .07 && hash(x, y + Math.floor(t * 2), 43) < .55) return { ch: '|', fg: '#f2b65a', a: .35 * (1 - (y - bank) / 4) };
        if (hash(Math.floor(x / 4 + t * .25 * (1 + (y % 3) * .3)), y, 45) < .07) return { ch: (x + y) % 2 ? '~' : '-', fg: '#8fb0d6', a: .16 };
      },
      sprites: (cols, rows, t) => LANTERNS.map((l, i) => lantern(cols, rows, t, i, l)),
    },

    // fireflies wandering in the dark, each blinking its glow on and off on its own beat, over tall grass in letters
    fireflies: {
      cell: (x, y, cols, rows, t) => {
        const h = 2 + Math.floor(hash(x, 7) ** 2 * 8);
        if (y < rows - h || (y < rows - 1 && hash(x, y, 8) > .75)) return;
        return { ch: glyph('SXt%S', x, y, t * .5), fg: '#4fb85c', a: .5 + .45 * (y - rows + h) / h };
      },
      sprites: (cols, rows, t) => Array.from({ length: 18 }, (_, i) => {
        const b = Math.max(0, Math.min(1, Math.sin(t * (.6 + .5 * hash(i, 5)) + i * 3) * 1.4 - .2));
        return { art: FLIES[i % 3], pal: FLY_PAL, key: i, a: .12 + .88 * b, glow: { r: 3.4, color: '#cfe86a', a: .18 + .3 * b },
          x: hash(i, 1) * cols + Math.sin(t * .2 * (1 + hash(i, 2)) + i) * 6 - 1,
          y: rows * (.08 + .65 * hash(i, 3)) + Math.cos(t * .17 * (1 + hash(i, 4)) + i * 2) * 3.5 - 1 };
      }),
    },

    // a city at night in the rain: buildings at the sides with lit windows and blinking roof lights, a dim row behind,
    // rain slanting down, neon signs buzzing, people under umbrellas walking by, the wet street shining, lightning
    'neon-rain': {
      cell: (x, y, cols, rows, t) => {
        const { near, far } = cityOf(cols, rows), ground = rows - STREET;
        if (y >= ground) return street(x, y - ground, t);
        const [h, x0, x1, b] = near[x] ?? [0], top = ground - h;
        if (y >= top) {
          if (y === top) return CITY.roof;
          // (windows: every other column inside its walls, every other row; most keep their light, a few change)
          if (x > x0 && x < x1 && (x - x0) % 2 === 1 && (ground - y) % 2 === 0 && y > top + 1) {
            const lit = (hash(x, y, 21) < .45) !== (hash(x, y, 22 + Math.floor(t / 7 + hash(x, y, 24) * 7)) < .08);
            const s = hash(x, y, 23);
            return lit ? CITY.win[s < .6 ? 0 : s < .85 ? 1 : 2] : CITY.dark;
          }
          return CITY.wall;
        }
        if (y === top - 1 && x === Math.floor((x0 + x1) / 2) && hash(b, 31) < .35)
          return { ch: '*', fg: '#ff4d5e', a: Math.sin(t * 2.5 + b) > .3 ? .95 : .2 };
        const [fh, fx0, fx1] = far[x] ?? [0];
        if (y >= ground - fh)
          return fx1 - fx0 > 2 && (x - fx0) % 2 === 1 && (ground - y) % 3 === 0 && hash(x, y, 25) < .3 ? CITY.farWin : CITY.far;
        return rain(x, y, t);
      },
      sprites: (cols, rows, t) => [
        ...lightning(cols, rows, t),
        ...signs(cols, rows, t),
        ...WALKERS.map(([f, v, left, pal], i) => {
          const run = drift(cols, f, t, v, 7);
          return { art: frame(WALK, t, 3, i), pal, key: 90 + i, x: (left ? cols - run : run) - 3.5, y: rows - STREET - 8 };
        }),
      ],
    },
  };

  // The column the chat is written in, where the wallpaper dims so the writing reads over it: the prompt box's left
  // and right edges, while a conversation shows (the New session screen keeps the whole scene bright). Measured once
  // a second; undefined for none.
  // (SIDE: how many cells the sidebar covers on the left, measured with the column; a picture scene starts after it)
  let SIDE = 0;
  const DIM = .25, column = () => {
    SIDE = Math.round((document.querySelector('.dframe-sidebar')?.getBoundingClientRect().right ?? 0) / CELL);
    if (!document.querySelector('[data-cds=AssistantMessage]')) return;
    const r = document.querySelector('[data-cds=ChatComposer] > .bg-surface-3')?.getBoundingClientRect();
    return r?.width ? [r.left, r.right] : undefined;
  };
  // (how much a cell at px, its middle in pixels, keeps: DIM well inside the column, all of it outside, fading over
  // three cells at its edges)
  const keep = (col, px) => {
    if (!col) return 1;
    const inside = Math.min(px - col[0], col[1] - px);
    return 1 - (1 - DIM) * Math.max(0, Math.min(1, (inside + CELL) / (3 * CELL)));
  };

  // One cell at (px, py), its top left in pixels; (sx, sy) seeds its character
  const put = (w, px, py, c, sx, sy) => {
    const { ctx } = w;
    // (floor: the least a cell keeps in the chat's column, for a scene's centrepiece)
    // (with a backdrop on, it shades the column instead)
    ctx.globalAlpha = Math.max(0, Math.min(1, c.a)) * Math.max(c.floor ?? 0, keep(w.veil ? undefined : w.col, px + CELL / 2));
    if (ctx.globalAlpha < .01) return;
    if (c.bg) {
      ctx.fillStyle = c.bg;
      ctx.beginPath();
      ctx.roundRect(px + 2, py + 2, CELL - 4, CELL - 4, 3);
      ctx.fill();
    }
    ctx.fillStyle = c.fg;
    ctx.fillText(c.ch ?? glyph(c.bg ? GLYPHS : LOOSE, sx, sy, w.time), px + CELL / 2, py + CELL / 2 + 1);
  };

  const draw = w => {
    const { ctx, scene, time: t } = w, W = innerWidth, H = innerHeight, cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
    const now = performance.now();
    if (!(now - w.measured < 1000)) { w.col = column(); w.measured = now; }
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(160, 180, 255, .05)';
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) { ctx.moveTo(x * CELL + .5, 0); ctx.lineTo(x * CELL + .5, H); }
    for (let y = 0; y <= rows; y++) { ctx.moveTo(0, y * CELL + .5); ctx.lineTo(W, y * CELL + .5); }
    ctx.stroke();
    if (scene.cell)
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const c = scene.cell(x, y, cols, rows, t);
          if (c) put(w, x * CELL, y * CELL, c, x, y);
        }
    for (const s of scene.sprites?.(cols, rows, t) ?? []) {
      // (cell by cell, theme.json's motion grid: the sprite steps from cell to cell as on the grid; smooth, it glides)
      const ox = (w.grid ? Math.round(s.x) : s.x) * CELL, oy = (w.grid ? Math.round(s.y) : s.y) * CELL;
      const m = s.a ?? 1, k = s.key * 997; // (its own seed: the characters stay with it)
      const bw = s.art ? s.art[0].length : s.w, bh = s.art ? s.art.length : s.h;
      if (ox > W + CELL * 4 || oy > H + CELL * 4 || ox + (bw + 4) * CELL < 0 || oy + (bh + 4) * CELL < 0) continue;
      if (s.glow) {
        const g = s.glow, cx = ox + bw / 2 * CELL, cy = oy + bh / 2 * CELL, r = g.r * CELL;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, g.color);
        grad.addColorStop(1, `${g.color}00`);
        ctx.globalAlpha = Math.min(1, g.a * keep(w.veil ? undefined : w.col, cx));
        ctx.globalCompositeOperation = 'screen'; // (light: it brightens what is under it, never hides it)
        ctx.fillStyle = grad;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'source-over';
      }
      const cells = []; // ([gx, gy, look, seed x, seed y])
      if (s.art) s.art.forEach((row, gy) => { for (let gx = 0; gx < row.length; gx++) if (s.pal[row[gx]]) cells.push([gx, gy, s.pal[row[gx]], gx + k, gy]); });
      else
        for (let gy = 0; gy < s.h; gy++)
          for (let gx = 0; gx < s.w; gx++) {
            const f = s.field(gx, gy);
            if (f) cells.push([gx, gy, f.c, (f.sx ?? gx) + k, f.sy ?? gy]);
          }
      if (s.shadow)
        for (const [gx, gy, c] of cells)
          if (c.bg) put(w, ox + (gx + .8) * CELL, oy + (gy + .8) * CELL, { bg: s.shadow, fg: s.shadow, ch: '', a: .4 * m }, 0, 0);
      if (s.halo)
        for (const [gx, gy] of haloOf(s.art))
          put(w, ox + gx * CELL, oy + gy * CELL, { fg: s.halo, a: .3 * m }, gx + k, gy);
      for (const [gx, gy, c, sx, sy] of cells) put(w, ox + gx * CELL, oy + gy * CELL, m === 1 ? c : { ...c, a: c.a * m }, sx, sy);
    }
    // (the backdrop: the theme's background color over the scene in the chat's column, theme.json's veil of it, its
    // sides fading over a cell; under the page, so the writing stays on top)
    if (w.col && w.veil) {
      const [l, r] = [w.col[0] - CELL * 2, w.col[1] + CELL * 2], g = ctx.createLinearGradient(l, 0, r, 0), f = CELL / (r - l);
      g.addColorStop(0, `${w.bg}00`);
      g.addColorStop(f, w.bg);
      g.addColorStop(1 - f, w.bg);
      g.addColorStop(1, `${w.bg}00`);
      ctx.globalAlpha = w.veil;
      ctx.fillStyle = g;
      ctx.fillRect(l, 0, r - l, H);
    }
  };

  let wall;
  const stopWall = () => {
    if (!wall) return;
    cancelAnimationFrame(wall.raf);
    removeEventListener('resize', wall.size);
    wall.canvas.remove();
    wall = undefined;
  };
  const startWall = name => {
    if (wall?.name === name) return;
    stopWall();
    const scene = Object.hasOwn(SCENES, name) ? SCENES[name] : undefined;
    if (!scene) return;
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    if (!ctx || !document.body) return;
    canvas.id = 'desktop-theme-wallpaper';
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:-1';
    const w = wall = { name, scene, canvas, ctx, time: 0, last: 0, raf: 0 };
    w.size = () => {
      const dpr = devicePixelRatio || 1;
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `bold ${Math.round(CELL * 13 / 22)}px Consolas, 'Cascadia Code', monospace`; // (a resize resets the context)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      w.measured = 0; // (the column moved with the window)
      draw(w);
    };
    addEventListener('resize', w.size);
    document.body.prepend(canvas);
    w.size();
    if (calm()) return;
    // (the clouds drift three times as fast while Claude works; no frames at all while the window is hidden)
    const frame = now => {
      w.raf = requestAnimationFrame(frame);
      if (now - w.last < 33) return;
      w.time += (w.last ? Math.min(now - w.last, 250) / 1000 : 0) * (w.speed ?? 1) * (root.dataset.themeState === 'thinking' ? 3 : 1);
      w.last = now;
      draw(w);
    };
    w.raf = requestAnimationFrame(frame);
  };

  const paint = t => {
    try {
      // (the person's cell size, but no bigger than a scene's own size, where it has one: a picture scene's cells)
      const most = Object.hasOwn(SCENES, t.wallpaper) ? SCENES[t.wallpaper].size : undefined;
      const cell = Math.min([14, 18, 22].includes(t.cell) ? t.cell : 22, most ?? 22);
      if (cell !== CELL) { CELL = cell; wall?.size(); } // (the font and the column go with it)
      startWall(t.wallpaper);
      if (wall) { // (a switch of motion, speed or size alone keeps the scene running)
        wall.grid = t.motion === 'grid';
        wall.veil = typeof t.veil === 'number' && ok(t.bg) ? Math.max(0, Math.min(1, t.veil)) : 0;
        wall.bg = t.bg;
        wall.speed = typeof t.speed === 'number' ? Math.max(.1, Math.min(16, t.speed)) : 1;
      }
    } catch (err) {
      console.warn('desktop-themes: the wallpaper failed', err);
    }
    document.getElementById('desktop-theme')?.remove();
    const vars = varsOf(t), css = t.css ?? '';
    mode = ok(t.bg) && ok(t.text) && ok(t.accent) ? (luma(rgb(t.bg)) > .5 ? 'light' : 'dark') : undefined;
    syncMode();
    if (css && !safe(css)) console.warn('desktop-themes: the theme\'s css was refused (it loads from outside the page)');
    const text = (vars.length ? `*{${vars.map(([k, v]) => `--${k}:${v} !important`).join(';')}}\n` : '') + (safe(css) ? css : '');
    if (typeof t.id === 'string' && /^[a-z0-9-]{1,40}$/.test(t.id) && text) root.dataset.theme = t.id;
    else delete root.dataset.theme;
    if (!text) return;
    const style = document.createElement('style');
    style.id = 'desktop-theme';
    style.textContent = text;
    document.head.append(style); // (last in <head>: after Claude's own sheets and any other extension's)
  };

  // A switch fades the old theme into the new over .6 s (a view transition: the browser snapshots the page before and
  // after); the first paint at load and a page that asks for less motion change at once. The class keeps the slower
  // fade to this switch, not Claude's own view transitions.
  const fade = document.createElement('style');
  fade.id = 'desktop-theme-fade';
  fade.textContent = 'html.desktop-theme-switching::view-transition-old(root),'
    + 'html.desktop-theme-switching::view-transition-new(root){animation-duration:.6s}';
  document.head.append(fade);
  const calm = () => root.dataset.reduceMotion === 'true' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let painted = false;
  const apply = t => {
    if (!painted || !document.startViewTransition || calm()) paint(t);
    else {
      root.classList.add('desktop-theme-switching');
      document.startViewTransition(() => paint(t)).finished
        .finally(() => root.classList.remove('desktop-theme-switching'));
    }
    painted = true;
  };

  let theme, warned = false;
  const tickTheme = async () => {
    let text;
    try {
      text = await read('theme.json');
    } catch (err) {
      if (!warned) console.warn('desktop-themes: cannot read theme.json', err);
      warned = true;
      return;
    }
    if (text === theme) return;
    theme = text;
    try {
      const t = JSON.parse(text);
      apply(t);
      console.log('desktop-themes:', t.id ?? 'Claude\'s own');
    } catch (err) {
      console.warn('desktop-themes: theme.json is not JSON', err);
    }
  };

  // The turn's state while it lasts, data-theme-state: thinking (Claude works) or waiting (a tool waits for the
  // person's yes); none while idle. One a session left behind (closed mid-turn) goes after 15 minutes without news.
  const STALE = 15 * 60 * 1000;
  let at = 0;
  const setState = e => {
    at = typeof e.at === 'number' ? e.at : Date.now();
    if (['thinking', 'waiting'].includes(e.state)) root.dataset.themeState = e.state;
    else delete root.dataset.themeState;
  };

  let seen, started = false, clear;
  const tickEvent = async () => {
    if (root.dataset.themeState && Date.now() - at > STALE) delete root.dataset.themeState;
    let e;
    try {
      e = JSON.parse(await read('event.json'));
    } catch {
      return; // (not there yet, or caught mid-write: the next tick reads it)
    }
    if (!started) { // (what happened before this page opened: its state still holds, its event is over)
      started = true;
      seen = e.n;
      if (typeof e.at === 'number' && Date.now() - e.at < STALE) setState(e);
      return;
    }
    if (e.n === seen) return;
    seen = e.n;
    setState(e);
    if (!['tool', 'error', 'done'].includes(e.kind)) return;
    delete root.dataset.themeEvent;
    void root.offsetWidth; // (a layout in between, so the same event twice runs its animation again)
    root.dataset.themeEvent = e.kind;
    if (typeof e.tool === 'string' && /^[\w.-]{1,64}$/.test(e.tool)) root.dataset.themeTool = e.tool;
    else delete root.dataset.themeTool;
    clearTimeout(clear);
    clear = setTimeout(() => { delete root.dataset.themeEvent; delete root.dataset.themeTool; }, 1200);
  };

  tickTheme();
  tickEvent();
  setInterval(tickTheme, 1000);
  setInterval(tickEvent, 300);
})();
