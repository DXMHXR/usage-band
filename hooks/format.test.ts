import { describe, expect, test } from 'claude-code/testing'
import { barFor, contextPercent, formatCountdown, formatTokens, formatWindow } from './format'

describe('format', () => {
  test('tokens', async () => {
    expect(formatTokens(15600)).toBe('15.6k')
    expect(formatTokens(954200)).toBe('954.2k')
    expect(formatTokens(812)).toBe('812')
    expect(formatWindow(200_000)).toBe('200k')
    expect(formatWindow(1_000_000)).toBe('1M')
  })
  test('countdown', async () => {
    expect(formatCountdown((2 * 60 + 40) * 60_000)).toBe('2h 40m')
    expect(formatCountdown((31 * 60) * 60_000)).toBe('1d 7h')
  })
  test('bar with pace marker', async () => {
    const now = Date.parse('2026-10-03T12:00:00Z')
    // 5h window resetting in 2h40m -> 2h20m elapsed (~47%), marker at cell 4
    const bar = barFor({ kind: 'five_hour', percentUsed: 20, resetsAt: '2026-10-03T14:40:00Z' }, now)
    expect(bar.filled).toBe(2)
    expect(bar.marker).toBe(4)
  })
})

test('context percent: engine figure, else tokens over window', () => {
  expect(contextPercent(null)).toBeNull()
  expect(contextPercent({ tokens: 954200, window: 1_000_000, percent: 95 })).toBe(95)
  expect(contextPercent({ tokens: 50_000, window: 200_000, percent: null })).toBe(25)
  expect(contextPercent({ tokens: null, window: 200_000, percent: null })).toBeNull()
})
