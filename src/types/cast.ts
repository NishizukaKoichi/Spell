export interface Cast {
  castId: string
  spellId: string
  spellName: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  timestamp: string
  cost: number // in cents
  duration?: number // in milliseconds
}

export interface Budget {
  cap: number // in dollars
  used: number // in dollars
}
