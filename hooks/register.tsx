import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Theme } from '../types'
import { THEMES, parseUserTheme, preview, tile } from './themes'

export { THEMES, preview, tile }

// The extension that paints Claude Desktop (extension/ here) sits in the React DevTools slot, which Claude Desktop
// loads at startup while REACT_PROFILE=1. The theme strip installs it; picking a theme writes theme.json there, and
// tool calls and turns write event.json, which it reads and turns into the theme's reactions.
const SLOT = 'Claude\\extensions\\fmkadmapgofadopljbjfkapdkoienihi' // under %APPDATA%
const current = atom({ plugin: 'desktop-themes', key: 'current' } as const, 'claude')
const isInstalled = atom({ plugin: 'desktop-themes', key: 'isInstalled' } as const, false)
type Motion = 'smooth' | 'grid'
const motion = atom({ plugin: 'desktop-themes', key: 'motion' } as const, 'smooth' as Motion)
const MOTIONS: Record<Motion, string> = { smooth: 'Smooth', grid: 'Cell by cell' } // (the motion button goes round these)
const speed = atom({ plugin: 'desktop-themes', key: 'speed' } as const, 1)
const SPEEDS = [1, 2, 4, 8, 16] // (the speed button goes round these)
const cell = atom({ plugin: 'desktop-themes', key: 'cell' } as const, 22)
const CELLS: Record<number, string> = { 14: 'Small', 18: 'Medium', 22: 'Large' } // (and the size button these)
// (the backdrop behind the chat's column: how much of the theme's background color covers the scene there)
const veil = atom({ plugin: 'desktop-themes', key: 'veil' } as const, .4)
const VEILS = [0, .2, .4, .6, .8]
// (the theme strip above the prompt, which /themes opens and closes)
const isStripOpen = atom({ plugin: 'desktop-themes', key: 'isStripOpen' } as const, false)

// ponytail: Windows only; on macOS the slot is ~/Library/Application Support/Claude/extensions/<id> and the variable
// is set with launchctl setenv
const slot = async ($: EngineInterface) => {
  const appData = await $.env.get('APPDATA')
  return appData && `${appData}\\${SLOT}`
}

// What theme.json holds for a theme, its stylesheet and how its wallpaper moves: no colors gives Claude's own back
type Look = { motion: Motion; speed: number; cell: number; veil: number }
export const fileOf = (t: Theme, css = '', look: Look = { motion: 'smooth', speed: 1, cell: 22, veil: .4 }) =>
  JSON.stringify(t.bg
    ? { id: t.id, bg: t.bg, text: t.text, accent: t.accent, font: t.font, vars: t.vars, wallpaper: t.wallpaper, ...look, css }
    : {})

const statusOf = (t: Theme | undefined, kind: 'idle' | 'tool' | 'error' | 'done', tool = '') =>
  t?.status?.[kind].replace('{tool}', tool)

// The person's own themes (the make-theme skill writes them): <id>.json and <id>.css in their themes folder, read at
// the session's start and each time /themes opens the strip; one with a built-in's id is left out
let mine: Theme[] = []
const MINE = '.claude\\desktop-themes' // (under the home folder)
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

let n = Date.now() // (event.json's count: from the clock, so a reloaded module never repeats one)
const active = async ($: EngineInterface) => {
  const id = await read($, current)
  return id === 'claude' ? undefined : allThemes().find(t => t.id === id)
}
// The turn's state, which the theme shows while it lasts: thinking from the main loop's turn start, waiting while a
// tool waits for the person's yes, idle from its end.
// ponytail: one file for every session, so the last session to write wins; a theme per session would need its own
type State = 'thinking' | 'waiting' | 'idle'
let state: State = 'idle'
// Tells the extension what happened (kind, '' for a state change alone) and the state now; never in a tool's way:
// not awaited, and a failed write is dropped
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

// Puts the extension in the slot: theme.js beside whatever is there, its manifest merged into the one there (another
// extension may sit in the slot already), and REACT_PROFILE=1 for the user
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
  await $.fs.write(`${dir}\\theme.js`, String(await $.fs.read(`${ext}/theme.js`)))
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
  $.ui.status(statusOf(t.bg ? t : undefined, 'idle'))
  $.ui.toast(`Theme: ${t.name}`)
}

// Switches how the wallpapers move, or steps their speed to the next, and rewrites the theme on now to take it
const toggleMotion = async ($: EngineInterface) => {
  const all = Object.keys(MOTIONS) as Motion[]
  await update($, motion, m => all[(all.indexOf(m) + 1) % all.length] ?? 'smooth')
  const now = await active($)
  if (now) await pick($, now)
}
const nextSpeed = async ($: EngineInterface) => {
  await update($, speed, s => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length] ?? 1)
  const now = await active($)
  if (now) await pick($, now)
}
const nextCell = async ($: EngineInterface) => {
  const sizes = Object.keys(CELLS).map(Number)
  await update($, cell, c => sizes[(sizes.indexOf(c) + 1) % sizes.length] ?? 22)
  const now = await active($)
  if (now) await pick($, now)
}
const nextVeil = async ($: EngineInterface) => {
  await update($, veil, v => VEILS[(VEILS.indexOf(v) + 1) % VEILS.length] ?? .4)
  const now = await active($)
  if (now) await pick($, now)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // (not /theme: that one is Claude Code's own, for its terminal colors)
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
    await loadMine($).catch(() => {}) // (a theme the skill just wrote shows at once)
    const open = await update($, isStripOpen, o => !o)
    return { text: open ? 'Theme strip opened above the prompt.' : 'Theme strip closed.' }
  })

  // The theme strip: the theme on now in its heading, the wallpaper's settings under it while one is on (at the top,
  // so they stay in sight above the tiles), then the live wallpapers and the color themes, each a tile with its name
  // under it, a press on the name puts it on; Close or /themes again closes it
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
    // (a row of tiles under a small heading: the scene or window, the name under it to press)
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
            <Button key="motion" label={MOTIONS[move] ?? 'Smooth'} onPress={() => toggleMotion($)} />
            <Text dimColor>speed</Text>
            <Button key="speed" label={`${pace}×`} onPress={() => nextSpeed($)} />
            <Text dimColor>size</Text>
            <Button key="cell" label={CELLS[size] ?? 'Large'} onPress={() => nextCell($)} />
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

  // (asked: the person's dialog or auto mode's classifier decides; a real call only, not a query)
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    if (verdict.decision === 'ask' && e.tool_use_id && (await active($).catch(() => undefined)))
      signal($, '', e.tool, 'waiting')
    return verdict
  }).catch(($, e, next) => next(e)) // (the check is the engine's: a failure here replays its verdict)

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
  }).catch(($, e, next) => next(e)) // (a theme never stops a tool: on a failure the call goes on, once)

  on('turn.complete', async ($, e, next) => {
    const t = e.agentId ? undefined : await active($).catch(() => undefined) // (a subagent's end is not the turn's)
    if (t) {
      signal($, 'done', '', 'idle')
      $.ui.status(statusOf(t, 'done'))
    }
    return next(e)
  })
}
