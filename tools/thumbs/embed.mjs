import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
const here = new URL('.', import.meta.url)
const ids = readdirSync(here).filter(f => f.endsWith('.jpg')).map(f => f.slice(0, -4)).sort()
const rows = ids.map(id => `  '${id}': 'data:image/jpeg;base64,${readFileSync(new URL(`${id}.jpg`, here)).toString('base64')}',`)
writeFileSync(new URL('../../hooks/thumbs.ts', import.meta.url),
  `export const THUMBS: Record<string, string> = {
${rows.join('\n')}
}
`)
console.log('embedded', ids.join(' '))
