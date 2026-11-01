const CLAWD = ['.#######.', '.#o###o#.', '#########', '.#######.'];
const CLAWDS = [[...CLAWD, '.#.#.#.#.'], [...CLAWD, '#.#.#.#..']];

SCENES.clawd = {
  cell: (x, y, cols, rows, t) => {
    const cx = cols * .8, cy = rows * .3;
    let cover = 0, glow = false;
    for (const [sx, sy] of [[.25, .25], [.75, .25], [.25, .75], [.75, .75]]) {
      const dx = x + sx - cx, dy = y + sy - cy, r = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      if (r <= 1.2) { cover++; continue; }
      for (let k = 0; k < 11; k++) {
        let da = Math.abs(ang - (k * Math.PI * 2 / 11 + t * .04)) % (Math.PI * 2);
        da = Math.min(da, Math.PI * 2 - da);
        if (da >= Math.PI / 2) continue;
        const len = 6.5 + 5 * hash(k, 1) + Math.sin(t * 1.4 + k) * .7, along = r * Math.cos(da), off = r * Math.sin(da);
        if (along <= len && off <= .35 + .55 * (1 - along / len) ** .7) { cover++; break; }
        if (along <= len + 1.2 && off <= 1.6) glow = true;
      }
    }
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
};
