import type { Context, Limit, Snapshot, Tokens } from '../types'
import { LABEL, WINDOW_MS, contextPercent, formatCountdown, formatTokens, formatWindow } from './format'

/**
 * The desktop band: rounded SVG pills with icons, their colors switched
 * by `prefers-color-scheme` so it follows the app's light and dark themes.
 */

// The band stays one row, so width comes from spacing and bar length, never the font size.
const FONT = 13
const CHAR = 7.9 // SF Mono / Menlo advance at 13px
const PILL_H = 26
const PAD_X = 9
const GAP = 6
const GROUP_GAP = 12
const ICON = 16
const ICON_GAP = 6
const BAR_W = 36
const CLOCK = 12

type Tone = 'limit5h' | 'limit7d' | 'input' | 'output' | 'context' | 'cost'

const PALETTE = {
  light: {
    ink: '#1f1f1f', dim: '#6f6f6b', track: '#cfcfca', fill: '#8fb26b', hot: '#d9822b', marker: '#1f1f1f', divider: '#a9a9a4',
    limit5h: ['#d7e9df', '#3f8a6c'], limit7d: ['#e4e0f4', '#7a5cc7'], input: ['#f3dad3', '#c4553a'],
    output: ['#dbebd8', '#4e9a52'], context: ['#dee1f7', '#5865d6'], cost: ['#f0e7cd', '#b4861a'],
  },
  dark: {
    ink: '#ececea', dim: '#a3a39e', track: '#4a4a46', fill: '#8fb26b', hot: '#e8964a', marker: '#ececea', divider: '#62625d',
    limit5h: ['#1f3a2f', '#6fc4a1'], limit7d: ['#2e2a48', '#a991f0'], input: ['#45291f', '#f08a6e'],
    output: ['#233a27', '#7cc77f'], context: ['#272c4c', '#8b96f5'], cost: ['#3e3520', '#e0b54a'],
  },
} as const

const TONES: Tone[] = ['limit5h', 'limit7d', 'input', 'output', 'context', 'cost']

const css = (p: (typeof PALETTE)['light']) =>
  [
    `.ink{fill:${p.ink}}`,
    `.dim{fill:${p.dim}}`,
    `.track{fill:${p.track}}`,
    `.fill{fill:${p.fill}}`,
    `.hot{fill:${p.hot}}`,
    `.marker{fill:${p.marker}}`,
    `.divider{fill:${p.divider}}`,
    `.clock{stroke:${p.dim}}`,
    ...TONES.map(t => `.bg-${t}{fill:${p[t][0]}}.fg-${t}{stroke:${p[t][1]};color:${p[t][1]}}`),
  ].join('')

const STYLE =
  `text{font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:${FONT}px;dominant-baseline:central}` +
  `.icon{fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}` +
  css(PALETTE.light) +
  `@media (prefers-color-scheme:dark){${css(PALETTE.dark)}}`

/** 16×16 stroke icons, drawn in the pill's tone. */
const ICONS: Record<string, string> = {
  gauge: '<path d="M2.5 11.5a5.5 5.5 0 1 1 11 0"/><path d="M8 10.5l2.6-3.4"/><circle cx="8" cy="10.5" r=".8" fill="currentColor"/>',
  calendar:
    '<rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4"/>' +
    '<text x="8" y="10.6" text-anchor="middle" stroke="none" fill="currentColor" style="font-size:6.5px;font-weight:700;font-family:-apple-system,sans-serif">7</text>',
  clock: '<path d="M2.8 8a5.2 5.2 0 1 0 1.6-3.8"/><path d="M2.6 2.4v2.4H5"/><path d="M8 5.4V8l1.8 1.2"/>',
  upload: '<path d="M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10"/><path d="M8 10.5V2.5M5 5.5l3-3 3 3"/>',
  download: '<path d="M2.5 10v2.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V10"/><path d="M8 2.5v8M5 7.5l3 3 3-3"/>',
  layers: '<path d="M8 2l6 3-6 3-6-3z"/><path d="M2 8l6 3 6-3"/><path d="M2 11l6 3 6-3"/>',
  coin:
    '<circle cx="8" cy="8" r="6"/>' +
    '<text x="8" y="8.4" text-anchor="middle" stroke="none" fill="currentColor" style="font-size:8.5px;font-weight:700;font-family:-apple-system,sans-serif">$</text>',
}

const icon = (name: string, tone: string, x: number, y: number, size = ICON) =>
  `<g class="icon ${tone}" transform="translate(${x} ${y}) scale(${size / 16})">${ICONS[name]}</g>`

const textWidth = (s: string) => s.length * CHAR

type Piece = { width: number; draw: (x: number, y: number) => string }

const pill = (tone: Tone, width: number, inner: (x: number, cy: number) => string): Piece => ({
  width,
  draw: (x, y) =>
    `<rect class="bg-${tone}" x="${x}" y="${y}" width="${width}" height="${PILL_H}" rx="${PILL_H / 2}"/>` +
    inner(x + PAD_X, y + PILL_H / 2),
})

/** Icon-and-label runs side by side in one pill, e.g. ↑ in then ↓ out. */
const simplePill = (tone: Tone, runs: { iconName: string; label: string; tone?: Tone }[]): Piece => {
  const runWidth = (label: string) => ICON + ICON_GAP + textWidth(label)
  const inner = runs.reduce((w, r, i) => w + runWidth(r.label) + (i > 0 ? 10 : 0), 0)
  return pill(tone, PAD_X + inner + PAD_X, (x, cy) => {
    let cx = x
    return runs
      .map((r, i) => {
        if (i > 0) cx += 10
        const out =
          icon(r.iconName, `fg-${r.tone ?? tone}`, cx, cy - ICON / 2) +
          `<text class="ink" x="${cx + ICON + ICON_GAP}" y="${cy}">${r.label}</text>`
        cx += runWidth(r.label)
        return out
      })
      .join('')
  })
}

/** How far through its window the clock is, 0..1, or null when unknown. */
export const paceFor = (limit: Limit, now: number): number | null => {
  const windowMs = WINDOW_MS[limit.kind]
  const resetsAt = limit.resetsAt ? Date.parse(limit.resetsAt) : NaN
  if (!windowMs || Number.isNaN(resetsAt)) return null
  return Math.max(0, Math.min(1, 1 - (resetsAt - now) / windowMs))
}

type Meter = {
  tone: Tone
  iconName: string
  label: string
  percent: number
  /** Where the pace marker sits, 0..1; null draws none. */
  pace: number | null
  /** Dim text after the percent, with the clock icon before it when `clock`. */
  tail: string | null
  clock: boolean
}

const meterPill = (m: Meter): Piece => {
  const percent = `${Math.round(m.percent)}%`
  const used = Math.max(0, Math.min(1, m.percent / 100))
  const tailIcon = m.clock ? CLOCK + 4 : 0

  const width =
    PAD_X + ICON + ICON_GAP + (m.label ? textWidth(m.label) + 7 : 0) + BAR_W + 7 + textWidth(percent) +
    (m.tail ? 8 + tailIcon + textWidth(m.tail) : 0) + PAD_X

  return pill(m.tone, width, (x, cy) => {
    let cx = x
    let out = icon(m.iconName, `fg-${m.tone}`, cx, cy - ICON / 2)
    cx += ICON + ICON_GAP
    if (m.label) {
      out += `<text class="dim" x="${cx}" y="${cy}">${m.label}</text>`
      cx += textWidth(m.label) + 7
    }
    out += `<rect class="track" x="${cx}" y="${cy - 3}" width="${BAR_W}" height="6" rx="3"/>`
    if (used > 0) {
      out += `<rect class="${m.percent >= 80 ? 'hot' : 'fill'}" x="${cx}" y="${cy - 3}" width="${Math.max(6, used * BAR_W)}" height="6" rx="3"/>`
    }
    if (m.pace !== null) {
      out += `<rect class="marker" x="${cx + Math.min(BAR_W - 2, m.pace * BAR_W)}" y="${cy - 7}" width="2" height="14" rx="1"/>`
    }
    cx += BAR_W + 7
    out += `<text class="ink" x="${cx}" y="${cy}" font-weight="700">${percent}</text>`
    cx += textWidth(percent)
    if (m.tail) {
      cx += 8
      if (m.clock) {
        out += icon('clock', 'clock', cx, cy - CLOCK / 2, CLOCK)
        cx += tailIcon
      }
      out += `<text class="dim" x="${cx}" y="${cy}">${m.tail}</text>`
    }
    return out
  })
}

const limitPill = (l: Limit, now: number): Piece =>
  meterPill({
    tone: l.kind === 'five_hour' ? 'limit5h' : 'limit7d',
    iconName: l.kind === 'five_hour' ? 'gauge' : 'calendar',
    label: '',
    percent: l.percentUsed,
    pace: paceFor(l, now),
    tail: l.resetsAt ? formatCountdown(Date.parse(l.resetsAt) - now).replace(' ', '') : null,
    clock: true,
  })

const contextPill = (context: Context | null): Piece => {
  const percent = contextPercent(context)
  if (!context || percent === null) return simplePill('context', [{ iconName: 'layers', label: '—' }])
  return meterPill({
    tone: 'context',
    iconName: 'layers',
    label: '',
    percent,
    pace: null,
    tail: formatWindow(context.window),
    clock: false,
  })
}

export type PillSvg = { key: string; source: string; width: number; height: number; alt: string }

/**
 * The band as one image per pill at a fixed pixel size, so the desktop never
 * scales the text down. Each image carries its own spacing to the right (wider
 * at a group's end), transparent, so the app's background shows through.
 */
export const bandPills = (tokens: Tokens, snapshot: Snapshot, now: number): PillSvg[] => {
  const order = ['five_hour', 'seven_day']
  const limits = [...snapshot.limits].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
  const ctx = snapshot.context?.tokens
  const ctxPercent = contextPercent(snapshot.context)

  type Item = { key: string; piece: Piece; alt: string }
  const groups: Item[][] = [
    [
      ...limits.map(l => ({
        key: l.kind,
        piece: limitPill(l, now),
        alt: `${LABEL[l.kind] ?? l.kind} limit ${Math.round(l.percentUsed)}% used`,
      })),
      {
        key: 'context',
        piece: contextPill(snapshot.context),
        alt: `context ${ctx == null ? 'unknown' : formatTokens(ctx)}${ctxPercent === null ? '' : ` (${Math.round(ctxPercent)}% full)`}`,
      },
    ],
    [
      {
        key: 'tokens',
        piece: simplePill('input', [
          { iconName: 'upload', label: formatTokens(tokens.input) },
          { iconName: 'download', label: formatTokens(tokens.output), tone: 'output' },
        ]),
        alt: `${formatTokens(tokens.input)} in, ${formatTokens(tokens.output)} out`,
      },
    ],
    snapshot.usd === null
      ? []
      : [{ key: 'cost', piece: simplePill('cost', [{ iconName: 'coin', label: `$${snapshot.usd.toFixed(2)}` }]), alt: `cost $${snapshot.usd.toFixed(2)}` }],
  ].filter(g => g.length > 0)

  return groups.flatMap((group, gi) =>
    group.map((item, i) => {
      const end = i === group.length - 1
      const width = Math.ceil(item.piece.width) + (end ? (gi < groups.length - 1 ? GROUP_GAP : 0) : GAP)
      const height = PILL_H
      const source =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
        `<style>${STYLE}</style>` +
        item.piece.draw(0, 0) +
        `</svg>`
      return { key: item.key, source, width, height, alt: item.alt }
    }),
  )
}
