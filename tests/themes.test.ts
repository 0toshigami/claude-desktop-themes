import { expect, test } from 'claude-code/testing'

import { fileOf, withoutOurs } from '../hooks/register'
import { THEMES, parseUserTheme, tile } from '../hooks/themes'
import { sceneModule } from '../tools/assemble.mjs'

test('a person\'s own theme is read as a simple theme, and a bad one is refused', async () => {
  const good = parseUserTheme(JSON.stringify({ id: 'my-dusk', name: 'My Dusk', tagline: 't', bg: '#112233', text: '#eeeeee',
    accent: '#ff8800', vars: { 'cds-radius': '6px', 'Bad Key': 'x' }, wallpaper: 'moonlit' }), 'html{}')
  expect(good?.css).toBe('html{}')
  expect(good?.vars).toEqual({ 'cds-radius': '6px' })
  expect(good?.wallpaper).toBeUndefined()
  const own = { id: 'snowy', name: 'Snowy', bg: '#000000', text: '#ffffff', accent: '#ff0000', wallpaper: 'snowy' }
  expect(parseUserTheme(JSON.stringify(own), undefined, true)?.wallpaper).toBe('snowy')
  expect(parseUserTheme(JSON.stringify(own))?.wallpaper).toBeUndefined()
  expect(parseUserTheme(JSON.stringify({ ...own, wallpaper: 'moonlit' }), undefined, true)?.wallpaper).toBeUndefined()
  expect(parseUserTheme('{"id":"x y","name":"n","bg":"#000000","text":"#ffffff","accent":"#ff0000"}')).toBeUndefined()
  expect(parseUserTheme('{"id":"ok-id","name":"n","bg":"red","text":"#ffffff","accent":"#ff0000"}')).toBeUndefined()
  expect(parseUserTheme('not json')).toBeUndefined()
})

test('every theme has a tile the desktop takes, and Claude writes no colors', async () => {
  for (const t of THEMES) expect(tile(t, true).length < 131072).toBe(true)
  expect(fileOf(THEMES[0]!)).toBe('{}')
  const sunset = JSON.parse(fileOf(THEMES[1]!, 'html{}'))
  expect(sunset.accent).toBe('#ff8a6b')
  expect(sunset.css).toBe('html{}')
  expect(sunset.vars['cds-radius']).toBe('10px')
  const look = JSON.parse(fileOf(THEMES[1]!, '', { motion: 'grid', speed: 2, cell: 14, veil: .6 }))
  expect(look.motion).toBe('grid')
  expect(look.speed).toBe(2)
  expect(look.cell).toBe(14)
  expect(look.veil).toBe(.6)
  expect(JSON.parse(fileOf(THEMES[1]!, '', undefined, 'scenes/snowy.js?v=1')).scene).toBe('scenes/snowy.js?v=1')
  expect(sceneModule("SCENES['snowy'] = {}")).toMatch(/^const \{ [^}]*\bsketch\b[^}]*\} = globalThis\.themesForClaude;\nSCENES/)
})

test('removing takes out only our entries from a shared slot, and the whole slot when it was ours', async () => {
  const war = [{ resources: ['theme.json', 'event.json'], matches: ['<all_urls>'] }]
  const shared = withoutOurs({ content_scripts: [{ js: ['splash.js'] }, { js: ['theme.js'] }], web_accessible_resources: war })
  expect(shared?.content_scripts).toEqual([{ js: ['splash.js'] }])
  expect(shared?.web_accessible_resources).toEqual([])
  expect(withoutOurs({ content_scripts: [{ js: ['theme.js'] }], web_accessible_resources: war })).toBeUndefined()
})

test('the strip above the prompt shows only once opened, a button per theme, and closes', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  // the extension is copied and Claude Desktop restarted once `restarted` is true
  let restarted = false
  on('env.get', ($, e) =>
    ({ value: e.name === 'APPDATA' ? 'C:\\AppData' : e.name === 'REACT_PROFILE' && restarted ? '1' : undefined }))
  on('fs.read', ($, e) => {
    if (restarted && e.path.endsWith('manifest.json')) return { value: '{"content_scripts":[{"js":["theme.js"]}]}' }
    throw new Error('ENOENT')
  })
  const props = { hasSurvey: false, isWorking: false, maxRows: 40, columns: 100 }
  const shut = await $.ui.mount({ plugin: 'themes-for-claude', surface: 'desktop', component: 'AbovePrompt', props })
  expect(await shut.find({ key: 'close' })).toBeUndefined()
  await shut.unmount()
  await $.command.run({ command: 'themes' })
  const bare = await $.ui.mount({ plugin: 'themes-for-claude', surface: 'desktop', component: 'AbovePrompt', props })
  expect(await bare.find({ key: 'install' })).toBeDefined()
  for (const t of THEMES) expect(await bare.find({ key: `use-${t.id}` })).toBeUndefined()
  await bare.unmount()
  restarted = true
  await $.command.run({ command: 'themes' })
  await $.command.run({ command: 'themes' })
  const ui = await $.ui.mount({ plugin: 'themes-for-claude', surface: 'desktop', component: 'AbovePrompt', props })
  expect(await ui.find({ key: 'install' })).toBeUndefined()
  expect(await ui.find({ key: 'remove' })).toBeDefined()
  // one kind at a time, opened on the worn theme's (Claude: a color theme)
  for (const t of THEMES) expect(!!(await ui.find({ key: `use-${t.id}` }))).toBe(!t.wallpaper)
  expect(await ui.find({ key: 'speed' })).toBeUndefined()
  await ui.press({ key: 'tab-live' })
  for (const t of THEMES) expect(!!(await ui.find({ key: `use-${t.id}` }))).toBe(!!t.wallpaper)
  expect(await ui.find({ key: 'speed' })).toBeDefined()
  await ui.press({ key: 'tab-mine' })
  expect(await ui.find({ key: 'make-own' })).toBeDefined()
  // Remove extension asks first, and Cancel takes it back
  await ui.press({ key: 'remove' })
  expect(await ui.find({ key: 'remove-yes' })).toBeDefined()
  await ui.press({ key: 'remove-no' })
  expect(await ui.find({ key: 'remove-yes' })).toBeUndefined()
  await ui.press({ key: 'close' })
  await ui.unmount()
  const after = await $.ui.mount({ plugin: 'themes-for-claude', surface: 'desktop', component: 'AbovePrompt', props })
  expect(await after.find({ key: 'close' })).toBeUndefined()
  await after.unmount()
})

test('on Windows the strip installs into the Claude-Data folder in use, else into %APPDATA%\\Claude', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  const id = 'extensions\\fmkadmapgofadopljbjfkapdkoienihi'
  const data = 'C:\\Local\\Claude-Data'
  let inUse = true // whether Claude-Data\claude_x holds Local State
  const disk = new Map<string, string>()
  on('env.get', ($, e) => ({ value: ({ APPDATA: 'C:\\Roaming', LOCALAPPDATA: 'C:\\Local' } as Record<string, string>)[e.name] }))
  on('fs.exists', ($, e) => ({ value: e.path === data || (inUse && e.path === `${data}\\claude_x\\Local State`) || disk.has(e.path) }))
  on('fs.list', ($, e) => ({ value: e.path === data ? [{ kind: 'directory', name: 'claude_x', size: 0, mtimeMs: 0 }] : [] }))
  on('fs.write', ($, e) => { disk.set(e.path, e.text); return { value: undefined } })
  on('fs.read', ($, e) => {
    if (disk.has(e.path)) return { value: disk.get(e.path)! }
    const path = e.path.replaceAll('\\', '/') // (the mod's own files come as the engine spells them)
    if (path.endsWith('/extension/manifest.json'))
      return { value: '{"content_scripts":[{"js":["theme.js"]}],"web_accessible_resources":[{"resources":["theme.json"]}]}' }
    if (path.includes('/extension/src/')) return { value: '' }
    throw new Error('ENOENT')
  })
  on('process.run', () => ({ value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  const props = { hasSurvey: false, isWorking: false, maxRows: 40, columns: 100 }
  const install = async () => {
    const ui = await $.ui.mount({ plugin: 'themes-for-claude', surface: 'desktop', component: 'AbovePrompt', props })
    await ui.press({ key: 'install' })
    await ui.unmount()
  }

  await $.command.run({ command: 'themes' })
  await install()
  expect(disk.has(`${data}\\claude_x\\${id}\\theme.js`)).toBe(true)
  inUse = false
  // (closed and opened again: the check sees no extension in the other folder, so Install is back)
  await $.command.run({ command: 'themes' })
  await $.command.run({ command: 'themes' })
  await install()
  expect(disk.has(`C:\\Roaming\\Claude\\${id}\\theme.js`)).toBe(true)
})

test('on Windows removing clears REACT_PROFILE with setx and reg delete, and says so when setx fails', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  const slot = 'C:\\Roaming\\Claude\\extensions\\fmkadmapgofadopljbjfkapdkoienihi'
  const disk = new Map<string, string>()
  const runs: string[][] = []
  const toasts: string[] = []
  let setxCode = 0
  on('env.get', ($, e) => ({ value: e.name === 'APPDATA' ? 'C:\\Roaming' : undefined }))
  on('fs.exists', ($, e) => ({ value: disk.has(e.path) }))
  on('fs.list', () => ({ value: [] }))
  on('fs.write', ($, e) => { disk.set(e.path, e.text); return { value: undefined } })
  on('fs.read', ($, e) => {
    if (disk.has(e.path)) return { value: disk.get(e.path)! }
    const path = e.path.replaceAll('\\', '/')
    if (path.endsWith('/extension/manifest.json'))
      return { value: '{"content_scripts":[{"js":["theme.js"]}],"web_accessible_resources":[{"resources":["theme.json"]}]}' }
    if (path.includes('/extension/src/')) return { value: '' }
    throw new Error('ENOENT')
  })
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    const exitCode = e.argv[0] === 'setx' && e.argv[2] === '' ? setxCode : 0
    return { value: { exitCode, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.toast', ($, e) => { toasts.push(e.text); return { value: undefined } })
  const props = { hasSurvey: false, isWorking: false, maxRows: 40, columns: 100 }
  const installThenRemove = async () => {
    await $.command.run({ command: 'themes' })
    const bare = await $.ui.mount({ plugin: 'themes-for-claude', surface: 'desktop', component: 'AbovePrompt', props })
    await bare.press({ key: 'install' })
    await bare.unmount()
    const ui = await $.ui.mount({ plugin: 'themes-for-claude', surface: 'desktop', component: 'AbovePrompt', props })
    await ui.press({ key: 'remove' })
    await ui.press({ key: 'remove-yes' })
    await ui.unmount()
    const said = toasts.at(-1)
    await $.command.run({ command: 'themes' })
    disk.clear()
    return said
  }

  expect(await installThenRemove()).toMatch(/^Extension removed\. Restart/)
  expect(runs).toContainEqual(['setx', 'REACT_PROFILE', '1'])
  expect(runs).toContainEqual(['setx', 'REACT_PROFILE', ''])
  expect(runs).toContainEqual(['reg', 'delete', 'HKCU\\Environment', '/v', 'REACT_PROFILE', '/f'])
  expect(runs).toContainEqual(['cmd', '/c', 'rmdir', '/s', '/q', slot])
  setxCode = 1
  expect(await installThenRemove()).toMatch(/REACT_PROFILE is still set/)
})

test('a permission prompt marks the theme as waiting', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  const event = 'C:\\Roaming\\Claude\\extensions\\fmkadmapgofadopljbjfkapdkoienihi\\event.json'
  const events: { kind: string; state: string; tool: string }[] = []
  on('env.get', ($, e) => ({ value: e.name === 'APPDATA' ? 'C:\\Roaming' : e.name === 'REACT_PROFILE' ? '1' : undefined }))
  on('fs.exists', () => ({ value: false }))
  on('fs.write', ($, e) => { if (e.path === event) events.push(JSON.parse(e.text)); return { value: undefined } })
  on('fs.read', ($, e) => {
    if (e.path.endsWith('manifest.json')) return { value: '{"content_scripts":[{"js":["theme.js"]}]}' }
    throw new Error('ENOENT')
  })
  on('tool.check', { tool: 'Bash' }, () => ({ decision: 'ask' }))
  on('classic.PermissionRequest', () => ({ decision: { behavior: 'deny', message: 'test' } }))
  on('ui.toast', () => ({ value: undefined }))
  // (a theme worn first: with none, nothing is signalled)
  await $.command.run({ command: 'themes' })
  const ui = await $.ui.mount({ plugin: 'themes-for-claude', surface: 'desktop', component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: false, maxRows: 40, columns: 100 } })
  await ui.press({ key: 'tab-live' })
  await ui.press({ key: 'use-moonlit' })
  await ui.unmount()
  await $.tool.call({ tool: 'Bash', command: 'ls' }).catch(() => undefined)
  // (signal writes on its own, after the call has settled)
  for (let i = 0; i < 100 && !events.some(e => e.kind === '' && e.state === 'waiting'); i++) await new Promise(r => setTimeout(r, 1))
  expect(events).toContainEqual(expect.objectContaining({ kind: '', state: 'waiting', tool: 'Bash' }))
})

test('on macOS the strip installs into Application Support and sets REACT_PROFILE with launchctl, and removes both', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  const home = '/Users/p', support = `${home}/Library/Application Support`
  const slot = `${support}/Claude/extensions/fmkadmapgofadopljbjfkapdkoienihi`
  const agent = `${home}/Library/LaunchAgents/com.github.0toshigami.themes-for-claude.plist`
  // a small disk: what the mod writes, and its own extension's files as a stand-in
  const disk = new Map<string, string>()
  const runs: string[][] = []
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? home : undefined }))
  // (run on Windows, the engine hands these hooks /Users/p as E:\Users\p)
  const posix = (p: string) => p.replace(/^[A-Za-z]:/, '').replaceAll('\\', '/')
  on('fs.exists', ($, e) => ({ value: posix(e.path) === `${support}/Claude` || disk.has(posix(e.path)) }))
  on('fs.list', () => ({ value: [] }))
  on('fs.write', ($, e) => { disk.set(posix(e.path), e.text); return { value: undefined } })
  on('fs.read', ($, e) => {
    const path = posix(e.path)
    if (disk.has(path)) return { value: disk.get(path)! }
    if (path.endsWith('/extension/manifest.json'))
      return { value: '{"content_scripts":[{"matches":["<all_urls>"],"js":["theme.js"]}],"web_accessible_resources":[{"resources":["theme.json"]}]}' }
    if (path.includes('/extension/src/')) return { value: '' }
    throw new Error('ENOENT')
  })
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  const props = { hasSurvey: false, isWorking: false, maxRows: 40, columns: 100 }

  await $.command.run({ command: 'themes' })
  const bare = await $.ui.mount({ plugin: 'themes-for-claude', surface: 'desktop', component: 'AbovePrompt', props })
  await bare.press({ key: 'install' })
  await bare.unmount()
  expect(disk.has(`${slot}/theme.js`)).toBe(true)
  expect(disk.get(`${slot}/manifest.json`)).toMatch(/"theme\.js"/)
  expect(disk.get(agent)).toMatch(/<string>REACT_PROFILE<\/string><string>1<\/string>/)
  expect(runs).toContainEqual(['launchctl', 'setenv', 'REACT_PROFILE', '1'])

  const ui = await $.ui.mount({ plugin: 'themes-for-claude', surface: 'desktop', component: 'AbovePrompt', props })
  expect((await ui.find({ type: 'Text', text: /Cmd\+Q/ }))?.text).toMatch(/Quit Claude Desktop fully \(Cmd\+Q\)/)
  await ui.press({ key: 'remove' })
  await ui.press({ key: 'remove-yes' })
  await ui.unmount()
  expect(runs).toContainEqual(['launchctl', 'unsetenv', 'REACT_PROFILE'])
  expect(runs).toContainEqual(['rm', '-f', agent])
  expect(runs).toContainEqual(['rm', '-rf', slot])
})
