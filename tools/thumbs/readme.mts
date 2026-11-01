// Writes the README's pictures into docs/: a GIF per live wallpaper (recorded from thumb-<id>.html, so run pages.ts
// first) and an SVG per color theme. Needs a Chromium browser and ffmpeg. Run with npx tsx.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { THEMES, preview } from '../../hooks/themes'

const here = fileURLToPath(new URL('.', import.meta.url))
const docs = fileURLToPath(new URL('../../docs/', import.meta.url))
mkdirSync(docs, { recursive: true })

for (const t of THEMES.filter(t => t.bg && !t.wallpaper)) writeFileSync(join(docs, `${t.id}.svg`), preview(t))

const W = 960, H = 540, FPS = 12, SECONDS = 4
const browser = [process.env.THUMB_BROWSER, ...[process.env['ProgramFiles(x86)'], process.env.ProgramFiles, process.env.LOCALAPPDATA]
  .flatMap(d => [`${d}\\Microsoft\\Edge\\Application\\msedge.exe`, `${d}\\Google\\Chrome\\Application\\chrome.exe`])]
  .find(p => p && existsSync(p))
if (!browser) throw new Error('No Chromium browser found (Edge or Chrome). Set THUMB_BROWSER to one.')

const profile = mkdtempSync(join(tmpdir(), 'thumbs-'))
const chrome = spawn(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, `--window-size=${W},${H}`, 'about:blank'])
const wsUrl = await new Promise<string>((ok, no) => {
  let err = ''
  chrome.stderr.on('data', d => { err += d; const m = /ws:\/\/\S+/.exec(err); if (m) ok(m[0]) })
  chrome.on('exit', () => no(new Error(`browser quit: ${err}`)))
})
const port = new URL(wsUrl).port
const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise(ok => ws.addEventListener('open', ok))
let id = 0
const waiting = new Map<number, (r: any) => void>()
ws.addEventListener('message', e => { const m = JSON.parse(String(e.data)); waiting.get(m.id)?.(m.result); waiting.delete(m.id) })
const send = (method: string, params = {}) => new Promise<any>(ok => { waiting.set(++id, ok); ws.send(JSON.stringify({ id, method, params })) })
const sleep = (ms: number) => new Promise(ok => setTimeout(ok, ms))

await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
// ids on the command line: record only those wallpapers (the others' GIFs stay as they are)
const only = process.argv.slice(2)
for (const t of THEMES.filter(t => t.wallpaper && (!only.length || only.includes(t.id)))) {
  const page = join(here, `thumb-${t.id}.html`)
  if (!existsSync(page)) { console.log(`${t.id}: no page, run pages.ts first`); continue }
  await send('Page.navigate', { url: pathToFileURL(page).href })
  await sleep(1500)
  const frames = mkdtempSync(join(tmpdir(), `frames-${t.id}-`))
  for (let i = 0; i < FPS * SECONDS; i++) {
    const started = Date.now()
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(frames, `${String(i).padStart(3, '0')}.png`), Buffer.from(data, 'base64'))
    await sleep(Math.max(0, 1000 / FPS - (Date.now() - started)))
  }
  const gif = join(docs, `${t.id}.gif`)
  await new Promise((ok, no) => spawn('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%03d.png'),
    '-vf', 'scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none', gif], { stdio: 'inherit' })
    .on('exit', c => (c === 0 ? ok(c) : no(new Error(`ffmpeg ${c}`)))))
  rmSync(frames, { recursive: true, force: true })
  console.log(`${t.id}.gif`)
}
ws.close()
chrome.kill()
