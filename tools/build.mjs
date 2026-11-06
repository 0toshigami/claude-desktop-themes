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

const movedTo = () => {
  const classic = join(process.env.APPDATA ?? '', 'Claude')
  if (!process.env.APPDATA || !process.env.LOCALAPPDATA || !existsSync(classic)) return undefined
  const name = readdirSync(classic).find(n => n.startsWith('.user-data-left.'))?.slice('.user-data-left.'.length)
  const moved = name && /^[\w.-]+$/.test(name) ? join(process.env.LOCALAPPDATA, 'Claude-Data', name) : undefined
  return moved && existsSync(moved) ? moved : undefined
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Claude Desktop's data folder, as the mod's install finds it (Windows and macOS); on Windows the app may have
  // moved it to %LOCALAPPDATA%\Claude-Data\<name>, leaving .user-data-left.<name> in %APPDATA%\Claude
  const claude = process.platform === 'win32' ? movedTo() ?? join(process.env.APPDATA ?? '', 'Claude')
    : process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support', 'Claude') : undefined
  if (!claude) throw new Error('only Windows and macOS are supported')
  const slot = join(claude, 'extensions', 'fmkadmapgofadopljbjfkapdkoienihi')
  if (!existsSync(join(slot, 'theme.js'))) throw new Error('not installed: press "Install extension" in /themes first')
  writeFileSync(join(slot, 'theme.js'), build())
  console.log(`built into ${join(slot, 'theme.js')}; restart Claude Desktop to see it`)
}
