export type Tokens = { input: number; output: number }
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Context = { tokens: number | null; window: number; percent: number | null }
export type Snapshot = { limits: Limit[]; usd: number | null; context: Context | null }

declare module 'claude-code' {
  interface PluginState {
    'usage-band': { tokens: Tokens; snapshot: Snapshot; now: number }
  }
}
