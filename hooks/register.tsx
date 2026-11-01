import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Theme } from '../types'
import { assemble } from '../tools/assemble.mjs'
import { THEMES, parseUserTheme, tile } from './themes'

// Windows only (under %APPDATA%); 
// on macOS it is ~/Library/Application Support/Claude/extensions/<id> (not tested),
// with REACT_PROFILE set by launchctl setenv
const SLOT = 'Claude\\extensions\\fmkadmapgofadopljbjfkapdkoienihi'
const current = atom({ plugin: 'desktop-themes', key: 'current' } as const, 'claude')
const isInstalled = atom({ plugin: 'desktop-themes', key: 'isInstalled' } as const, false)
type Motion = 'smooth' | 'grid'
const motion = atom({ plugin: 'desktop-themes', key: 'motion' } as const, 'smooth' as Motion)
const MOTIONS: Record<Motion, string> = { smooth: 'Smooth', grid: 'Cell by cell' }
const speed = atom({ plugin: 'desktop-themes', key: 'speed' } as const, 1)
const SPEEDS = [1, 2, 4, 8, 16]
const cell = atom({ plugin: 'desktop-themes', key: 'cell' } as const, 22)
const CELLS: Record<number, string> = { 14: 'Small', 18: 'Medium', 22: 'Large' }
const veil = atom({ plugin: 'desktop-themes', key: 'veil' } as const, .4)
const VEILS = [0, .2, .4, .6, .8]
const isStripOpen = atom({ plugin: 'desktop-themes', key: 'isStripOpen' } as const, false)

const slot = async ($: EngineInterface) => {
  const appData = await $.env.get('APPDATA')
  return appData && `${appData}\\${SLOT}`
}

type Look = { motion: Motion; speed: number; cell: number; veil: number }
export const fileOf = (t: Theme, css = '', look: Look = { motion: 'smooth', speed: 1, cell: 22, veil: .4 }) =>
  JSON.stringify(t.bg
    ? { id: t.id, bg: t.bg, text: t.text, accent: t.accent, font: t.font, vars: t.vars, wallpaper: t.wallpaper, ...look, css }
    : {})

const statusOf = (t: Theme | undefined, kind: 'idle' | 'tool' | 'error' | 'done', tool = '') =>
  t?.status?.[kind].split('{tool}').join(tool)

let mine: Theme[] = []
const MINE = '.claude\\desktop-themes'
const loadMine = async ($: EngineInterface) => {
  const home = await $.env.get('USERPROFILE')
  const dir = home && `${home}\\${MINE}`
  if (!dir || !(await $.fs.exists(dir))) return void (mine = [])
  const found: Theme[] = []
  for (const f of await $.fs.list(dir)) {
    if (f.kind !== 'file' || !f.name.endsWith('.json')) continue
    const cssPath = `${dir}\\${f.name.slice(0, -5)}.css`
    const css = (await $.fs.exists(cssPath)) ? String(await $.fs.read(cssPath)) : undefined
    const t = parseUserTheme(String(await $.fs.read(`${dir}\\${f.name}`)), css)
    if (t && !THEMES.some(b => b.id === t.id)) found.push(t)
  }
  mine = found
}
const allThemes = () => [...THEMES, ...mine]

let n = Date.now() // (so a reloaded module never repeats an event number)
const active = async ($: EngineInterface) => {
  const id = await read($, current)
  return id === 'claude' ? undefined : allThemes().find(t => t.id === id)
}
// ponytail: one event.json for every session, so the last to write wins; per-session state needs a file each
type State = 'thinking' | 'waiting' | 'idle'
let state: State = 'idle'
const signal = ($: EngineInterface, kind: '' | 'tool' | 'error' | 'done', tool = '', now: State = state) => {
  state = now
  void (async () => {
    const dir = await slot($)
    if (dir) await $.fs.write(`${dir}\\event.json`, JSON.stringify({ n: ++n, kind, tool, state, at: Date.now() }))
  })().catch(() => {})
}

const check = async ($: EngineInterface) => {
  const dir = await slot($)
  const manifest = dir ? await $.fs.read(`${dir}\\manifest.json`).catch(() => '') : ''
  await update($, isInstalled, () => String(manifest).includes('"theme.js"'))
}

const install = async ($: EngineInterface) => {
  const dir = await slot($)
  if (!dir) {
    $.ui.toast('Only Windows is supported for now.')
    return
  }
  const ext = `${$.plugin.root}/extension`
  const fresh = JSON.parse(String(await $.fs.read(`${ext}/manifest.json`)))
  let manifest = fresh
  try {
    manifest = JSON.parse(String(await $.fs.read(`${dir}\\manifest.json`)))
  } catch {}
  if (manifest !== fresh) {
    const scripts: { js?: string[]; run_at?: string }[] = (manifest.content_scripts ??= [])
    if (!scripts.some(s => s.js?.includes('theme.js'))) scripts.push(fresh.content_scripts[0])
    const war: { resources?: string[] }[] = (manifest.web_accessible_resources ??= [])
    const ours = war.find(w => w.resources?.includes('theme.json'))
    if (ours) ours.resources = [...new Set([...(ours.resources ?? []), 'theme.json', 'event.json'])]
    else war.push(fresh.web_accessible_resources[0])
  }
  const read = async (f: string) => String(await $.fs.read(`${ext}/src/${f}`))
  const scenes = (await $.fs.list(`${ext}/src/scenes`)).filter(f => f.kind === 'file' && f.name.endsWith('.js')).map(f => f.name).sort()
  await $.fs.write(`${dir}\\theme.js`, assemble(await read('core.js'),
    await Promise.all(scenes.map(f => read(`scenes/${f}`))), await read('engine.js')))
  if (!(await $.fs.exists(`${dir}\\theme.json`))) await $.fs.write(`${dir}\\theme.json`, '{}')
  if (!(await $.fs.exists(`${dir}\\event.json`))) await $.fs.write(`${dir}\\event.json`, '{}')
  await $.fs.write(`${dir}\\manifest.json`, JSON.stringify(manifest, null, 2))
  const { exitCode } = await $.process.run(['setx', 'REACT_PROFILE', '1'])
  await check($)
  $.ui.toast(exitCode === 0
    ? 'Installed. Restart Claude Desktop to use the themes.'
    : 'The extension is copied, but REACT_PROFILE=1 could not be set.')
}

const pick = async ($: EngineInterface, t: Theme) => {
  const dir = await slot($)
  if (!dir) return
  const css = async (name: string) => String(await $.fs.read(`${$.plugin.root}/themes/${name}.css`).catch(() => ''))
  const wall = t.wallpaper ? await css('_wallpaper') : ''
  await $.fs.write(`${dir}\\theme.json`, fileOf(t, `${await css('_base')}\n${wall}\n${t.css ?? (await css(t.id))}`,
    { motion: await read($, motion), speed: await read($, speed), cell: await read($, cell), veil: await read($, veil) }))
  await update($, current, () => t.id)
  $.ui.status(statusOf(t, 'idle'))
  $.ui.toast(`Theme: ${t.name}`)
}

const next = <T,>(list: T[]) => (v: T) => list[(list.indexOf(v) + 1) % list.length]!
const repick = async ($: EngineInterface) => {
  const now = await active($)
  if (now) await pick($, now)
}
const toggleMotion = async ($: EngineInterface) => { await update($, motion, next(Object.keys(MOTIONS) as Motion[])); await repick($) }
const nextSpeed = async ($: EngineInterface) => { await update($, speed, next(SPEEDS)); await repick($) }
const nextCell = async ($: EngineInterface) => { await update($, cell, next(Object.keys(CELLS).map(Number))); await repick($) }
const nextVeil = async ($: EngineInterface) => { await update($, veil, next(VEILS)); await repick($) }

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // (not /theme: Claude Code has its own)
    await $.command.register({ name: 'themes', description: 'Pick a theme for Claude Desktop' })
    try {
      await loadMine($).catch(() => {})
      const dir = await slot($)
      const saved = dir ? JSON.parse(String(await $.fs.read(`${dir}\\theme.json`))) : {}
      await update($, current, () => (typeof saved.id === 'string' ? saved.id : 'claude'))
      await update($, motion, () => (Object.hasOwn(MOTIONS, saved.motion) ? saved.motion : 'smooth'))
      await update($, speed, () => (SPEEDS.includes(saved.speed) ? saved.speed : 1))
      await update($, cell, () => (CELLS[saved.cell] ? saved.cell : 22))
      await update($, veil, () => (VEILS.includes(saved.veil) ? saved.veil : .4))
      $.ui.status(statusOf(await active($), 'idle'))
    } catch {}
    return next(e)
  })

  on('command.run', { command: 'themes' }, async $ => {
    await check($).catch(() => {})
    await loadMine($).catch(() => {})
    const open = await update($, isStripOpen, o => !o)
    return { text: open ? 'Theme strip opened above the prompt.' : 'Theme strip closed.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isStripOpen))) return next(e)
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Svg = 'Svg' in els ? els.Svg : undefined
    const now = await read($, current)
    const installed = await read($, isInstalled)
    const move = await read($, motion)
    const pace = await read($, speed)
    const size = await read($, cell)
    const shade = await read($, veil)
    const worn = allThemes().find(t => t.id === now) ?? THEMES[0]!
    const row = (title: string, themes: Theme[]) => (
      <Box key={`row-${title}`} flexDirection="column" gap="xs">
        <Text dimColor>{title}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {themes.map(t => (
            <Box key={`tile-${t.id}`} flexDirection="column" alignItems="center" gap="xs">
              {Svg ? <Svg source={tile(t, t.id === now)} alt={`Preview of ${t.name}`} width={120} /> : null}
              <Button key={`use-${t.id}`} label={t.id === now ? `✓ ${t.name}` : t.name} dimColor={t.id !== now}
                onPress={() => pick($, t)} />
            </Box>
          ))}
        </Box>
      </Box>
    )
    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box flexDirection="row" alignItems="center" justifyContent="space-between">
          <Text>
            <Text weight="semibold">Themes</Text>
            <Text dimColor>{`  ·  ${worn.name}: ${worn.tagline}`}</Text>
          </Text>
          <Button key="close" role="dismiss" label="Close" onPress={() => update($, isStripOpen, () => false)} />
        </Box>
        {!installed ? (
          <Box flexDirection="row" gap={1} alignItems="center">
            <Text dimColor>The extension that paints Claude Desktop is not installed.</Text>
            <Button key="install" label="Install extension" variant="primary" onPress={() => install($)} />
          </Box>
        ) : worn.wallpaper && (
          <Box flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
            <Text dimColor>Wallpaper:</Text>
            <Text dimColor>motion</Text>
            <Button key="motion" label={MOTIONS[move]} onPress={() => toggleMotion($)} />
            <Text dimColor>speed</Text>
            <Button key="speed" label={`${pace}×`} onPress={() => nextSpeed($)} />
            <Text dimColor>size</Text>
            <Button key="cell" label={CELLS[size]} onPress={() => nextCell($)} />
            <Text dimColor>chat backdrop</Text>
            <Button key="veil" label={shade ? `${Math.round(shade * 100)}%` : 'Off'} onPress={() => nextVeil($)} />
          </Box>
        )}
        {row('Live wallpapers', THEMES.filter(t => t.wallpaper))}
        {row('Color themes', THEMES.filter(t => !t.wallpaper))}
        {mine.length ? row('Your themes', mine) : null}
      </Box>
    )
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId && (await active($).catch(() => undefined))) signal($, '', '', 'thinking')
    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.tool_use_id && (await active($).catch(() => undefined)))
      signal($, '', e.tool, 'waiting')
    return verdict
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const t = await active($).catch(() => undefined)
    if (!t) return next(e)
    signal($, 'tool', e.tool, 'thinking')
    $.ui.status(statusOf(t, 'tool', e.tool))
    const result = await next(e)
    if (result.isError) {
      signal($, 'error', e.tool)
      $.ui.status(statusOf(t, 'error', e.tool))
    }
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const t = e.agentId ? undefined : await active($).catch(() => undefined)
    if (t) {
      signal($, 'done', '', 'idle')
      $.ui.status(statusOf(t, 'done'))
    }
    return next(e)
  })
}
