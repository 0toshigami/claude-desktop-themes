import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Theme } from '../types'
import { assemble, sceneModule } from '../tools/assemble.mjs'
import { THEMES, parseUserTheme, tile } from './themes'

// The React DevTools slot under Claude Desktop's userData: %APPDATA%\Claude or %LOCALAPPDATA%\Claude-Data\<id> on
// Windows, ~/Library/Application Support/Claude on macOS. Claude Desktop loads it when REACT_PROFILE=1.
const SLOT = ['extensions', 'fmkadmapgofadopljbjfkapdkoienihi']
const MAC_SUPPORT = ['Library', 'Application Support']
// macOS: what sets REACT_PROFILE=1 again at each login (launchctl setenv lasts until a restart)
const AGENT = 'com.github.0toshigami.themes-for-claude'
const QUIT = { windows: 'also from the tray', macos: 'Cmd+Q' } as const
const BY_HAND = {
  windows: 'Set the user environment variable REACT_PROFILE=1 by hand',
  macos: 'Run launchctl setenv REACT_PROFILE 1 in Terminal',
} as const
const UNSET = {
  windows: 'Delete the user environment variable REACT_PROFILE by hand',
  macos: 'Run launchctl unsetenv REACT_PROFILE in Terminal',
} as const
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
// the strip shows one kind of theme at a time
type Tab = 'live' | 'color' | 'mine'
const TABS: Record<Tab, string> = { live: 'Live wallpapers', color: 'Color themes', mine: 'Yours' }
const tab = atom({ plugin: 'themes-for-claude', key: 'tab' } as const, 'live' as Tab)
// Remove extension asks once more before it deletes anything
const confirmRemove = atom({ plugin: 'themes-for-claude', key: 'confirmRemove' } as const, false)

// Paths join with the separator the base path already uses: Windows paths hold a backslash, macOS ones never do
const join = (base: string, ...parts: string[]) => [base, ...parts].join(base.includes('\\') ? '\\' : '/')

// Newer Windows installs keep their data in %LOCALAPPDATA%\Claude-Data\<package id>; the one in use holds
// Local State (the folder can also be there empty, beside a %APPDATA%\Claude still in use)
const claudeData = async ($: EngineInterface) => {
  const local = await $.env.get('LOCALAPPDATA')
  const root = local && join(local, 'Claude-Data')
  if (!root || !(await $.fs.exists(root))) return undefined
  for (const d of await $.fs.list(root))
    if (d.kind !== 'file' && (await $.fs.exists(join(root, d.name, 'Local State')))) return join(root, d.name)
  return undefined
}

// home: where the person's own themes folder is (empty when unknown); userData: Claude Desktop's own data folder;
// undefined: neither Windows nor macOS with Claude Desktop
type Host = { os: 'windows' | 'macos'; home: string; userData: string }
const hostOf = async ($: EngineInterface): Promise<Host | undefined> => {
  const appData = await $.env.get('APPDATA')
  if (appData) {
    const userData = (await claudeData($).catch(() => undefined)) ?? join(appData, 'Claude')
    return { os: 'windows', home: (await $.env.get('USERPROFILE')) ?? '', userData }
  }
  const home = await $.env.get('HOME')
  const userData = home && join(home, ...MAC_SUPPORT, 'Claude')
  return userData && (await $.fs.exists(userData)) ? { os: 'macos', home: home!, userData } : undefined
}

const slot = async ($: EngineInterface) => {
  const host = await hostOf($)
  return host && join(host.userData, ...SLOT)
}
const agentFile = (host: Host) => join(host.home, 'Library', 'LaunchAgents', `${AGENT}.plist`)
const AGENT_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${AGENT}</string>
  <key>ProgramArguments</key>
  <array><string>/bin/launchctl</string><string>setenv</string><string>REACT_PROFILE</string><string>1</string></array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
`

// scene: the module path of the person's own scene, which the page imports
export const fileOf = (t: Theme, css = '', look: Look = LOOK, scene?: string) =>
  JSON.stringify(t.bg
    ? { id: t.id, bg: t.bg, text: t.text, accent: t.accent, font: t.font, vars: t.vars, wallpaper: t.wallpaper, scene, ...look, css }
    : {})

let mine: Theme[] = []
const MINE = ['.claude', 'themes-for-claude']
const mineDir = async ($: EngineInterface) => {
  const host = await hostOf($)
  return host?.home ? join(host.home, ...MINE) : undefined
}
// when each of the person's scenes last changed: the page loads it again on a new time
let sceneAt: Record<string, number> = {}

const loadMine = async ($: EngineInterface) => {
  const dir = await mineDir($)
  if (!dir || !(await $.fs.exists(dir))) return void (mine = [])
  const files = await $.fs.list(dir)
  const at = (name: string) => files.find(f => f.kind === 'file' && f.name === name)?.mtimeMs
  const found: Theme[] = []
  for (const f of files) {
    if (f.kind !== 'file' || !f.name.endsWith('.json')) continue
    const id = f.name.slice(0, -5)
    const css = at(`${id}.css`) ? String(await $.fs.read(join(dir, `${id}.css`))) : undefined
    const t = parseUserTheme(String(await $.fs.read(join(dir, f.name))), css, at(`${id}.js`) !== undefined)
    if (t?.wallpaper && t.id !== id) t.wallpaper = undefined // (its scene is <id>.js by the file's name)
    const jpg = files.find(f => f.kind === 'file' && f.name === `${id}.jpg`)
    // (a missing, large or broken picture leaves the tile drawn from the theme's colors)
    const pic = t?.wallpaper && jpg && jpg.size < 16000
      ? (await $.fs.read(join(dir, `${id}.jpg`), { as: 'bytes' }).catch(() => undefined))?.base64 : undefined
    if (t && pic?.startsWith('/9j/')) t.thumb = `data:image/jpeg;base64,${pic}`
    if (t && !THEMES.some(b => b.id === t.id)) found.push(t)
  }
  mine = found
  sceneAt = Object.fromEntries(found.filter(t => t.wallpaper).map(t => [t.id, Math.round(at(`${t.id}.js`)!)]))
}
const allThemes = () => [...THEMES, ...mine]
const tabOf = (t: Theme): Tab => mine.includes(t) ? 'mine' : t.wallpaper ? 'live' : 'color'

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
    if (dir) await $.fs.write(join(dir, 'event.json'), JSON.stringify({ n: ++n, kind, tool, state, at: Date.now() }))
  })().catch(() => {})
}

const check = async ($: EngineInterface) => {
  const dir = await slot($)
  const manifest = dir ? await $.fs.read(join(dir, 'manifest.json')).catch(() => '') : ''
  // setx and launchctl setenv reach only processes started after them, so REACT_PROFILE shows here once Claude Desktop restarted
  const loaded = (await $.env.get('REACT_PROFILE')) === '1'
  await update($, setup, was => !String(manifest).includes('"theme.js"') ? 'missing'
    : loaded && was !== 'restart' ? 'ready' : 'restart')
}

// theme.js: the mod's scenes (the person's own load on their own, see pick)
const build = async ($: EngineInterface) => {
  const ext = `${$.plugin.root}/extension`
  const read = async (f: string) => String(await $.fs.read(`${ext}/src/${f}`))
  const scenes = (await $.fs.list(`${ext}/src/scenes`)).filter(f => f.kind === 'file' && f.name.endsWith('.js')).map(f => f.name).sort()
  return assemble(await read('core.js'), await Promise.all(scenes.map(f => read(`scenes/${f}`))), await read('engine.js'))
}

// the slot's manifest with our entries in (the slot is React DevTools' and other mods may share it)
const withOurs = async ($: EngineInterface, dir: string) => {
  const fresh = JSON.parse(String(await $.fs.read(`${$.plugin.root}/extension/manifest.json`)))
  let manifest = fresh
  try {
    manifest = JSON.parse(String(await $.fs.read(join(dir, 'manifest.json'))))
  } catch {}
  if (manifest !== fresh) {
    const scripts: { js?: string[]; run_at?: string }[] = (manifest.content_scripts ??= [])
    if (!scripts.some(s => s.js?.includes('theme.js'))) scripts.push(fresh.content_scripts[0])
    const war: { resources?: string[] }[] = (manifest.web_accessible_resources ??= [])
    const ours = war.find(w => w.resources?.includes('theme.json'))
    if (ours) ours.resources = [...new Set([...(ours.resources ?? []), ...OURS])]
    else war.push(fresh.web_accessible_resources[0])
  }
  return JSON.stringify(manifest, null, 2)
}

// after a mod update: its scenes into theme.js, its entries into the manifest; the page loads both at start
const rebuild = async ($: EngineInterface) => {
  const dir = await slot($)
  if (!dir || (await read($, setup)) === 'missing') return
  const now = async (f: string) => String(await $.fs.read(join(dir, f)).catch(() => ''))
  const js = await build($), manifest = await withOurs($, dir)
  if ((await now('theme.js')) === js && JSON.stringify(JSON.parse(await now('manifest.json'))) === JSON.stringify(JSON.parse(manifest))) return
  await $.fs.write(join(dir, 'theme.js'), js)
  await $.fs.write(join(dir, 'manifest.json'), manifest)
  $.ui.toast('The extension is updated. Restart Claude Desktop to see the changes.')
}

// REACT_PROFILE=1 for the apps started from now on, and after the next login
const setProfile = async ($: EngineInterface, host: Host) => {
  if (host.os === 'windows') return (await $.process.run(['setx', 'REACT_PROFILE', '1'])).exitCode
  await $.fs.write(agentFile(host), AGENT_PLIST)
  return (await $.process.run(['launchctl', 'setenv', 'REACT_PROFILE', '1'])).exitCode
}
// true when the apps started from now on no longer get REACT_PROFILE
const clearProfile = async ($: EngineInterface, host: Host) => {
  if (host.os === 'windows') {
    // (setx first: it tells Windows, so apps started later see the change; reg delete then drops the empty value it leaves)
    const { exitCode } = await $.process.run(['setx', 'REACT_PROFILE', ''])
    await $.process.run(['reg', 'delete', 'HKCU\\Environment', '/v', 'REACT_PROFILE', '/f'])
    return exitCode === 0
  }
  const { exitCode } = await $.process.run(['launchctl', 'unsetenv', 'REACT_PROFILE'])
  await $.process.run(['rm', '-f', agentFile(host)])
  return exitCode === 0
}

const install = async ($: EngineInterface) => {
  const host = await hostOf($)
  const dir = await slot($)
  if (!host || !dir) {
    $.ui.toast('Only Windows and macOS are supported for now.')
    return
  }
  await $.fs.write(join(dir, 'theme.js'), await build($))
  if (!(await $.fs.exists(join(dir, 'theme.json')))) await $.fs.write(join(dir, 'theme.json'), '{}')
  if (!(await $.fs.exists(join(dir, 'event.json')))) await $.fs.write(join(dir, 'event.json'), '{}')
  await $.fs.write(join(dir, 'manifest.json'), await withOurs($, dir))
  const exitCode = await setProfile($, host)
  await update($, setup, () => 'restart')
  $.ui.toast(exitCode === 0
    ? `Installed. Quit Claude Desktop fully (${QUIT[host.os]}) and open it again to use the themes.`
    : 'The extension is copied, but REACT_PROFILE=1 could not be set.')
}

type Manifest = { content_scripts?: { js?: string[] }[]; web_accessible_resources?: { resources?: string[] }[] }
// our web-accessible files, the scenes among them a pattern; with theme.js, the files we delete on remove
const OURS = ['theme.json', 'event.json', 'scenes/*.js']
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
  const host = await hostOf($)
  const dir = await slot($)
  await update($, confirmRemove, () => false)
  if (!host || !dir) return $.ui.toast('Claude Desktop\'s data folder was not found, so there is nothing to remove here.')
  let manifest: Manifest | undefined
  try {
    manifest = JSON.parse(String(await $.fs.read(join(dir, 'manifest.json'))))
  } catch {}
  // an unreadable manifest may still belong to another mod: then delete only our files, never the folder
  const rest = manifest && withoutOurs(manifest)
  let exitCode: number | null
  let cleared = true
  if (!manifest || rest) {
    if (rest) await $.fs.write(join(dir, 'manifest.json'), JSON.stringify(rest, null, 2))
    const files = ['theme.js', ...OURS].map(f => join(dir, ...f.split('/')))
    // (del expands the scenes/*.js pattern itself; rm takes the scene files by name, as the folder holds no other)
    const scenes = join(dir, 'scenes')
    const ownScenes = host.os === 'macos' && (await $.fs.exists(scenes))
      ? (await $.fs.list(scenes)).filter(f => f.kind === 'file' && f.name.endsWith('.js')).map(f => join(scenes, f.name)) : []
    ;({ exitCode } = await $.process.run(host.os === 'windows'
      ? ['cmd', '/c', 'del', '/q', ...files]
      : ['rm', '-f', '--', ...files.filter(f => !f.endsWith('*.js')), ...ownScenes]))
  } else {
    cleared = await clearProfile($, host)
    ;({ exitCode } = await $.process.run(host.os === 'windows' ? ['cmd', '/c', 'rmdir', '/s', '/q', dir] : ['rm', '-rf', dir]))
  }
  await update($, setup, () => 'missing')
  await update($, current, () => 'claude')
  $.ui.toast(exitCode !== 0 ? `Could not remove every file. Delete them by hand in ${dir}`
    : !cleared ? `Extension removed, but REACT_PROFILE is still set. ${UNSET[host.os]}, then restart Claude Desktop.`
    : 'Extension removed. Restart Claude Desktop; then you can uninstall the plugin.')
}

const pick = async ($: EngineInterface, t: Theme) => {
  const dir = await slot($)
  if (!dir) return
  const css = async (name: string) => String(await $.fs.read(`${$.plugin.root}/themes/${name}.css`).catch(() => ''))
  const wall = t.wallpaper ? await css('_wallpaper') : ''
  // the person's own scene: copied in as a module beside theme.js, a new ?v= each time the file changes
  const own = t.wallpaper && Object.hasOwn(sceneAt, t.id) ? await mineDir($) : undefined
  if (own) await $.fs.write(join(dir, 'scenes', `${t.id}.js`), sceneModule(String(await $.fs.read(join(own, `${t.id}.js`)))))
  await $.fs.write(join(dir, 'theme.json'), fileOf(t, `${await css('_base')}\n${wall}\n${t.css ?? (await css(t.id))}`,
    { motion: await read($, motion), speed: await read($, speed), cell: await read($, cell), veil: await read($, veil) },
    own ? `scenes/${t.id}.js?v=${sceneAt[t.id]}` : undefined))
  await update($, current, () => t.id)
  $.ui.toast(`Theme: ${t.name}`)
}

// a wallpaper setting changed, and the worn theme written again with it
const relook = async ($: EngineInterface, set: () => Promise<unknown>) => {
  await set()
  const now = await active($)
  if (now?.wallpaper) await pick($, now)
}

// "+ Make your own": the make-theme skill's opening line in the prompt box, never over a draft the person is writing
const makeOwn = async ($: EngineInterface) => {
  if ((await $.prompt.read()).text.trim()) return $.ui.toast('Send or clear your draft, then ask Claude: "make me a theme"')
  if ((await $.prompt.fill({ text: 'Make me a theme: ' })).refusal) $.ui.toast('The prompt box is busy. Ask Claude: "make me a theme"')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // (not /theme: Claude Code has its own)
    await $.command.register({ name: 'themes', description: 'Pick a theme for Claude Desktop' })
    try {
      await loadMine($).catch(() => {})
      const dir = await slot($)
      const saved = dir ? JSON.parse(String(await $.fs.read(join(dir, 'theme.json')))) : {}
      await update($, current, () => (typeof saved.id === 'string' ? saved.id : 'claude'))
      await update($, motion, () => (Object.hasOwn(MOTIONS, saved.motion) ? saved.motion : LOOK.motion))
      await update($, speed, () => (SPEEDS.includes(saved.speed) ? saved.speed : LOOK.speed))
      await update($, cell, () => (CELLS[saved.cell] ? saved.cell : LOOK.cell))
      await update($, veil, () => (VEILS.includes(saved.veil) ? saved.veil : LOOK.veil))
    } catch {}
    $.ui.status(undefined) // (what a version before 0.7.4 left there)
    return next(e)
  })

  on('command.run', { command: 'themes' }, async $ => {
    await check($).catch(() => {})
    await loadMine($).catch(() => {})
    await rebuild($).catch(() => {})
    const open = await update($, isStripOpen, o => !o)
    if (open) {
      const id = await read($, current)
      const worn = allThemes().find(t => t.id === id)
      await update($, tab, () => (worn ? tabOf(worn) : 'color'))
      await update($, confirmRemove, () => false)
    }
    return { text: open ? 'Theme strip opened above the prompt.' : 'Theme strip closed.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, isStripOpen))) return next(e)
    const els = $.ui.resolve(e)
    const { Box, Text, Button, Select } = els
    const Svg = 'Svg' in els ? els.Svg : undefined
    const now = await read($, current)
    const stage = await read($, setup)
    const move = await read($, motion)
    const pace = await read($, speed)
    const size = await read($, cell)
    const shade = await read($, veil)
    const showing = await read($, tab)
    const asking = await read($, confirmRemove)
    const os = (await hostOf($))?.os ?? 'windows'
    const worn = allThemes().find(t => t.id === now) ?? THEMES[0] as Theme
    const shown = allThemes().filter(t => tabOf(t) === showing)
    const removeButton = <Button key="remove" label="Remove extension" dimColor onPress={() => update($, confirmRemove, () => true)} />
    // the whole tile is a hover scope: the pointer on the picture lights its name and shows its tagline in the header
    const tileOf = (t: Theme) => (
      <Box key={`tile-${t.id}`} hover={{ scope: `tip-${t.id}` }} flexDirection="column" alignItems="center" gap="xs">
        {Svg ? <Svg source={tile(t, t.id === now)} alt={`Preview of ${t.name}`} width={100} /> : null}
        <Button key={`use-${t.id}`} label={t.id === now ? `✓ ${t.name}` : t.name} dimColor={t.id !== now}
          variant={t.id === now ? 'primary' : undefined} hover={{ dimColor: false }} onPress={() => pick($, t)} />
      </Box>
    )
    const look = stage === 'ready' && (showing === 'live' || worn.wallpaper) ? (
      <Box key="look" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
        <Text dimColor>Wallpaper</Text>
        <Select key="motion" label="Motion" value={move}
          options={Object.entries(MOTIONS).map(([value, label]) => ({ value, label }))}
          onSelect={v => relook($, () => update($, motion, () => (v === 'smooth' ? 'smooth' : 'grid')))} />
        <Select key="speed" label="Speed" value={String(pace)}
          options={SPEEDS.map(s => ({ value: String(s), label: `${s}×` }))}
          onSelect={v => relook($, () => update($, speed, () => Number(v)))} />
        <Select key="cell" label="Size" value={String(size)}
          options={Object.entries(CELLS).map(([value, label]) => ({ value, label }))}
          onSelect={v => relook($, () => update($, cell, () => Number(v)))} />
        <Select key="veil" label="Chat backdrop" value={String(shade)}
          options={VEILS.map(v => ({ value: String(v), label: v ? `${Math.round(v * 100)}%` : 'Off' }))}
          onSelect={v => relook($, () => update($, veil, () => Number(v)))} />
      </Box>
    ) : null
    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={1}>
          {/* what is worn, always in sight whichever tab is open: its picture and its name */}
          <Box flexDirection="row" flexShrink={1} gap={1} alignItems="center">
            <Text weight="semibold">Themes</Text>
            <Text dimColor>Wearing</Text>
            {Svg ? <Svg source={tile(worn, false)} alt={`Preview of ${worn.name}`} width={48} /> : null}
            <Text weight="semibold">{worn.name}</Text>
            {shown.map(t => (
              <Box key={`tip-${t.id}`} display="none" hover={{ scope: `tip-${t.id}`, display: 'flex' }} flexShrink={1}>
                <Text dimColor italic wrap="truncate-end">{`  —  ${t.name}: ${t.tagline}`}</Text>
              </Box>
            ))}
          </Box>
          <Button key="close" role="dismiss" label="Close" onPress={() => update($, isStripOpen, () => false)} />
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
            <Text>{`Quit Claude Desktop fully (${QUIT[os]}), open it again, then type /themes.`}</Text>
            <Text dimColor>{`Still here after a restart? ${BY_HAND[os]}, then restart again.`}</Text>
          </Box>
        ) : (
          <Box key="tabs" flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Box flexDirection="row" gap="xs">
              {(Object.keys(TABS) as Tab[]).map(k => (
                <Button key={`tab-${k}`} label={k === tabOf(worn) ? `● ${TABS[k]}` : TABS[k]} variant={k === showing ? 'primary' : undefined}
                  dimColor={k !== showing} onPress={() => update($, tab, () => k)} />
              ))}
            </Box>
            {asking ? null : removeButton}
          </Box>
        )}
        {/* (right under the button that asked, so it is in sight however far the tiles scroll) */}
        {stage === 'missing' ? null : asking ? (
          <Box key="confirm" flexDirection="row" gap={1} alignItems="center" flexWrap="wrap">
            <Text color="warning">Remove the extension? Claude Desktop goes back to its own look after a restart.</Text>
            <Button key="remove-yes" label="Remove" onPress={() => remove($)} />
            <Button key="remove-no" label="Cancel" dimColor onPress={() => update($, confirmRemove, () => false)} />
          </Box>
        ) : stage === 'restart' ? (
          <Box key="footer" flexDirection="row" justifyContent="flex-end">{removeButton}</Box>
        ) : null}
        {look}
        {stage === 'ready' ? (
          <Box key="tiles" flexDirection="row" flexWrap="wrap" gap={1}>
            {shown.map(tileOf)}
            {showing === 'mine' ? (
              <Box key="make" flexDirection="column" justifyContent="center" alignItems="center" gap="xs">
                <Button key="make-own" label="+ Make your own" onPress={() => makeOwn($)} />
                <Text dimColor>from an idea or a picture</Text>
              </Box>
            ) : null}
          </Box>
        ) : null}
      </Box>
    )
  })

  on('turn.start', async ($, e, next) => {
    if (!e.agentId && (await active($).catch(() => undefined))) signal($, '', '', 'thinking')
    return next(e)
  })

  // (fires only when a permission prompt is about to show; the answer is left to the person)
  on('classic.PermissionRequest', async ($, e, next) => {
    if (await active($).catch(() => undefined)) signal($, '', e.tool_name, 'waiting')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const t = await active($).catch(() => undefined)
    if (!t) return next(e)
    signal($, 'tool', e.tool, 'thinking')
    const result = await next(e)
    if (result.isError) signal($, 'error', e.tool)
    return result
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const t = e.agentId ? undefined : await active($).catch(() => undefined)
    if (t) signal($, 'done', '', 'idle')
    return next(e)
  })
}
