# usage-band

A Claude Code mod that draws a one-row usage band above the prompt in Claude Code Desktop:

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/band-dark.svg">
  <img alt="usage-band: 5h limit 38% resetting in 1h55m, 7d limit 71% resetting in 1d16h, context 14% of 1M, 84.3k tokens in and 21.7k out, cost $3.42" src="docs/band-light.svg">
</picture>

- **5h / 7d rate limits**: a bar with the percent used and the time until reset. The thin vertical marker shows how far through the window the clock is; a fill past the marker means you are spending faster than the window refills.
- **Context window**: the percentage of the window in use and its size (`1M`, `200k`).
- **Session tokens**: input ↑ and output ↓.
- **Cost**: the session total, when Claude Code reports it.

The band stays on one row at full text size. On a narrow window the rightmost pills are clipped instead of wrapping or shrinking. It follows the app's light and dark themes. On the terminal it is off by default (`SHOW_ON_TERMINAL` in `hooks/register.tsx`).

## Install

In Claude Code:

```
/plugin marketplace add DXMHXR/usage-band
/plugin install usage-band@usage-band
```

## Develop

```bash
claude plugin validate .
claude plugin test .
bun scripts/screenshot.ts   # re-render docs/band-*.svg after changing hooks/svg.ts
```
