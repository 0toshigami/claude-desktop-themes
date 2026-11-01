import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Theme } from '../types'
import { assemble } from '../tools/assemble.mjs'
import { THEMES, parseUserTheme, tile } from './themes'

// Windows only (under %APPDATA%); 
// on macOS it is ~/Library/Application Support/Claude/extensions/<id> (not tested),
// with REACT_PROFILE set by launchctl setenv
const SLOT = 'Claude\\extensions\\fmkadmapgofadopljbjfkapdkoienihi'
const current = atom({ plugin: 'themes-for-claude', key: 'current' } as const, 'claude')
// missing: no extension; restart: copied, but Claude Desktop has not loaded it yet
type Setup = 'missing' | 'restart' | 'ready'
const setup = atom({ plugin: 'themes-for-claude', key: 'setup' } as const, 'missing' as Setup)
type Motion = 'smooth' | 'grid'
type Look = { motion: Motion; speed: number; cell: number; veil: number }
const LOOK: Look = { motion: 'grid', speed: 4, cell: 14, veil: .4 }
const motion = atom({ plugin: 'themes-for-claude', key: 'motion' } as const, LOOK.motion)
const MOTIONS: Record<Motion, string> = { smooth: 'Smooth', grid: 'Cell by cell' }
const speed = atom({ plugin: 'themes-for-claude', key: 'speed' } as const, LOOK.speed)
const SPEEDS = [1, 2, 4, 8, 16]
const cell = atom({ plugin: 'themes-for-claude', key: 'cell' } as const, LOOK.cell)
const CELLS: Record<number, string> = { 14: 'Small', 18: 'Medium', 22: 'Large' }
const veil = atom({ plugin: 'themes-for-claude', key: 'veil' } as const, LOOK.veil)
const VEILS = [0, .2, .4, .6, .8]
const isStripOpen = atom({ plugin: 'themes-for-claude', key: 'isStripOpen' } as const, false)

const slot = async ($: EngineInterface) => {
  const appData = await $.env.get('APPDATA')
  return appData && `${appData}\\${SLOT}`
}

export const fileOf = (t: Theme, css = '', look: Look = LOOK) =>
  JSON.stringify(t.bg
    ? { id: t.id, bg: t.bg, text: t.text, accent: t.accent, font: t.font, vars: t.vars, wallpaper: t.wallpaper, ...look, css }
    : {})

const statusOf = (t: Theme | undefined, kind: 'idle' | 'tool' | 'error' | 'done', tool = '') =>
  t?.status?.[kind].split('{tool}').join(tool)

let mine: Theme[] = []
const MINE = '.claude\\themes-for-claude'
const mineDir = async ($: EngineInterface) => {
  const home = await $.env.get('USERPROFILE')
  return home && `${home}\\${MINE}`
}
// when Claude Desktop started (its oldest process; Claude Code's own sit under \claude-code\): a scene written after
// that is not on its page until a restart. Infinity when unknown, so nothing reads as waiting
let desktopStart: Promise<number> | undefined
const startedAt = ($: EngineInterface) => desktopStart ??= $.process.run(['powershell', '-NoProfile', '-Command',
  "(Get-Process claude | ? Path -notmatch '\\\\claude-code\\\\' | sort StartTime | select -First 1).StartTime.ToUniversalTime().Subtract([datetime]'1970-01-01').TotalMilliseconds"])
  .then(r => Number(r.stdout.trim()) || Infinity, () => Infinity)
// the person's wallpapers whose scene shows only after a restart
let waiting = new Set<string>()

const loadMine = async ($: EngineInterface) => {
  const dir = await mineDir($)
  if (!dir || !(await $.fs.exists(dir))) return void (mine = [])
  const files = await $.fs.list(dir)
  const at = (name: string) => files.find(f => f.kind === 'file' && f.name === name)?.mtimeMs
  const found: Theme[] = []
  for (const f of files) {
    if (f.kind !== 'file' || !f.name.endsWith('.json')) continue
    const id = f.name.slice(0, -5)
    const css = at(`${id}.css`) ? String(await $.fs.read(`${dir}\\${id}.css`)) : undefined
    const t = parseUserTheme(String(await $.fs.read(`${dir}\\${f.name}`)), css, at(`${id}.js`) !== undefined)
    if (t?.wallpaper && t.id !== id) t.wallpaper = undefined // (its scene is <id>.js by the file's name)
    if (t && !THEMES.some(b => b.id === t.id)) found.push(t)
  }
  mine = found
  const scenes = found.filter(t => t.wallpaper)
  const start = scenes.length ? await startedAt($) : Infinity
  waiting = new Set(scenes.filter(t => at(`${t.id}.js`)! > start).map(t => t.id))
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
  // setx reaches only processes started after it, so REACT_PROFILE shows here once Claude Desktop restarted
  const loaded = (await $.env.get('REACT_PROFILE')) === '1'
  await update($, setup, was => !String(manifest).includes('"theme.js"') ? 'missing'
    : loaded && was !== 'restart' ? 'ready' : 'restart')
}

// theme.js: the mod's scenes, then the person's own (<id>.js beside their <id>.json)
const build = async ($: EngineInterface) => {
  const ext = `${$.plugin.root}/extension`
  const read = async (f: string) => String(await $.fs.read(f))
  const scenes = (await $.fs.list(`${ext}/src/scenes`)).filter(f => f.kind === 'file' && f.name.endsWith('.js')).map(f => f.name).sort()
  const dir = await mineDir($)
  // (sorted as tools/build.mjs does, so a theme.js it built reads as current here)
  const own = dir ? mine.filter(t => t.wallpaper).map(t => `${dir}\\${t.id}.js`).sort() : []
  return assemble(await read(`${ext}/src/core.js`),
    await Promise.all([...scenes.map(f => read(`${ext}/src/scenes/${f}`)), ...own.map(read)]), await read(`${ext}/src/engine.js`))
}

// a new or changed scene (the person's, or the mod's after an update) goes into theme.js; the page loads it at start
const rebuild = async ($: EngineInterface) => {
  const dir = await slot($)
  if (!dir || (await read($, setup)) === 'missing') return
  const js = await build($)
  if (String(await $.fs.read(`${dir}\\theme.js`).catch(() => '')) === js) return
  await $.fs.write(`${dir}\\theme.js`, js)
  $.ui.toast('Wallpapers updated. Restart Claude Desktop to see the changes.')
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
  await $.fs.write(`${dir}\\theme.js`, await build($))
  if (!(await $.fs.exists(`${dir}\\theme.json`))) await $.fs.write(`${dir}\\theme.json`, '{}')
  if (!(await $.fs.exists(`${dir}\\event.json`))) await $.fs.write(`${dir}\\event.json`, '{}')
  await $.fs.write(`${dir}\\manifest.json`, JSON.stringify(manifest, null, 2))
  const { exitCode } = await $.process.run(['setx', 'REACT_PROFILE', '1'])
  await update($, setup, () => 'restart')
  $.ui.toast(exitCode === 0
    ? 'Installed. Restart Claude Desktop to use the themes.'
    : 'The extension is copied, but REACT_PROFILE=1 could not be set.')
}

type Manifest = { content_scripts?: { js?: string[] }[]; web_accessible_resources?: { resources?: string[] }[] }
const OURS = ['theme.js', 'theme.json', 'event.json']
// The slot is React DevTools' and other mods may share it, so take out only our entries;
// undefined when nothing but ours was there
export const withoutOurs = (m: Manifest): Manifest | undefined => {
  const scripts = (m.content_scripts ?? []).filter(s => !s.js?.includes('theme.js'))
  if (!scripts.length) return undefined
  const war = (m.web_accessible_resources ?? [])
    .map(w => ({ ...w, resources: w.resources?.filter(r => !OURS.includes(r)) }))
    .filter(w => w.resources?.length)
  return { ...m, content_scripts: scripts, web_accessible_resources: war }
}

const remove = async ($: EngineInterface) => {
  const dir = await slot($)
  if (!dir) return
  let manifest: Manifest | undefined
  try {
    manifest = JSON.parse(String(await $.fs.read(`${dir}\\manifest.json`)))
  } catch {}
  // an unreadable manifest may still belong to another mod: then delete only our files, never the folder
  const rest = manifest && withoutOurs(manifest)
  let exitCode: number | null
  if (!manifest || rest) {
    if (rest) await $.fs.write(`${dir}\\manifest.json`, JSON.stringify(rest, null, 2))
    ;({ exitCode } = await $.process.run(['cmd', '/c', 'del', '/q', ...OURS.map(f => `${dir}\\${f}`)]))
  } else {
    // (SetEnvironmentVariable, not reg delete: it tells Windows, so apps started later see the change)
    await $.process.run(['powershell', '-NoProfile', '-Command',
      "[Environment]::SetEnvironmentVariable('REACT_PROFILE', $null, 'User')"])
    ;({ exitCode } = await $.process.run(['cmd', '/c', 'rmdir', '/s', '/q', dir]))
  }
  await update($, setup, () => 'missing')
  await update($, current, () => 'claude')
  $.ui.status(undefined)
  $.ui.toast(exitCode === 0
    ? 'Extension removed. Restart Claude Desktop; then you can uninstall the plugin.'
    : `Could not remove every file. Delete them by hand in ${dir}`)
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
      await update($, motion, () => (Object.hasOwn(MOTIONS, saved.motion) ? saved.motion : LOOK.motion))
      await update($, speed, () => (SPEEDS.includes(saved.speed) ? saved.speed : LOOK.speed))
      await update($, cell, () => (CELLS[saved.cell] ? saved.cell : LOOK.cell))
      await update($, veil, () => (VEILS.includes(saved.veil) ? saved.veil : LOOK.veil))
      $.ui.status(statusOf(await active($), 'idle'))
    } catch {}
    return next(e)
  })

  on('command.run', { command: 'themes' }, async $ => {
    await check($).catch(() => {})
    await loadMine($).catch(() => {})
    await rebuild($).catch(() => {})
    const open = await update($, isStripOpen, o => !o)
    return { text: open ? 'Theme strip opened above the prompt.' : 'Theme strip closed.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isStripOpen))) return next(e)
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Svg = 'Svg' in els ? els.Svg : undefined
    const now = await read($, current)
    const stage = await read($, setup)
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
              {waiting.has(t.id) ? <Text key={`wait-${t.id}`} dimColor>Restart Claude to show</Text> : null}
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
          <Box flexDirection="row" gap={1}>
            {stage === 'missing' ? null
              : <Button key="remove" label="Remove extension" dimColor onPress={() => remove($)} />}
            <Button key="close" role="dismiss" label="Close" onPress={() => update($, isStripOpen, () => false)} />
          </Box>
        </Box>
        {stage === 'missing' ? (
          <Box key="notice" flexDirection="column" gap="xs" padding={1} borderStyle="round" borderColor="warning">
            <Text color="warning" weight="semibold">One step first: install the extension</Text>
            <Text>It paints the themes on Claude Desktop. After it is installed, restart Claude Desktop.</Text>
            <Box flexDirection="row">
              <Button key="install" label="Install extension" variant="primary" onPress={() => install($)} />
            </Box>
          </Box>
        ) : stage === 'restart' ? (
          <Box key="notice" flexDirection="column" gap="xs" padding={1} borderStyle="round" borderColor="success">
            <Text color="success" weight="semibold">Installed. Now restart Claude Desktop</Text>
            <Text>Quit Claude Desktop fully (also from the tray), open it again, then type /themes.</Text>
            <Text dimColor>Still here after a restart? Set the user environment variable REACT_PROFILE=1 by hand, then restart again.</Text>
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
        {stage === 'ready' ? row('Live wallpapers', THEMES.filter(t => t.wallpaper)) : null}
        {stage === 'ready' ? row('Color themes', THEMES.filter(t => !t.wallpaper)) : null}
        {stage === 'ready' && mine.length ? row('Your themes', mine) : null}
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
