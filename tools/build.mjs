// theme.js from extension/src (see assemble.mjs), for the draft and thumbnail pages. Run on its own, it writes it over
// the installed extension's, to try a changed scene in Claude Desktop: node tools/build.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { assemble } from './assemble.mjs'

const src = new URL('../extension/src/', import.meta.url), read = f => readFileSync(f, 'utf8')

// extra: more scene files to build in, outside the mod (make-theme's draft of a new scene, the person's own scenes)
export const build = (extra = []) => assemble(read(new URL('core.js', src)),
  [...readdirSync(new URL('scenes/', src)).filter(f => f.endsWith('.js')).sort().map(f => read(new URL(`scenes/${f}`, src))), ...extra.map(read)],
  read(new URL('engine.js', src)))

// the person's own scenes, as the mod takes them: <id>.js beside an <id>.json whose wallpaper is its own id
const own = dir => (existsSync(dir) ? readdirSync(dir) : []).filter(f => f.endsWith('.js')).sort().filter(f => {
  try { return JSON.parse(read(`${dir}\\${f.slice(0, -3)}.json`)).wallpaper === f.slice(0, -3) } catch { return false }
}).map(f => `${dir}\\${f}`)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // ponytail: Windows only, as the mod's install is
  const slot = `${process.env.APPDATA}\\Claude\\extensions\\fmkadmapgofadopljbjfkapdkoienihi`
  if (!existsSync(`${slot}\\theme.js`)) throw new Error('not installed: press "Install extension" in /themes first')
  writeFileSync(`${slot}\\theme.js`, build(own(`${process.env.USERPROFILE}\\.claude\\themes-for-claude`)))
  console.log(`built into ${slot}\\theme.js; restart Claude Desktop to see it`)
}
