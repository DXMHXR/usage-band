import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { SessionContextUsage } from 'claude-code'
import type { Limit, Snapshot, Tokens } from '../types'
import { LABEL, barFor, contextPercent, formatCountdown, formatTokens, formatWindow } from './format'
import { bandPills } from './svg'

const tokens = atom({ plugin: 'usage-band', key: 'tokens' } as const, { input: 0, output: 0 })
const snapshot = atom({ plugin: 'usage-band', key: 'snapshot' } as const, { limits: [], usd: null, context: null })
const now = atom({ plugin: 'usage-band', key: 'now' } as const, 0)

// The band draws on the desktop (and the other app surfaces) only; true brings back the terminal band.
const SHOW_ON_TERMINAL = false

// Terminal colors are theme keys, so the band follows /theme (light, dark, ansi).
const C = {
  bar: 'userMessageBackground',
  ink: 'text',
  dim: 'inactive',
  divider: 'subtle',
  track: 'rate_limit_empty',
  fill: 'rate_limit_fill',
  hot: 'warning',
  marker: 'text',
  limit5h: 'success',
  limit7d: 'permission',
  input: 'claude',
  output: 'success',
  context: 'suggestion',
  cost: 'warning',
}

const toSnapshot = (
  limits: readonly Limit[],
  usd: number | undefined,
  context: SessionContextUsage,
): Snapshot => ({
  limits: limits
    .filter(l => l.kind in LABEL)
    .map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })),
  usd: usd ?? null,
  context: { tokens: context.tokens ?? null, window: context.window, percent: context.percent ?? null },
})

const refresh = async ($: EngineInterface) => {
  const u = await $.session.usage()
  await update($, snapshot, () => toSnapshot(u.rateLimits, u.cost?.usd, u.context))
  await update($, now, () => Date.now())
}

export const register: Register = on => {
  let ticker: { cancel: () => void } | null = null

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    ticker?.cancel()
    // Countdowns and the pace marker move with the clock, not only with turns.
    ticker = $.clock.every(30_000, () => void update($, now, () => Date.now()))
    return result
  })

  on('session.measure', async ($, e, next) => {
    await update($, snapshot, () => toSnapshot(e.rateLimits, e.cost?.usd, e.context))
    await update($, now, () => Date.now())
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const usage = e.usage
    if (usage) {
      await update($, tokens, (t: Tokens) => ({
        input: t.input + usage.input_tokens,
        output: t.output + usage.output_tokens,
      }))
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    if (e.surface === 'terminal' && !SHOW_ON_TERMINAL) return next(e)

    const t = await read($, tokens)
    const s = await read($, snapshot)
    const at = (await read($, now)) || Date.now()

    if (e.surface !== 'terminal') {
      const { Box, Svg } = $.ui.resolve(e)
      return (
        // One row at full text size: a narrow window clips the rightmost pills instead of wrapping or scaling.
        <Box flexWrap="nowrap" overflow="hidden">
          {bandPills(t, s, at).map(p => (
            <Box key={p.key} flexShrink={0}>
              <Svg source={p.source} alt={p.alt} width={p.width} height={p.height} />
            </Box>
          ))}
        </Box>
      )
    }

    const { Box, Text } = $.ui.resolve(e)

    const pill = (key: string, glyph: string, tone: string, children: RenderChildren) => (
      <Box key={key} marginRight={2}>
        <Text color={tone}>{glyph} </Text>
        {children}
      </Box>
    )

    const divider = (key: string) => (
      <Box key={key} marginRight={2}>
        <Text color={C.divider}>│</Text>
      </Box>
    )

    const meter = (key: string, glyph: string, tone: string, label: string, percent: number, marker: number | null, tail: string | null) => {
      const width = 10
      const filled = Math.max(0, Math.min(width, Math.round((percent / 100) * width)))
      const cells = Array.from({ length: width }, (_, i) => {
        if (i === marker) return <Text color={C.marker}>┃</Text>
        return <Text color={i < filled ? (percent >= 80 ? C.hot : C.fill) : C.track}>━</Text>
      })
      return pill(
        key,
        glyph,
        tone,
        <Box>
          <Text color={C.dim}>{label} </Text>
          {cells}
          <Text color={C.ink} bold> {Math.round(percent)}%</Text>
          {tail ? <Text color={C.dim}> {tail}</Text> : null}
        </Box>,
      )
    }

    const limitPill = (l: Limit) => {
      const reset = l.resetsAt ? formatCountdown(Date.parse(l.resetsAt) - at) : null
      const five = l.kind === 'five_hour'
      return meter(l.kind, five ? '◔' : '▦', five ? C.limit5h : C.limit7d, LABEL[l.kind], l.percentUsed, barFor(l, at).marker, reset ? `↻ ${reset}` : null)
    }

    const order = ['five_hour', 'seven_day']
    const limits = [...s.limits].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    const ctxPercent = contextPercent(s.context)

    return (
      <Box backgroundColor={C.bar} paddingX={1} flexWrap="wrap">
        {limits.map(limitPill)}
        {s.context && ctxPercent !== null
          ? meter('context', '≋', C.context, 'ctx', ctxPercent, null, `${formatTokens(s.context.tokens ?? 0)}/${formatWindow(s.context.window)}`)
          : pill('context', '≋', C.context, <Text color={C.dim}>—</Text>)}
        {divider('meters-end')}
        {pill('in', '↑', C.input, <Text color={C.ink}>{formatTokens(t.input)}</Text>)}
        {pill('out', '↓', C.output, <Text color={C.ink}>{formatTokens(t.output)}</Text>)}
        {s.usd !== null ? divider('tokens-end') : null}
        {s.usd !== null ? pill('cost', '$', C.cost, <Text color={C.ink}>{s.usd.toFixed(2)}</Text>) : null}
      </Box>
    )
  })
}
