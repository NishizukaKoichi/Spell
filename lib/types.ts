export interface Tenant {
  id: number
  slug: string
  created_at: string
}

export interface User {
  id: number
  tenant_id: number
  gh_user_id: number
  role: "maker" | "caster" | "operator" | "auditor"
  created_at: string
}

export interface Spell {
  id: number
  tenant_id: number
  spell_key: string
  name: string
  summary: string
  description?: string
  visibility: "public" | "unlisted" | "private"
  execution_mode: "workflow" | "service" | "clone"
  pricing_json: {
    model: "flat" | "metered" | "one_time"
    currency: string
    amount_cents: number
  }
  input_schema_json: Record<string, any>
  repo_ref?: string
  workflow_id?: string
  template_repo?: string
  status: "draft" | "published" | "archived"
  published_at?: string
  created_at: string
  author?: {
    name: string
    avatar: string
  }
  tags?: string[]
  rating?: number
  executions?: number
  isActive?: boolean
  price?: number
  currency?: string
  featured?: boolean
  lastUpdated?: string
  stats?: {
    executions: number
    success_rate: number
    avg_runtime_ms: number
  }
}

export interface Cast {
  id: number
  tenant_id: number
  spell_id: number
  caster_user_id: number
  run_id: string
  idempotency_key: string
  mode: "workflow" | "service" | "clone"
  status: "queued" | "running" | "succeeded" | "failed" | "canceled"
  estimate_cents: number
  cost_cents: number
  region: string
  input_hash: string
  started_at?: string
  finished_at?: string
  p95_ms: number
  error_rate: number
  artifact_url?: string
  artifact_sha256?: string
  sse_channel?: string
  created_at: string
}

export interface BillingLedger {
  id: number
  tenant_id: number
  cast_id?: number
  kind: "estimate" | "charge" | "refund" | "credit"
  amount_cents: number
  currency: string
  occurred_at: string
  meta_json: Record<string, any>
}

export interface Wizard {
  id: number
  name: string
  avatar: string
  bio: string
  github_username: string
  published_spells: number
  total_executions: number
  success_rate: number
  joined_at: string
}
