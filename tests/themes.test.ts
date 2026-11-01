import { expect, test } from 'claude-code/testing'

import { fileOf } from '../hooks/register'
import { THEMES, parseUserTheme, tile } from '../hooks/themes'

test('a person\'s own theme is read as a simple theme, and a bad one is refused', async () => {
  const good = parseUserTheme(JSON.stringify({ id: 'my-dusk', name: 'My Dusk', tagline: 't', bg: '#112233', text: '#eeeeee',
    accent: '#ff8800', vars: { 'cds-radius': '6px', 'Bad Key': 'x' }, wallpaper: 'moonlit' }), 'html{}')
  expect(good?.css).toBe('html{}')
  expect(good?.vars).toEqual({ 'cds-radius': '6px' })
  expect(good?.wallpaper).toBeUndefined()
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
})

test('the strip above the prompt shows only once opened, a button per theme, and closes', async ($, on) => {
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  const props = { hasSurvey: false, isWorking: false, maxRows: 40, columns: 100 }
  const shut = await $.ui.mount({ plugin: 'desktop-themes', surface: 'desktop', component: 'AbovePrompt', props })
  expect(await shut.find({ key: 'close' })).toBeUndefined()
  await shut.unmount()
  await $.command.run({ command: 'themes' })
  const ui = await $.ui.mount({ plugin: 'desktop-themes', surface: 'desktop', component: 'AbovePrompt', props })
  for (const t of THEMES) expect(await ui.find({ key: `use-${t.id}` })).toBeDefined()
  await ui.press({ key: 'close' })
  await ui.unmount()
  const after = await $.ui.mount({ plugin: 'desktop-themes', surface: 'desktop', component: 'AbovePrompt', props })
  expect(await after.find({ key: 'close' })).toBeUndefined()
  await after.unmount()
})

