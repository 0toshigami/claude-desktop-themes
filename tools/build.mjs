// theme.js from extension/src (see assemble.mjs), for the draft and thumbnail pages. Run on its own, it writes it over
// the installed extension's, to try a changed scene in Claude Desktop: node tools/build.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assemble } from './assemble.mjs'

const src = new URL('../extension/src/', import.meta.url), read = f => readFileSync(f, 'utf8')

// extra: more scene files to build in, outside the mod (make-theme's draft of a new scene)
export const build = (extra = []) => assemble(read(new URL('core.js', src)),
  [...readdirSync(new URL('scenes/', src)).filter(f => f.endsWith('.js')).sort().map(f => read(new URL(`scenes/${f}`, src))), ...extra.map(read)],
  read(new URL('engine.js', src)))

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Claude Desktop's userData, as the mod's install finds it (Windows and macOS)
  const userData = process.platform === 'win32' ? process.env.APPDATA
    : process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support') : undefined
  if (!userData) throw new Error('only Windows and macOS are supported')
  const slot = join(userData, 'Claude', 'extensions', 'fmkadmapgofadopljbjfkapdkoienihi')
  if (!existsSync(join(slot, 'theme.js'))) throw new Error('not installed: press "Install extension" in /themes first')
  writeFileSync(join(slot, 'theme.js'), build())
  console.log(`built into ${join(slot, 'theme.js')}; restart Claude Desktop to see it`)
}
