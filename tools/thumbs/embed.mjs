// Writes hooks/thumbs.ts: each live wallpaper's capture (<id>.jpg here) as a data URL, for the strip's tiles
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
const here = new URL('.', import.meta.url)
const ids = readdirSync(here).filter(f => f.endsWith('.jpg')).map(f => f.slice(0, -4)).sort()
const rows = ids.map(id => `  '${id}': 'data:image/jpeg;base64,${readFileSync(new URL(`${id}.jpg`, here)).toString('base64')}',`)
writeFileSync(new URL('../../hooks/thumbs.ts', import.meta.url),
  `// Each live wallpaper as it looks, for the theme strip's tiles: the real scene captured in a browser at 1200x700 and
// shrunk to 360x210. Made by tools/thumbs (pages.ts, capture.ps1, embed.mjs); run them again after a scene changes.
export const THUMBS: Record<string, string> = {
${rows.join('\n')}
}
`)
console.log('embedded', ids.join(' '))
