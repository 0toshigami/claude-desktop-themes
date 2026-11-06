let SIDE = 0;
const DIM = .25, column = () => {
  SIDE = Math.round((document.querySelector('.dframe-sidebar')?.getBoundingClientRect().right ?? 0) / CELL);
  if (!document.querySelector('[data-cds=AssistantMessage]')) return;
  const r = document.querySelector('[data-cds=ChatComposer] > .bg-surface-3')?.getBoundingClientRect();
  return r?.width ? [r.left, r.right] : undefined;
};
const keep = (col, px) => {
  if (!col) return 1;
  const inside = Math.min(px - col[0], col[1] - px);
  return 1 - (1 - DIM) * Math.max(0, Math.min(1, (inside + CELL) / (3 * CELL)));
};

const put = (w, px, py, c, sx, sy) => {
  const { ctx } = w;
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
    const ox = (w.grid ? Math.round(s.x) : s.x) * CELL, oy = (w.grid ? Math.round(s.y) : s.y) * CELL;
    const m = s.a ?? 1, k = s.key * 997;
    const bw = s.art ? s.art[0].length : s.w, bh = s.art ? s.art.length : s.h;
    if (ox > W + CELL * 4 || oy > H + CELL * 4 || ox + (bw + 4) * CELL < 0 || oy + (bh + 4) * CELL < 0) continue;
    if (s.glow) {
      const g = s.glow, cx = ox + bw / 2 * CELL, cy = oy + bh / 2 * CELL, r = g.r * CELL;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, g.color);
      grad.addColorStop(1, `${g.color}00`);
      ctx.globalAlpha = Math.min(1, g.a * keep(w.veil ? undefined : w.col, cx));
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    const cells = [];
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
    if (s.halo && s.art)
      for (const [gx, gy] of haloOf(s.art))
        put(w, ox + gx * CELL, oy + gy * CELL, { fg: s.halo, a: .3 * m }, gx + k, gy);
    for (const [gx, gy, c, sx, sy] of cells) put(w, ox + gx * CELL, oy + gy * CELL, m === 1 ? c : { ...c, a: c.a * m }, sx, sy);
  }
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
  const scene = Object.hasOwn(SCENES, name) ? SCENES[name] : undefined;
  if (wall?.name === name && wall.scene === scene) return; // (an edited scene of the person's comes as a new object)
  stopWall();
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
    ctx.font = `bold ${Math.round(CELL * 13 / 22)}px Consolas, 'Cascadia Code', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    w.measured = 0;
    draw(w);
  };
  addEventListener('resize', w.size);
  document.body.prepend(canvas);
  w.size();
  if (calm()) return;
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
    const most = Object.hasOwn(SCENES, t.wallpaper) ? SCENES[t.wallpaper].size : undefined;
    const cell = Math.min([14, 18, 22].includes(t.cell) ? t.cell : 22, most ?? 22);
    if (cell !== CELL) { CELL = cell; wall?.size(); }
    startWall(t.wallpaper);
    if (wall) {
      wall.grid = t.motion === 'grid';
      wall.veil = typeof t.veil === 'number' && ok(t.bg) ? Math.max(0, Math.min(1, t.veil)) : 0;
      wall.bg = t.bg;
      wall.speed = typeof t.speed === 'number' ? Math.max(.1, Math.min(16, t.speed)) : 1;
      draw(wall); // (under reduced motion no frame loop runs to show the new settings)
    }
  } catch (err) {
    console.warn('themes-for-claude: the wallpaper failed', err);
  }
  document.getElementById('desktop-theme')?.remove();
  const vars = varsOf(t), css = t.css ?? '';
  mode = ok(t.bg) && ok(t.text) && ok(t.accent) ? (luma(rgb(t.bg)) > .5 ? 'light' : 'dark') : undefined;
  syncMode();
  if (css && !safe(css)) console.warn('themes-for-claude: the theme\'s css was refused (it loads from outside the page)');
  const text = (vars.length ? `*{${vars.map(([k, v]) => `--${k}:${v} !important`).join(';')}}\n` : '') + (safe(css) ? css : '');
  if (typeof t.id === 'string' && /^[a-z0-9-]{1,40}$/.test(t.id) && text) root.dataset.desktopTheme = t.id; // (not data-theme: Claude Desktop sets its own there)
  else delete root.dataset.desktopTheme;
  if (!text) return;
  const style = document.createElement('style');
  style.id = 'desktop-theme';
  style.textContent = text;
  document.head.append(style); // (last: after Claude's own sheets)
};

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

// A person's own scene: scenes/<id>.js?v=<time>, a module the mod copied in (a new v for each change of the file)
const loaded = new Set();
const loadScene = async path => {
  if (typeof path !== 'string' || !/^scenes\/[a-z][a-z0-9-]{1,40}\.js\?v=\d+$/.test(path) || loaded.has(path)) return;
  loaded.add(path);
  try {
    await import(chrome.runtime.getURL(path));
  } catch (err) {
    console.warn('themes-for-claude: cannot load the scene', path, err);
  }
};

let theme, warned = false;
const tickTheme = async () => {
  let text;
  try {
    text = await read('theme.json');
  } catch (err) {
    if (!warned) console.warn('themes-for-claude: cannot read theme.json', err);
    warned = true;
    return;
  }
  if (text === theme) return;
  theme = text;
  try {
    const t = JSON.parse(text);
    await loadScene(t.scene);
    apply(t);
    console.log('themes-for-claude:', t.id ?? 'Claude\'s own');
  } catch (err) {
    console.warn('themes-for-claude: theme.json is not JSON', err);
  }
};

const STALE = 15 * 60 * 1000; // (a session closed mid-turn leaves its state behind)
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
    return; // (caught mid-write: the next tick reads it)
  }
  if (!started) { // (from before this page opened: the state holds, the event is over)
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
  void root.offsetWidth; // (so the same event twice runs its animation again)
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
