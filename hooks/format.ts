import type { Context, Limit } from '../types'

export const WINDOW_MS: Record<string, number> = {
  five_hour: 5 * 60 * 60 * 1000,
  seven_day: 7 * 24 * 60 * 60 * 1000,
}

export const LABEL: Record<string, string> = { five_hour: '5h', seven_day: '7d' }

/** 15600 -> "15.6k", 954200 -> "954.2k", 1250000 -> "1.3M", 812 -> "812" */
export const formatTokens = (n: number): string => {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}

/** Time until reset: "2h 40m", "1d 7h", "12m", "now" */
export const formatCountdown = (ms: number): string => {
  if (ms <= 0) return 'now'
  const minutes = Math.floor(ms / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export type Bar = { filled: number; marker: number | null; width: number }

/**
 * The bar's filled cells (percent used) and where the pace marker sits: how
 * far through the window the clock is, so filled past the marker means the
 * window is being spent faster than it refills.
 */
export const barFor = (limit: Limit, now: number, width = 10): Bar => {
  const filled = Math.max(0, Math.min(width, Math.round((limit.percentUsed / 100) * width)))
  const windowMs = WINDOW_MS[limit.kind]
  const resetsAt = limit.resetsAt ? Date.parse(limit.resetsAt) : NaN
  if (!windowMs || Number.isNaN(resetsAt)) return { filled, marker: null, width }
  const elapsed = Math.max(0, Math.min(1, 1 - (resetsAt - now) / windowMs))
  return { filled, marker: Math.min(width - 1, Math.floor(elapsed * width)), width }
}

/** How full the context window is, 0..100: the engine's figure, else tokens / window; null when unknown. */
export const contextPercent = (context: Context | null): number | null => {
  if (!context) return null
  if (context.percent !== null) return context.percent
  if (context.tokens === null || context.window <= 0) return null
  return Math.min(100, (context.tokens / context.window) * 100)
}

/** A context window's size, whole: 200000 -> "200k", 1000000 -> "1M" */
export const formatWindow = (n: number): string =>
  n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1_000)}k`
