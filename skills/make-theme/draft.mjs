import { readFileSync, writeFileSync } from 'node:fs'

const mod = new URL('../../', import.meta.url)
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined }
const need = name => arg(name) ?? (console.error(`missing --${name}`), process.exit(1))
const theme = JSON.parse(readFileSync(need('theme'), 'utf8'))
const own = arg('css') ? readFileSync(arg('css'), 'utf8') : ''
const js = readFileSync(arg('theme-js') ?? new URL('extension/theme.js', mod), 'utf8')
const sheet = name => readFileSync(new URL(`themes/${name}.css`, mod), 'utf8')
const css = [sheet('_base'), theme.wallpaper ? sheet('_wallpaper') : '', own].join('\n')
const T = { ...theme, motion: 'smooth', cell: 18, veil: .4, css }
const start = Number(arg('start') ?? 20)
if (!js.includes('time: 0, last: 0')) throw new Error('theme.js has no scene clock to start')
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)
const status = theme.status?.idle ?? ''

writeFileSync(need('out'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(theme.name)} Draft</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; }
  body { background: var(--cds-page-bg, #262624); color: var(--cds-text-primary, #f5f4ef);
    font: 14px/1.5 var(--cds-font-sans, system-ui, sans-serif); }
  .dframe-sidebar { position: fixed; left: 0; top: 0; bottom: 0; width: 210px; padding: 16px 14px; box-sizing: border-box;
    background: var(--desktop-theme-backdrop, #1f1f1f); font-size: 13px; }
  .dframe-sidebar b { display: block; color: var(--cds-text-accent); margin-bottom: 14px; }
  .dframe-sidebar p { margin: 0 0 10px; color: var(--cds-text-secondary); }
  .main { position: fixed; left: 210px; right: 0; top: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; }
  .chat { width: min(640px, 86%); padding-top: 40px; display: flex; flex-direction: column; gap: 18px; }
  .you { align-self: flex-end; max-width: 70%; padding: 10px 14px; background: var(--cds-surface-2);
    border-radius: var(--cds-radius, 10px); box-shadow: var(--cds-shadow-sm, none); }
  [data-cds=AssistantMessage] p { margin: 0 0 8px; }
  [data-cds=AssistantMessage] code { background: var(--cds-surface-3); padding: 1px 5px; border-radius: 4px; }
  [data-cds=AssistantMessage] a { color: var(--cds-text-accent); }
  [data-cds=ChatComposer] { position: absolute; bottom: 34px; width: min(640px, 86%); }
  .bg-surface-3 { background: var(--cds-surface-3); border-radius: var(--cds-radius-composer, 20px); padding: 14px 16px;
    display: flex; justify-content: space-between; align-items: center; color: var(--cds-text-muted); box-shadow: var(--cds-shadow-md, none); }
  .send { width: 28px; height: 28px; border-radius: 50%; background: var(--cds-fill-accent); }
  .status { position: absolute; bottom: 8px; font-size: 12px; color: var(--cds-text-muted); }
</style></head><body>
<div class="dframe-sidebar"><b>Claude</b><p>New session</p><p>Search</p><p>Customize</p><p style="margin-top:24px">${esc(theme.name)}</p></div>
<div class="main">
  <div class="chat epitaxy-transcript-typography">
    <div class="you" data-cds="UserMessage">Can you make my chat feel like ${esc(theme.name)}?</div>
    <div data-cds="AssistantMessage">
      <p>Sure. This is how <a href="#">${esc(theme.name)}</a> looks: ${esc(theme.tagline)}.</p>
      <p>Writing stays easy to read, <code>code</code> stands out, and the accent marks what you can press.</p>
    </div>
  </div>
  <div data-cds="ChatComposer"><div class="bg-surface-3">Describe a task or ask a question<span class="send"></span></div></div>
  <div class="status">${esc(status)}</div>
</div>
<script>window.chrome = { runtime: { getURL: n => n } }; const T = ${JSON.stringify(T)};
window.fetch = async n => ({ text: async () => (n === 'theme.json' ? JSON.stringify(T) : '{}') });</script>
<script>${js.replace('time: 0, last: 0', `time: ${start}, last: 0`)}</script>
</body></html>
`)
console.log('draft written')
