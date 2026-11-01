// Writes thumb-<id>.html for each live wallpaper. Run with npx tsx, then capture.ps1, then embed.mjs.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { THEMES } from '../../hooks/themes'
import { build } from '../build.mjs'

const mod = fileURLToPath(new URL('../../', import.meta.url))
const out = fileURLToPath(new URL('.', import.meta.url))
const js = build()
const css = readFileSync(`${mod}/themes/_base.css`, 'utf8') + '\n' + readFileSync(`${mod}/themes/_wallpaper.css`, 'utf8')
const AT: Record<string, number> = { moonlit: 12.6, 'cloud-drift': 30, clawd: 20, 'honu-lagoon': 40, 'koi-pond': 40, jellyfish: 30, 'lantern-night': 40, fireflies: 20, 'neon-rain': 20 }
if (!js.includes('time: 0, last: 0')) throw new Error('theme.js changed: no clock start')
for (const t of THEMES.filter(t => t.wallpaper)) {
  const T = JSON.stringify({ id: t.id, bg: t.bg, text: t.text, accent: t.accent, vars: t.vars, wallpaper: t.wallpaper, motion: 'smooth', cell: 22, css })
  writeFileSync(`${out}/thumb-${t.id}.html`, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>html, body { margin: 0; height: 100%; overflow: hidden; }</style></head><body>
<script>window.chrome = { runtime: { getURL: n => n } }; const T = ${T};
window.fetch = async n => ({ text: async () => (n === 'theme.json' ? JSON.stringify(T) : '{}') });</script>
<script>${js.replace('time: 0, last: 0', `time: ${AT[t.id] ?? 30}, last: 0`)}</script>
</body></html>`)
}
console.log('pages', THEMES.filter(t => t.wallpaper).map(t => t.id).join(' '))
