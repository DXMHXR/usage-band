// Renders the desktop band with sample figures to docs/band-light.svg and docs/band-dark.svg.
// Run: bun scripts/screenshot.ts
import { bandPills } from '../hooks/svg'

const now = Date.parse('2026-10-07T12:00:00Z')
const pills = bandPills(
  { input: 84_300, output: 21_700 },
  {
    limits: [
      { kind: 'five_hour', percentUsed: 38, resetsAt: '2026-10-07T13:55:00Z' },
      { kind: 'seven_day', percentUsed: 71, resetsAt: '2026-10-09T04:00:00Z' },
    ],
    usd: 3.42,
    context: { tokens: 139_800, window: 1_000_000, percent: 14 },
  },
  now,
)

const PAD = 14
const width = pills.reduce((w, p) => w + p.width, 0) + PAD * 2
const height = Math.max(...pills.map(p => p.height)) + PAD * 2

const render = (theme: 'light' | 'dark') => {
  let x = PAD
  const body = pills
    .map(p => {
      // Pin the theme: dark keeps only the media query's rules, light drops them.
      const source = p.source.replace(/@media \(prefers-color-scheme:dark\)\{(.*)\}<\/style>/, (_, dark) =>
        theme === 'dark' ? `${dark}</style>` : '</style>',
      )
      const out = source.replace('<svg ', `<svg x="${x}" y="${PAD}" `)
      x += p.width
      return out
    })
    .join('')
  const bg = theme === 'dark' ? '#262624' : '#faf9f5'
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" rx="10" fill="${bg}"/>${body}</svg>\n`
  )
}

await Bun.write(new URL('../docs/band-light.svg', import.meta.url), render('light'))
await Bun.write(new URL('../docs/band-dark.svg', import.meta.url), render('dark'))
console.log(`docs/band-{light,dark}.svg ${width}x${height}`)
