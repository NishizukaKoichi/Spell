interface KVNamespaceListResult {
  keys: Array<{ name: string }>
  list_complete: boolean
  cursor?: string
}

type KVNamespace = {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; cursor?: string; limit?: number }): Promise<KVNamespaceListResult>
}

type R2ObjectBody = {
  body: ReadableStream<Uint8Array> | null
  writeHttpMetadata(headers: Headers): void
  httpEtag: string
}

type R2Bucket = {
  put(key: string, value: BodyInit | ReadableStream | null, options?: Record<string, unknown>): Promise<{ etag?: string } | null>
  get(key: string, options?: Record<string, unknown>): Promise<R2ObjectBody | null>
  delete(key: string): Promise<void>
}

interface Env {
  KV: KVNamespace
  R2: R2Bucket
  R2_BUCKET: string
  R2_PUBLIC_BASE_URL?: string
  JWT_ISSUER?: string
  JWT_AUDIENCE?: string
  CORS_ALLOW_ORIGIN?: string
  DEFAULT_TENANT_ID?: string
  CAP_KV_PREFIX?: string
  AUDIT_R2_PREFIX?: string
  ARTIFACT_TTL_DAYS?: string
  ARTIFACT_EXTEND_COST_CENTS?: string
  ARTIFACT_EXTEND_MAX_DAYS?: string
  DEFAULT_TENANT_CAP_CENTS?: string
  DEFAULT_SPELL_ESTIMATE_CENTS?: string

  NATS_URL?: string
  NATS_AUTH_TOKEN?: string
  INTERNAL_API_TOKEN?: string

  SESSION_SECRET?: string
  STRIPE_SECRET?: string
  STRIPE_WEBHOOK_SECRET?: string
  DATABASE_URL?: string
  GITHUB_APP_PRIVATE_KEY?: string
  GITHUB_APP_WEBHOOK_SECRET?: string
  GITHUB_OAUTH_CLIENT_ID?: string
  GITHUB_OAUTH_CLIENT_SECRET?: string
  GITHUB_APP_ID?: string
  GITHUB_API_BASE?: string
  OTLP_HEADERS?: string
}

interface ScheduledEvent {
  cron?: string
}

import {
  createAppJwt,
  getInstallationIdForRepo,
  createInstallationToken,
  dispatchWorkflow,
  cancelWorkflowRun,
  getLatestWorkflowRun,
  getWorkflowRun,
  listArtifactsForRun,
  getArtifactDownloadUrl,
  RepoAccessError,
  WorkflowNotFoundError,
  GithubApiError,
} from './github'
import { getDatabase, runQuery, runQuerySingle } from './db'

const text = (body: string, status = 200, headers: HeadersInit = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...headers } })

function corsHeaders(env: Env): Record<string, string> {
  const origin = env.CORS_ALLOW_ORIGIN || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type,authorization,stripe-signature',
    'Access-Control-Max-Age': '600',
  }
}

function withCORS(env: Env, res: Response): Response {
  const headers = new Headers(res.headers)
  const ch = corsHeaders(env)
  Object.entries(ch).forEach(([k, v]) => headers.set(k, v))
  return new Response(res.body, { status: res.status, headers })
}

function okJSON(env: Env, data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(env) },
  })
}

async function hmacSHA256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
  return [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let res = 0
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return res === 0
}

function parseStripeSigHeader(header: string | null): { t: number; v1: string } | null {
  if (!header) return null
  const parts = header.split(',').map((s) => s.trim())
  let t = 0
  let v1 = ''
  for (const p of parts) {
    const [k, v] = p.split('=')
    if (k === 't') t = parseInt(v, 10)
    if (k === 'v1') v1 = v
  }
  if (!t || !v1) return null
  return { t, v1 }
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('')
}

type TraceContext = {
  traceparent: string
  trace_id: string
  span_id: string
}

function parseTraceparent(header?: string | null): TraceContext {
  if (header) {
    const parts = header.split('-')
    if (parts.length === 4 && parts[0] === '00') {
      const traceId = parts[1]
      const spanId = parts[2]
      const flags = parts[3] || '01'
      if (traceId?.length === 32 && spanId?.length === 16) {
        return { traceparent: `00-${traceId}-${spanId}-${flags}`, trace_id: traceId, span_id: spanId }
      }
    }
  }
  const traceId = randomHex(16)
  const spanId = randomHex(8)
  return { traceparent: `00-${traceId}-${spanId}-01`, trace_id: traceId, span_id: spanId }
}

function childTrace(trace: TraceContext): TraceContext {
  const spanId = randomHex(8)
  return { traceparent: `00-${trace.trace_id}-${spanId}-01`, trace_id: trace.trace_id, span_id: spanId }
}

function logEvent(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}, trace?: TraceContext) {
  const payload = {
    level,
    event,
    trace_id: trace?.trace_id,
    span_id: trace?.span_id,
    ...data,
  }
  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

function recordMetric(name: string, value: number, attributes: Record<string, unknown> = {}, trace?: TraceContext) {
  logEvent('info', 'metric', { metric: name, value, attributes }, trace)
}

function formatYyyyMmDd(ts: number): string {
  const d = new Date(ts)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

async function readR2ObjectAsText(obj: R2ObjectBody | null): Promise<string> {
  if (!obj?.body) return ''
  const response = new Response(obj.body)
  return await response.text()
}

function buildR2Key(runId: string): string {
  return `artifacts/${runId}/result.zip`
}

function buildPublicArtifactUrl(env: Env, key: string): string | undefined {
  const base = env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '')
  if (!base) return undefined
  const encodedKey = key.split('/').map(encodeURIComponent).join('/')
  return `${base}/${encodedKey}`
}

function computeArtifactExpiry(env: Env): number {
  const ttlDaysRaw = parseInt(env.ARTIFACT_TTL_DAYS || '7', 10)
  const ttlDays = Number.isFinite(ttlDaysRaw) && ttlDaysRaw > 0 ? ttlDaysRaw : 7
  return Date.now() + ttlDays * 24 * 60 * 60 * 1000
}

export async function mirrorGithubArtifactToR2(env: Env, runId: string, url: string): Promise<{
  artifactUrl: string
  sha256: string
  sizeBytes: number
  expiresAt: number
}> {
  const res = await fetch(url)
  if (!res.ok) {
    const textBody = await res.text().catch(() => '')
    throw new Error(`artifact download failed: ${res.status} ${textBody}`)
  }
  const buffer = await res.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  const sizeBytes = buffer.byteLength
  const key = buildR2Key(runId)
  const contentType = res.headers.get('content-type') || 'application/zip'
  await env.R2.put(key, buffer, { httpMetadata: { contentType } })
  const artifactUrl = buildPublicArtifactUrl(env, key) || `r2://${env.R2_BUCKET}/${key}`
  const expiresAt = computeArtifactExpiry(env)
  return { artifactUrl, sha256, sizeBytes, expiresAt }
}

async function publishToNats(env: Env, subject: string, body: Record<string, unknown>, trace: TraceContext, extraHeaders: Record<string, string> = {}) {
  const base = env.NATS_URL
  const token = env.NATS_AUTH_TOKEN
  if (!base || !token) throw new Error('NATS not configured')
  const url = `${base.replace(/\/$/, '')}/publish/${encodeURIComponent(subject)}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      traceparent: trace.traceparent,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const textBody = await res.text().catch(() => '')
    throw new Error(`nats publish failed: ${res.status} ${textBody}`)
  }
}

type LedgerEntryKind = 'estimate' | 'charge' | 'finalize' | 'refund' | 'credit'

type LedgerEntry = {
  id: string
  tenant_id: string
  cast_id?: string
  spell_id?: string
  kind: LedgerEntryKind
  cents: number
  currency: string
  occurred_at: number
  meta?: Record<string, unknown>
  external_id?: string
  source?: string
  reason?: string
}

type CastRecord = {
  id: string
  run_id: string
  tenant_id: string
  spell_id: string
  idempotency_key: string
  mode: 'workflow' | 'service' | 'clone'
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled'
  started_at: number
  estimate_cents: number
  cost_cents?: number
  timeout_sec: number
  region: string
  budget_cap_cents?: number
  done_at?: number
  canceled_at?: number
  gh_run_id?: number
  artifact_url?: string
  artifact_expires_at?: number
  artifact_size_bytes?: number
  artifact_sha256?: string
  logs_url?: string
  failure_reason?: string
  p95_ms?: number
  error_rate?: number
}

type IdempotencyRecord = {
  cast_id: string
  run_id: string
  created_at: number
  body: unknown
}

function buildCastResponse(rec: CastRecord) {
  return {
    run_id: rec.run_id,
    cast_id: Number(rec.id),
    status: rec.status,
    estimate_cents: rec.estimate_cents,
    progress_sse: `/api/v1/casts/${rec.id}/events`,
    idempotency_key: rec.idempotency_key,
    mode: rec.mode,
    timeout_sec: rec.timeout_sec,
    region: rec.region,
    gh: rec.mode === 'workflow' ? { ownerRepo: 'NishizukaKoichi/Spell', workflowId: 'spell-run.yml', ref: 'main' } : undefined,
  }
}

function buildCastDetail(rec: CastRecord) {
  return {
    cast_id: Number(rec.id),
    run_id: rec.run_id,
    tenant_id: rec.tenant_id,
    spell_id: rec.spell_id,
    status: rec.status,
    estimate_cents: rec.estimate_cents,
    cost_cents: rec.cost_cents ?? null,
    started_at: rec.started_at,
    finished_at: rec.done_at,
    canceled_at: rec.canceled_at,
    mode: rec.mode,
    region: rec.region,
    timeout_sec: rec.timeout_sec,
    budget_cap_cents: rec.budget_cap_cents ?? null,
    artifact_url: rec.artifact_url,
    artifact_sha256: rec.artifact_sha256,
    artifact_size_bytes: rec.artifact_size_bytes ?? null,
    artifact_expires_at: rec.artifact_expires_at,
    failure_reason: rec.failure_reason,
    logs_url: rec.logs_url,
    p95_ms: rec.p95_ms,
    error_rate: rec.error_rate,
  }
}

type CastRow = {
  id: number
  run_id: string
  tenant_id: number
  spell_id: number
  caster_user_id: number
  idempotency_key: string
  mode: string
  status: string
  estimate_cents: number
  cost_cents: number | null
  timeout_sec: number
  region: string | null
  budget_cap_cents: number | null
  started_at: string | null
  finished_at: string | null
  canceled_at: string | null
  artifact_url: string | null
  artifact_expires_at: string | null
  artifact_size_bytes: number | null
  artifact_sha256: string | null
  logs_url: string | null
  failure_reason: string | null
  p95_ms: number | null
  error_rate: number | null
  gh_run_id: number | null
  sse_channel: string | null
  input_hash: string
  created_at: string | null
  updated_at: string | null
}

function mapCastRow(row: CastRow): CastRecord {
  const toMs = (value: string | null): number | undefined => {
    if (!value) return undefined
    const ts = Date.parse(value)
    return Number.isFinite(ts) ? ts : undefined
  }
  const optionalNumber = (value: number | null): number | undefined => (value === null || value === undefined ? undefined : value)
  return {
    id: String(row.id),
    run_id: row.run_id,
    tenant_id: String(row.tenant_id),
    spell_id: String(row.spell_id),
    idempotency_key: row.idempotency_key,
    mode: (row.mode as CastRecord['mode']) || 'workflow',
    status: (row.status as CastRecord['status']) || 'queued',
    started_at: toMs(row.started_at ?? row.created_at ?? null) ?? Date.now(),
    estimate_cents: row.estimate_cents ?? 0,
    cost_cents: optionalNumber(row.cost_cents),
    timeout_sec: row.timeout_sec ?? 60,
    region: row.region || 'auto',
    budget_cap_cents: optionalNumber(row.budget_cap_cents),
    done_at: toMs(row.finished_at),
    canceled_at: toMs(row.canceled_at),
    gh_run_id: optionalNumber(row.gh_run_id),
    artifact_url: row.artifact_url || undefined,
    artifact_expires_at: toMs(row.artifact_expires_at),
    artifact_size_bytes: optionalNumber(row.artifact_size_bytes),
    artifact_sha256: row.artifact_sha256 || undefined,
    logs_url: row.logs_url || undefined,
    failure_reason: row.failure_reason || undefined,
    p95_ms: optionalNumber(row.p95_ms),
    error_rate: row.error_rate === null || row.error_rate === undefined ? undefined : Number(row.error_rate),
  }
}

async function computeInputHash(input: unknown): Promise<string> {
  const encoder = new TextEncoder()
  const payload = encoder.encode(JSON.stringify(input ?? {}))
  const digest = await crypto.subtle.digest('SHA-256', payload)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function saveCastRecord(env: Env, rec: CastRecord): Promise<void> {
  if (env.DATABASE_URL) {
    const castDbId = optionalDbId(rec.id)
    if (castDbId === null) return
    const conn = getDatabase(env)
    const finished = rec.done_at ? toMysqlDateTime(new Date(rec.done_at)) : null
    const canceled = rec.canceled_at ? toMysqlDateTime(new Date(rec.canceled_at)) : null
    const artifactExpiry = rec.artifact_expires_at ? toMysqlDateTime(new Date(rec.artifact_expires_at)) : null
    await conn.execute(
      `UPDATE casts SET status = ?, cost_cents = ?, artifact_url = ?, artifact_sha256 = ?, artifact_size_bytes = ?, artifact_expires_at = ?, logs_url = ?, failure_reason = ?, p95_ms = ?, error_rate = ?, gh_run_id = ?, finished_at = ?, canceled_at = ?, region = ?, timeout_sec = ?, budget_cap_cents = ? WHERE id = ?`,
      [
        rec.status,
        rec.cost_cents ?? null,
        rec.artifact_url ?? null,
        rec.artifact_sha256 ?? null,
        rec.artifact_size_bytes ?? null,
        artifactExpiry,
        rec.logs_url ?? null,
        rec.failure_reason ?? null,
        rec.p95_ms ?? null,
        rec.error_rate ?? null,
        rec.gh_run_id ?? null,
        finished,
        canceled,
        rec.region,
        rec.timeout_sec,
        rec.budget_cap_cents ?? null,
        castDbId,
      ],
    )
    return
  }
  await env.KV.put(kvKeyCast(rec.id, env), JSON.stringify(rec), { expirationTtl: 60 * 60 })
}

function kvKeyCast(id: string, env: Env) {
  return `${env.CAP_KV_PREFIX || 'cap'}:cast:${id}`
}

function kvKeySpell(id: string, env: Env) {
  return `${env.CAP_KV_PREFIX || 'cap'}:spell:${id}`
}

function kvKeyLedgerMonth(tenantId: string, ts: number, env: Env) {
  const d = new Date(ts)
  const y = d.getUTCFullYear()
  const m = `${d.getUTCMonth() + 1}`.padStart(2, '0')
  return `${env.CAP_KV_PREFIX || 'cap'}:ledger:${tenantId}:${y}${m}`
}

function kvKeyLedgerCast(castId: string, env: Env) {
  return `${env.CAP_KV_PREFIX || 'cap'}:ledger_cast:${castId}`
}

function kvKeyLedgerExternal(externalId: string, env: Env) {
  return `${env.CAP_KV_PREFIX || 'cap'}:ledger_ext:${externalId}`
}

function kvKeyRun(runId: string, env: Env) {
  return `${env.CAP_KV_PREFIX || 'cap'}:run:${runId}`
}

function kvKeyIdempotency(tenantId: string, key: string, env: Env) {
  return `${env.CAP_KV_PREFIX || 'cap'}:idem:${tenantId}:${key}`
}

async function appendAuditSnapshot(env: Env, entry: Record<string, unknown>, trace: TraceContext): Promise<void> {
  try {
    const occurredAtValue = typeof entry.occurred_at === 'string' ? Date.parse(entry.occurred_at) : undefined
    const when = Number.isFinite(occurredAtValue) ? Number(occurredAtValue) : Date.now()
    const prefix = (env.AUDIT_R2_PREFIX || 'audit').replace(/\/$/, '')
    const key = `${prefix}/daily-${formatYyyyMmDd(when)}.jsonl`
    const normalized = {
      ...entry,
      occurred_at: typeof entry.occurred_at === 'string' ? entry.occurred_at : new Date(when).toISOString(),
    }
    const existing = await env.R2.get(key)
    if (existing) {
      const previous = await readR2ObjectAsText(existing)
      await env.R2.put(key, previous + JSON.stringify(normalized) + '\n', {
        httpMetadata: { contentType: 'application/json' },
      })
    } else {
      await env.R2.put(key, JSON.stringify(normalized) + '\n', {
        httpMetadata: { contentType: 'application/json' },
      })
    }
  } catch (auditErr) {
    logEvent('warn', 'audit_snapshot_error', { error: String(auditErr) }, trace)
  }
}

async function appendLedgerEntry(env: Env, entry: LedgerEntry, trace: TraceContext): Promise<void> {
  if (env.DATABASE_URL) {
    try {
      const conn = getDatabase(env)
      const occurredAtIso = toMysqlDateTime(new Date(entry.occurred_at))
      await conn.execute(
        `INSERT INTO billing_ledger (tenant_id, cast_id, spell_id, kind, amount_cents, currency, occurred_at, meta_json, external_id, source, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE amount_cents = amount_cents`,
        [
          requiredDbId(entry.tenant_id, 0),
          optionalDbId(entry.cast_id),
          optionalDbId(entry.spell_id),
          entry.kind,
          entry.cents,
          entry.currency,
          occurredAtIso,
          JSON.stringify(entry.meta ?? {}),
          entry.external_id ?? null,
          entry.source ?? 'system',
          entry.reason ?? 'usage',
        ],
      )
      return
    } catch (dbErr) {
      logEvent('warn', 'ledger_persist_db_error', { error: String(dbErr) }, trace)
    }
  }

  const key = kvKeyLedgerMonth(entry.tenant_id, entry.occurred_at, env)
  const line = JSON.stringify(entry)
  try {
    const existing = await env.KV.get(key)
    if (existing && entry.external_id) {
      const dup = existing
        .split('\n')
        .filter(Boolean)
        .some((row) => {
          try {
            const parsed = JSON.parse(row) as LedgerEntry
            return parsed.external_id === entry.external_id
          } catch (_) {
            return false
          }
        })
      if (dup) return
    }
    const payload = existing ? `${existing}\n${line}` : line
    await env.KV.put(key, payload, { expirationTtl: 60 * 60 * 24 * 120 })
  } catch (e) {
    logEvent('warn', 'ledger_persist_error', { error: String(e) }, trace)
  }
  if (entry.cast_id) {
    try {
      await env.KV.put(kvKeyLedgerCast(entry.cast_id, env), line, { expirationTtl: 60 * 60 * 24 * 120 })
    } catch (e) {
      logEvent('warn', 'ledger_cast_persist_error', { error: String(e) }, trace)
    }
  }
  if (entry.external_id) {
    try {
      await env.KV.put(kvKeyLedgerExternal(entry.external_id, env), line, { expirationTtl: 60 * 60 * 24 * 365 })
    } catch (e) {
      logEvent('warn', 'ledger_external_persist_error', { error: String(e) }, trace)
    }
  }
}

async function appendFinalizeLedgerEntry(env: Env, rec: CastRecord, trace: TraceContext): Promise<void> {
  if (!rec.id) return
  const castDbId = optionalDbId(rec.id)
  if (castDbId === null) return
  if (env.DATABASE_URL) {
    try {
      const existing = await runQuerySingle<{ id: string }>(
        env,
        'SELECT id FROM billing_ledger WHERE cast_id = ? AND kind = ? LIMIT 1',
        [castDbId, 'finalize'],
      )
      if (existing) return
    } catch (dbErr) {
      logEvent('warn', 'ledger_finalize_check_error', { error: String(dbErr) }, trace)
    }
  } else {
    try {
      const existing = await env.KV.get(kvKeyLedgerCast(rec.id, env))
      if (existing) {
        try {
          const parsed = JSON.parse(existing) as LedgerEntry
          if (parsed.kind === 'finalize') return
        } catch (_) {}
      }
    } catch (_) {}
  }

  const entry: LedgerEntry = {
    id: `led_${crypto.randomUUID()}`,
    tenant_id: rec.tenant_id,
    cast_id: rec.id,
    spell_id: rec.spell_id,
    kind: 'finalize',
    cents: rec.cost_cents ?? 0,
    currency: 'USD',
    occurred_at: rec.done_at ?? Date.now(),
    meta: { status: rec.status, mode: rec.mode },
    source: 'system',
    reason: 'finalize',
  }
  await appendLedgerEntry(env, entry, trace)
}

function requiredDbId(value: string | number | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value !== undefined) {
    const parsed = parseInt(String(value), 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function optionalDbId(value: string | number | undefined): number | null {
  if (value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function toMysqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function parseEstimateFromPricing(pricingJson: string | null | undefined): number | null {
  if (!pricingJson) return null
  try {
    const parsed = JSON.parse(pricingJson) as Record<string, unknown>
    const direct = parsed?.['estimate_cents']
    if (typeof direct === 'number' && Number.isFinite(direct)) return Math.max(0, Math.round(direct))
    const flat = parsed?.['flat_cents']
    if (typeof flat === 'number' && Number.isFinite(flat)) return Math.max(0, Math.round(flat))
    const oneTime = parsed?.['one_time_cents']
    if (typeof oneTime === 'number' && Number.isFinite(oneTime)) return Math.max(0, Math.round(oneTime))
  } catch (_) {}
  return null
}

async function getSpellEstimate(env: Env, spellId: string, trace: TraceContext): Promise<number> {
  if (env.DATABASE_URL) {
    try {
      const row = await runQuerySingle<{ pricing_json?: string | null }>(
        env,
        'SELECT pricing_json FROM spells WHERE id = ?',
        [requiredDbId(spellId, 0)],
      )
      const estimate = parseEstimateFromPricing(row?.pricing_json)
      if (estimate !== null) return estimate
    } catch (e) {
      logEvent('warn', 'spell_estimate_db_error', { error: String(e), spell_id: spellId }, trace)
    }
  } else {
    try {
      const raw = await env.KV.get(kvKeySpell(spellId, env))
      if (raw) {
        const parsed = JSON.parse(raw) as { estimate_cents?: number }
        if (typeof parsed?.estimate_cents === 'number' && Number.isFinite(parsed.estimate_cents)) {
          return Math.max(0, Math.round(parsed.estimate_cents))
        }
      }
    } catch (e) {
      logEvent('warn', 'spell_estimate_parse_error', { error: String(e), spell_id: spellId }, trace)
    }
  }
  const fallbackRaw = parseInt(env.DEFAULT_SPELL_ESTIMATE_CENTS || '25', 10)
  return Number.isFinite(fallbackRaw) && fallbackRaw >= 0 ? fallbackRaw : 25
}

async function getMonthlyEstimateUsage(env: Env, tenantId: string, ts: number, trace: TraceContext): Promise<number> {
  if (env.DATABASE_URL) {
    try {
      const start = new Date(Date.UTC(new Date(ts).getUTCFullYear(), new Date(ts).getUTCMonth(), 1))
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
      const row = await runQuerySingle<{ total?: string | number | null }>(
        env,
        'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM billing_ledger WHERE tenant_id = ? AND kind = ? AND occurred_at >= ? AND occurred_at < ?',
        [requiredDbId(tenantId, 0), 'estimate', toMysqlDateTime(start), toMysqlDateTime(end)],
      )
      const total = row?.total
      if (typeof total === 'number') return total
      if (typeof total === 'string') {
        const parsed = parseInt(total, 10)
        if (Number.isFinite(parsed)) return parsed
      }
      return 0
    } catch (e) {
      logEvent('warn', 'ledger_usage_db_error', { error: String(e), tenant_id: tenantId }, trace)
      return 0
    }
  }

  const key = kvKeyLedgerMonth(tenantId, ts, env)
  try {
    const raw = await env.KV.get(key)
    if (!raw) return 0
    const lines = raw.split('\n').filter(Boolean)
    let total = 0
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as LedgerEntry
        if (entry.kind === 'estimate' && typeof entry.cents === 'number') total += entry.cents
      } catch (_) {}
    }
    return total
  } catch (e) {
    logEvent('warn', 'ledger_usage_read_error', { error: String(e), tenant_id: tenantId }, trace)
    return 0
  }
}

async function appendEstimateLedgerEntry(env: Env, rec: CastRecord, trace: TraceContext): Promise<void> {
  const entry: LedgerEntry = {
    id: `led_${crypto.randomUUID()}`,
    tenant_id: rec.tenant_id,
    cast_id: rec.id,
    spell_id: rec.spell_id,
    kind: 'estimate',
    cents: rec.estimate_cents,
    currency: 'USD',
    occurred_at: rec.started_at,
    meta: { mode: rec.mode },
    source: 'system',
    reason: 'estimate',
  }
  await appendLedgerEntry(env, entry, trace)
}

async function handleCastCreate(req: Request, env: Env, spellId: string): Promise<Response> {
  if (req.method === 'OPTIONS') return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  if (req.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(req.headers.get('traceparent'))

  const idemHeader = req.headers.get('Idempotency-Key')
  if (!idemHeader || !idemHeader.trim()) {
    const err = { code: 'VALIDATION_ERROR', message: 'Idempotency-Key header required' }
    return withCORS(env, new Response(JSON.stringify(err), { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }
  const idem = idemHeader.trim()

  let json: any = {}
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      json = await req.json()
    }
  } catch (_) {}

  const modeInput = (json?.mode as string) || 'workflow'
  const mode: 'workflow' | 'service' | 'clone' = modeInput === 'service' ? 'service' : modeInput === 'clone' ? 'clone' : 'workflow'
  if (mode === 'clone') {
    const err = { code: 'NOT_IMPLEMENTED', message: 'clone mode not yet supported' }
    return withCORS(env, new Response(JSON.stringify(err), { status: 501, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  const tenantId = (env.DEFAULT_TENANT_ID || '1').toString()
  const tenantNumeric = requiredDbId(tenantId, 1)

  if (env.DATABASE_URL) {
    try {
      const row = await runQuerySingle<CastRow>(
        env,
        'SELECT * FROM casts WHERE tenant_id = ? AND idempotency_key = ? LIMIT 1',
        [tenantNumeric, idem],
      )
      if (row) {
        recordMetric('cast.idempotency.hit', 1, { tenant_id: tenantId, storage: 'db' }, trace)
        return okJSON(env, buildCastResponse(mapCastRow(row)))
      }
    } catch (dbErr) {
      logEvent('warn', 'idem_lookup_db_error', { error: String(dbErr) }, trace)
    }
  }

  let kvIdemRecord: IdempotencyRecord | null = null
  if (!env.DATABASE_URL) {
    const idemKeyLegacy = kvKeyIdempotency(tenantId, idem, env)
    const existingRaw = await env.KV.get(idemKeyLegacy)
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw) as IdempotencyRecord
        if (parsed?.body) {
          recordMetric('cast.idempotency.hit', 1, { tenant_id: tenantId, storage: 'kv' }, trace)
          return okJSON(env, parsed.body)
        }
        kvIdemRecord = parsed
      } catch (e) {
        logEvent('warn', 'idem_record_parse_error', { error: String(e) }, trace)
      }
    }
  }

  const now = Date.now()
  const estimateCents = await getSpellEstimate(env, spellId, trace)
  const usageCents = await getMonthlyEstimateUsage(env, tenantId, now, trace)
  const capRaw = parseInt(env.DEFAULT_TENANT_CAP_CENTS || '1000', 10)
  const capCents = Number.isFinite(capRaw) && capRaw > 0 ? capRaw : 1000

  const budgetCapRaw = json?.budget_cap_cents
  const budgetCapCents = typeof budgetCapRaw === 'number' && Number.isFinite(budgetCapRaw) && budgetCapRaw >= 0 ? Math.round(budgetCapRaw) : undefined

  if (usageCents + estimateCents > capCents) {
    const body = {
      code: 'BUDGET_CAP_EXCEEDED',
      message: 'Estimated cost exceeds tenant monthly cap',
      estimate_cents: estimateCents,
      usage_cents: usageCents,
      cap_cents: capCents,
      request_id: crypto.randomUUID(),
    }
    return withCORS(env, new Response(JSON.stringify(body), { status: 402, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  if (budgetCapCents !== undefined && estimateCents > budgetCapCents) {
    const body = {
      code: 'BUDGET_CAP_EXCEEDED',
      message: 'Estimate exceeds provided cap',
      estimate_cents: estimateCents,
      cap_cents: budgetCapCents,
      request_id: crypto.randomUUID(),
    }
    return withCORS(env, new Response(JSON.stringify(body), { status: 402, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  const region = typeof json?.region === 'string' && json.region.trim() ? json.region.trim() : 'auto'
  const timeoutInput = json?.timeout_sec
  let timeoutSec = typeof timeoutInput === 'number' ? timeoutInput : parseInt(String(timeoutInput || ''), 10)
  if (!Number.isFinite(timeoutSec) || timeoutSec <= 0) timeoutSec = 60
  timeoutSec = Math.min(Math.max(Math.round(timeoutSec), 10), 60 * 60)

  const runId = `c_${crypto.randomUUID()}`
  const inputPayload = json?.input ?? {}
  const inputHash = await computeInputHash(inputPayload)

  let cast: CastRecord

  if (env.DATABASE_URL) {
    const spellNumeric = requiredDbId(spellId, 0)
    if (!spellNumeric) {
      return withCORS(env, new Response(JSON.stringify({ code: 'SPELL_NOT_FOUND', message: 'Spell not found' }), { status: 404, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
    try {
      const spellRow = await runQuerySingle<{ id: number; tenant_id: number }>(
        env,
        'SELECT id, tenant_id FROM spells WHERE id = ? LIMIT 1',
        [spellNumeric],
      )
      if (!spellRow) {
        return withCORS(env, new Response(JSON.stringify({ code: 'SPELL_NOT_FOUND', message: 'Spell not found' }), { status: 404, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
      }
      if (spellRow.tenant_id !== tenantNumeric) {
        return withCORS(env, new Response(JSON.stringify({ code: 'FORBIDDEN', message: 'Spell does not belong to tenant' }), { status: 403, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
      }

      const casterUserId = requiredDbId(env.DEFAULT_CASTER_USER_ID || tenantNumeric, tenantNumeric)
      const conn = getDatabase(env)
      const result = await conn.execute(
        `INSERT INTO casts (tenant_id, spell_id, caster_user_id, run_id, idempotency_key, mode, status, estimate_cents, timeout_sec, region, budget_cap_cents, started_at, input_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [
          tenantNumeric,
          spellRow.id,
          casterUserId,
          runId,
          idem,
          mode,
          'queued',
          estimateCents,
          timeoutSec,
          region,
          budgetCapCents ?? null,
          inputHash,
        ],
      )

      const insertedId = result.insertId
      const castRow = await runQuerySingle<CastRow>(
        env,
        'SELECT * FROM casts WHERE id = ? LIMIT 1',
        [parseInt(String(insertedId), 10)],
      )
      if (!castRow) throw new Error('cast_not_found_after_insert')
      cast = mapCastRow(castRow)
    } catch (dbErr) {
      logEvent('error', 'cast_insert_db_error', { error: String(dbErr) }, trace)
      return withCORS(env, new Response(JSON.stringify({ code: 'INTERNAL', message: 'Failed to create cast' }), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
  } else {
    const castId = `${Math.floor(now / 1000)}${Math.floor(Math.random() * 1000)}`
    cast = {
      id: castId,
      run_id: runId,
      tenant_id: tenantId,
      spell_id: spellId,
      idempotency_key: idem,
      mode,
      status: 'queued',
      started_at: now,
      estimate_cents: estimateCents,
      timeout_sec: timeoutSec,
      region,
      budget_cap_cents: budgetCapCents,
    }
  }

  const castDbId = optionalDbId(cast.id)

  if (mode === 'workflow') {
    const ownerRepo = 'NishizukaKoichi/Spell'
    const workflowId = 'spell-run.yml'
    const ref = 'main'
    const appId = env.GITHUB_APP_ID
    const pem = env.GITHUB_APP_PRIVATE_KEY
    if (!appId || !pem) {
      if (env.DATABASE_URL && castDbId !== null) {
        await getDatabase(env).execute('DELETE FROM casts WHERE id = ?', [castDbId])
      }
      return withCORS(env, new Response(JSON.stringify({ code: 'INTERNAL', message: 'GitHub App not configured' }), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
    try {
      let stage: 'create_jwt' | 'get_installation' | 'create_token' | 'dispatch' = 'create_jwt'
      const jwt = await createAppJwt(appId, pem)
      stage = 'get_installation'
      const instId = await getInstallationIdForRepo(jwt, ownerRepo, env.GITHUB_API_BASE)
      stage = 'create_token'
      const instTok = await createInstallationToken(jwt, instId, undefined, env.GITHUB_API_BASE)
      stage = 'dispatch'
      await dispatchWorkflow(instTok, ownerRepo, workflowId, ref, { run_id: runId, spell_id: spellId, input: inputPayload }, env.GITHUB_API_BASE)
      try {
        const latest = await getLatestWorkflowRun(instTok, ownerRepo, workflowId, ref, env.GITHUB_API_BASE)
        if (latest && latest.id) {
          cast.gh_run_id = latest.id
          if (env.DATABASE_URL && castDbId !== null) {
            await getDatabase(env).execute('UPDATE casts SET gh_run_id = ? WHERE id = ?', [latest.id, castDbId])
          }
        }
      } catch (err) {
        logEvent('warn', 'workflow_latest_run_error', { error: String(err) }, trace)
      }
    } catch (e: any) {
      logEvent('error', 'workflow_dispatch_error', { error: String(e), stage: e?.stage }, trace)
      if (env.DATABASE_URL && castDbId !== null) {
        await getDatabase(env).execute('DELETE FROM casts WHERE id = ?', [castDbId])
      }
      if (e instanceof WorkflowNotFoundError) {
        return withCORS(env, new Response(JSON.stringify({ code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found' }), { status: 404, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
      }
      if (e instanceof RepoAccessError) {
        return withCORS(env, new Response(JSON.stringify({ code: 'FORBIDDEN_REPO', message: 'Repo not accessible by App' }), { status: 403, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
      }
      if (e instanceof GithubApiError) {
        return withCORS(env, new Response(JSON.stringify({ code: 'GITHUB_API_ERROR', status: e.status, stage: (e as any).stage || undefined }), { status: 502, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
      }
      return withCORS(env, new Response(JSON.stringify({ code: 'INTERNAL', message: 'Dispatch failed' }), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
  } else if (mode === 'service') {
    try {
      await publishToNats(env, `spell.run.${spellId}`, {
        run_id: cast.run_id,
        cast_id: cast.id,
        tenant_id: cast.tenant_id,
        spell_id: cast.spell_id,
        mode,
        input: inputPayload,
        created_at: now,
        timeout_sec: timeoutSec,
        region,
        estimate_cents: estimateCents,
      }, trace, { 'Nats-Msg-Id': idem })
    } catch (err) {
      logEvent('error', 'nats_publish_error', { error: String(err) }, trace)
      if (env.DATABASE_URL && castDbId !== null) {
        await getDatabase(env).execute('DELETE FROM casts WHERE id = ?', [castDbId])
      }
      return withCORS(env, new Response(JSON.stringify({ code: 'RUNTIME_UNAVAILABLE', message: 'Service runner unavailable' }), { status: 503, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
  }

  if (!env.DATABASE_URL) {
    await saveCastRecord(env, cast)
    try {
      const idemKeyLegacy = kvKeyIdempotency(tenantId, idem, env)
      const idemRecord: IdempotencyRecord = { cast_id: cast.id, run_id: cast.run_id, created_at: now, body: buildCastResponse(cast) }
      await env.KV.put(idemKeyLegacy, JSON.stringify(idemRecord), { expirationTtl: 60 * 60 * 24 })
    } catch (e) {
      logEvent('warn', 'idempotency_persist_error', { error: String(e) }, trace)
    }
  }

  try {
    await appendEstimateLedgerEntry(env, cast, trace)
  } catch (e) {
    logEvent('warn', 'ledger_estimate_error', { error: String(e) }, trace)
  }

  return okJSON(env, buildCastResponse(cast))
}

async function handleCastGet(_req: Request, env: Env, castId: string): Promise<Response> {
  if (env.DATABASE_URL) {
    const row = await runQuerySingle<CastRow>(env, 'SELECT * FROM casts WHERE id = ? LIMIT 1', [requiredDbId(castId, 0)])
    if (!row) return withCORS(env, text('Not Found', 404))
    return okJSON(env, buildCastDetail(mapCastRow(row)))
  }

  const raw = await env.KV.get(kvKeyCast(castId, env))
  if (!raw) return withCORS(env, text('Not Found', 404))
  const rec = JSON.parse(raw) as CastRecord
  return okJSON(env, buildCastDetail(rec))
}

async function pollCastRecord(env: Env, castId: string): Promise<CastRecord | null> {
  if (env.DATABASE_URL) {
    const row = await runQuerySingle<CastRow>(env, 'SELECT * FROM casts WHERE id = ? LIMIT 1', [requiredDbId(castId, 0)])
    return row ? mapCastRow(row) : null
  }
  try {
    const raw = await env.KV.get(kvKeyCast(castId, env))
    if (!raw) return null
    return JSON.parse(raw) as CastRecord
  } catch (_) {
    return null
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function handleCastEvents(req: Request, env: Env, castId: string): Promise<Response> {
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const headers = new Headers({
    'content-type': 'text/event-stream; charset=utf-8',
    connection: 'keep-alive',
    'cache-control': 'no-cache',
    ...corsHeaders(env),
  })
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (obj: any, event?: string) => {
        let chunk = ''
        if (event) chunk += `event: ${event}\n`
        chunk += `data: ${JSON.stringify(obj)}\n\n`
        controller.enqueue(enc.encode(chunk))
      }

      let rec = await pollCastRecord(env, castId)
      if (!rec) {
        send({ message: 'cast not found' }, 'error')
        controller.close()
        return
      }

      send({ stage: rec.status || 'queued', message: rec.status }, 'progress')

      if (rec.mode === 'service') {
        let lastArtifactHash = rec.artifact_sha256 || ''
        let lastStatus = rec.status
        send({ now: new Date().toISOString() }, 'heartbeat')
        for (let i = 0; i < 300; i++) {
          await sleep(2000)
          const next = await pollCastRecord(env, castId)
          if (!next) break
          rec = next
          if (rec.artifact_sha256 && rec.artifact_sha256 !== lastArtifactHash && rec.artifact_url) {
            lastArtifactHash = rec.artifact_sha256
            send(
              {
                url: rec.artifact_url,
                sha256: rec.artifact_sha256,
                ttl_expires_at: rec.artifact_expires_at,
                size_bytes: rec.artifact_size_bytes,
              },
              'artifact_ready',
            )
          }
          if (rec.status !== lastStatus) {
            lastStatus = rec.status
            if (rec.status === 'running') send({ stage: 'running', message: 'in_progress' }, 'progress')
            if (rec.status === 'succeeded') {
              send({ status: 'succeeded', cost_cents: rec.cost_cents ?? undefined }, 'completed')
              break
            }
            if (rec.status === 'failed') {
              send({ status: 'failed', message: rec.failure_reason ?? rec.logs_url }, 'failed')
              break
            }
            if (rec.status === 'canceled') {
              send({ status: 'canceled' }, 'canceled')
              break
            }
          }
          send({ now: new Date().toISOString() }, 'heartbeat')
        }
        controller.close()
        return
      }

      // workflow polling via GitHub
      const appId = env.GITHUB_APP_ID
      const pem = env.GITHUB_APP_PRIVATE_KEY
      const ownerRepo = 'NishizukaKoichi/Spell'
      const workflowId = 'spell-run.yml'
      const ref = 'main'
      if (!appId || !pem) {
        send({ message: 'github app not configured' }, 'log')
        controller.close()
        return
      }
      try {
        const jwt = await createAppJwt(appId, pem)
        const instId = await getInstallationIdForRepo(jwt, ownerRepo, env.GITHUB_API_BASE)
        const instTok = await createInstallationToken(jwt, instId, undefined, env.GITHUB_API_BASE)
        for (let attempts = 0; attempts < 60; attempts++) {
          await sleep(2000)
          if (!rec.gh_run_id) {
            try {
              const latest = await getLatestWorkflowRun(instTok, ownerRepo, workflowId, ref, env.GITHUB_API_BASE)
              if (latest && latest.id) {
                rec.gh_run_id = latest.id
                await saveCastRecord(env, rec)
              }
            } catch (err) {
              logEvent('warn', 'workflow_latest_run_error', { error: String(err) }, trace)
            }
            send({ stage: 'queued', message: 'waiting for run' }, 'progress')
            continue
          }
          const run = await getWorkflowRun(instTok, ownerRepo, rec.gh_run_id, env.GITHUB_API_BASE)
          const st = run.status as string
          const concl = run.conclusion as string | null
          if (st === 'queued') send({ stage: 'queued', message: 'queued' }, 'progress')
          else if (st === 'in_progress') send({ stage: 'running', message: 'in_progress' }, 'progress')
          else if (st === 'completed') {
            try {
              const arts = await listArtifactsForRun(instTok, ownerRepo, rec.gh_run_id, env.GITHUB_API_BASE)
              const chosen = arts.find((a: any) => a.name === 'result') || arts[0]
              if (chosen) {
                const url = await getArtifactDownloadUrl(instTok, ownerRepo, chosen.id, env.GITHUB_API_BASE)
                if (url) {
                  try {
                    const mirrored = await mirrorGithubArtifactToR2(env, rec.run_id, url)
                    rec.artifact_url = mirrored.artifactUrl
                    rec.artifact_sha256 = mirrored.sha256
                    rec.artifact_size_bytes = mirrored.sizeBytes
                    rec.artifact_expires_at = mirrored.expiresAt
                  } catch (mirrorErr) {
                    logEvent('warn', 'artifact_mirror_error', { error: String(mirrorErr) }, trace)
                    rec.artifact_url = url
                    rec.artifact_expires_at = Date.now() + 10 * 60 * 1000
                  }
                  await saveCastRecord(env, rec)
                  if (rec.artifact_url) {
                    send(
                      {
                        url: rec.artifact_url,
                        sha256: rec.artifact_sha256,
                        ttl_expires_at: rec.artifact_expires_at,
                        size_bytes: rec.artifact_size_bytes,
                      },
                      'artifact_ready',
                    )
                  }
                }
              }
            } catch (artifactErr) {
              logEvent('warn', 'artifact_fetch_error', { error: String(artifactErr) }, trace)
            }
            rec.status = concl === 'success' ? 'succeeded' : 'failed'
            rec.done_at = Date.now()
            await saveCastRecord(env, rec)
            if (rec.status === 'succeeded') send({ status: 'succeeded' }, 'completed')
            else send({ status: 'failed' }, 'failed')
            break
          }
          send({ now: new Date().toISOString() }, 'heartbeat')
        }
      } catch (err) {
        logEvent('warn', 'workflow_poll_error', { error: String(err) }, trace)
      }
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers })
}

async function handleCastVerdict(req: Request, env: Env, castId: string): Promise<Response> {
  if (req.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const token = env.INTERNAL_API_TOKEN
  if (!token) return withCORS(env, text('Server misconfigured', 500))
  const header = req.headers.get('authorization') || ''
  if (!header.startsWith('Bearer ') || header.slice(7) !== token) {
    return withCORS(env, text('Unauthorized', 401))
  }
  let payload: any
  try {
    payload = await req.json()
  } catch (_) {
    return withCORS(env, text('Invalid JSON', 400))
  }
  const runId = payload?.run_id
  const statusInput = payload?.status
  if (typeof runId !== 'string' || !runId) return withCORS(env, text('run_id required', 400))
  if (typeof statusInput !== 'string' || !statusInput) return withCORS(env, text('status required', 400))

  let rec: CastRecord | null = null
  if (env.DATABASE_URL) {
    rec = await pollCastRecord(env, castId)
  } else {
    try {
      const raw = await env.KV.get(kvKeyCast(castId, env))
      if (raw) rec = JSON.parse(raw) as CastRecord
    } catch (_) {}
  }
  if (!rec) return withCORS(env, text('Not Found', 404))
  if (rec.run_id !== runId) return withCORS(env, text('run mismatch', 409))

  const lower = statusInput.toLowerCase()
  let nextStatus: CastRecord['status']
  if (lower === 'succeeded') nextStatus = 'succeeded'
  else if (lower === 'failed') nextStatus = 'failed'
  else if (lower === 'cancelled' || lower === 'canceled') nextStatus = 'canceled'
  else if (lower === 'running') nextStatus = 'running'
  else return withCORS(env, text('invalid status', 400))

  if (payload?.message && typeof payload.message === 'string') rec.failure_reason = payload.message
  if (payload?.logs_url && typeof payload.logs_url === 'string') rec.logs_url = payload.logs_url
  if (typeof payload?.p95_ms === 'number' && Number.isFinite(payload.p95_ms)) rec.p95_ms = Math.max(0, Math.round(payload.p95_ms))
  if (typeof payload?.error_rate === 'number' && Number.isFinite(payload.error_rate)) rec.error_rate = Math.max(0, Math.min(1, payload.error_rate))

  if (typeof payload?.cost_cents === 'number' && Number.isFinite(payload.cost_cents)) {
    rec.cost_cents = Math.max(0, Math.round(payload.cost_cents))
  }
  const currency = typeof payload?.currency === 'string' && payload.currency.trim() ? payload.currency.trim().toUpperCase() : 'USD'

  const artifact = payload?.artifact
  if (artifact && typeof artifact === 'object') {
    if (typeof artifact.url === 'string') rec.artifact_url = artifact.url
    if (!rec.artifact_url && typeof artifact.key === 'string') {
      const base = env.R2_PUBLIC_BASE_URL
      if (base) rec.artifact_url = `${base.replace(/\/$/, '')}/${encodeURIComponent(artifact.key)}`
    }
    if (typeof artifact.sha256 === 'string') rec.artifact_sha256 = artifact.sha256
    if (typeof artifact.size_bytes === 'number' && Number.isFinite(artifact.size_bytes)) {
      rec.artifact_size_bytes = Math.max(0, Math.floor(artifact.size_bytes))
    }
    if (artifact.ttl_expires_at) {
      const ttl = typeof artifact.ttl_expires_at === 'number' ? artifact.ttl_expires_at : Date.parse(String(artifact.ttl_expires_at))
      if (Number.isFinite(ttl)) rec.artifact_expires_at = Number(ttl)
    }
  }

  const now = Date.now()
  if (nextStatus === 'running') {
    rec.status = 'running'
  } else {
    rec.status = nextStatus
    rec.done_at = now
    if (nextStatus === 'canceled') rec.canceled_at = rec.canceled_at ?? now
  }

  await saveCastRecord(env, rec)
  if (!env.DATABASE_URL) {
    try {
      await env.KV.put(kvKeyRun(runId, env), castId, { expirationTtl: 60 * 60 * 24 * 120 })
    } catch (e) {
      logEvent('warn', 'run_index_persist_error', { error: String(e) }, trace)
    }
  }

  if (rec.status === 'succeeded' && rec.cost_cents && rec.cost_cents > 0) {
    const chargeEntry: LedgerEntry = {
      id: `led_${crypto.randomUUID()}`,
      tenant_id: rec.tenant_id,
      cast_id: rec.id,
      spell_id: rec.spell_id,
      kind: 'charge',
      cents: rec.cost_cents,
      currency,
      occurred_at: rec.done_at ?? now,
      meta: { source: 'service_runner', message: rec.failure_reason },
      source: 'system',
      reason: 'usage',
    }
    try {
      await appendLedgerEntry(env, chargeEntry, trace)
    } catch (err) {
      logEvent('warn', 'ledger_charge_error', { error: String(err) }, trace)
    }
  }

  if (rec.status === 'succeeded' || rec.status === 'failed' || rec.status === 'canceled') {
    try {
      await appendFinalizeLedgerEntry(env, rec, trace)
    } catch (err) {
      logEvent('warn', 'ledger_finalize_error', { error: String(err) }, trace)
    }
    try {
      await appendAuditSnapshot(env, {
        run_id: rec.run_id,
        cast_id: rec.id,
        spell_id: rec.spell_id,
        tenant_id: rec.tenant_id,
        phase: 'completed',
        status: rec.status,
        cost_cents: rec.cost_cents ?? undefined,
        artifact_sha256: rec.artifact_sha256,
        artifact_size_bytes: rec.artifact_size_bytes,
        occurred_at: new Date((rec.done_at ?? Date.now())).toISOString(),
      }, trace)
    } catch (err) {
      logEvent('warn', 'audit_completion_error', { error: String(err) }, trace)
    }
  }

  return withCORS(env, new Response(null, { status: 204 }))
}

async function handleCastCancel(req: Request, env: Env, castId: string): Promise<Response> {
  if (req.method === 'OPTIONS') return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  if (req.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(req.headers.get('traceparent'))

  let rec: CastRecord | null = null
  if (env.DATABASE_URL) {
    rec = await pollCastRecord(env, castId)
  } else {
    const raw = await env.KV.get(kvKeyCast(castId, env))
    if (raw) rec = JSON.parse(raw) as CastRecord
  }
  if (!rec) {
    const body = { code: 'NOT_FOUND', message: 'Cast not found', request_id: crypto.randomUUID() }
    return withCORS(env, new Response(JSON.stringify(body), { status: 404, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  if (rec.status !== 'queued' && rec.status !== 'running') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }

  let cancelError: { status: number; code: string; message: string } | null = null
  if (rec.mode === 'workflow') {
    const appId = env.GITHUB_APP_ID
    const pem = env.GITHUB_APP_PRIVATE_KEY
    if (!appId || !pem) {
      const err = { code: 'INTERNAL', message: 'GitHub App not configured', request_id: crypto.randomUUID() }
      return withCORS(env, new Response(JSON.stringify(err), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
    try {
      const ownerRepo = 'NishizukaKoichi/Spell'
      const workflowId = 'spell-run.yml'
      const ref = 'main'
      const jwt = await createAppJwt(appId, pem)
      const instId = await getInstallationIdForRepo(jwt, ownerRepo, env.GITHUB_API_BASE)
      const instTok = await createInstallationToken(jwt, instId, undefined, env.GITHUB_API_BASE)
      if (!rec.gh_run_id) {
        try {
          const latest = await getLatestWorkflowRun(instTok, ownerRepo, workflowId, ref, env.GITHUB_API_BASE)
          if (latest?.id) {
            rec.gh_run_id = latest.id
            await saveCastRecord(env, rec)
          }
        } catch (e) {
          logEvent('warn', 'github_latest_run_lookup_failed', { error: String(e) }, trace)
        }
      }
      if (rec.gh_run_id) {
        await cancelWorkflowRun(instTok, ownerRepo, rec.gh_run_id, env.GITHUB_API_BASE)
      }
    } catch (e: any) {
      const status = e?.status || 502
      cancelError = { status, code: 'GITHUB_API_ERROR', message: e?.message || 'Failed to cancel workflow run' }
    }
  } else if (rec.mode === 'service') {
    try {
      await publishToNats(env, `cancel.${rec.run_id}`, {
        run_id: rec.run_id,
        cast_id: rec.id,
        tenant_id: rec.tenant_id,
        reason: 'user_cancel',
      }, trace, { 'Nats-Msg-Id': rec.idempotency_key })
    } catch (e: any) {
      cancelError = { status: 503, code: 'RUNTIME_UNAVAILABLE', message: e?.message || 'Failed to signal runner cancel' }
    }
  }

  if (cancelError) {
    const body = { ...cancelError, request_id: crypto.randomUUID() }
    return withCORS(env, new Response(JSON.stringify(body), { status: cancelError.status, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  const now = Date.now()
  rec.status = 'canceled'
  rec.canceled_at = now
  rec.done_at = now
  rec.failure_reason = 'Canceled by user'
  await saveCastRecord(env, rec)
  try {
    await appendFinalizeLedgerEntry(env, rec, trace)
  } catch (e) {
    logEvent('warn', 'ledger_cancel_finalize_error', { error: String(e) }, trace)
  }

  return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
}

async function signJWT(payload: Record<string, any>, env: Env): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const enc = (obj: any) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj)))).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const iss = env.JWT_ISSUER || ''
  const aud = env.JWT_AUDIENCE || ''
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
  const body = { iss, aud, exp, ...payload }
  const base = `${enc(header)}.${enc(body)}`
  const key = env.SESSION_SECRET || ''
  const sigHex = await hmacSHA256(key, base)
  const sigB64 = btoa(String.fromCharCode(...sigHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${base}.${sigB64}`
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (request.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(request.headers.get('traceparent'))
  const sigHeader = request.headers.get('stripe-signature')
  const parsed = parseStripeSigHeader(sigHeader)
  if (!parsed) return withCORS(env, text('Missing or invalid Stripe-Signature', 400))
  const raw = await request.text()
  const secret = env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    logEvent('error', 'stripe_webhook_secret_missing', {}, trace)
    return withCORS(env, text('Server misconfigured', 500))
  }
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parsed.t) > 300) return withCORS(env, text('Signature timestamp out of tolerance', 400))
  const signedPayload = `${parsed.t}.${raw}`
  const expected = await hmacSHA256(secret, signedPayload)
  if (!timingSafeEqual(expected, parsed.v1)) return withCORS(env, text('Invalid signature', 400))

  let event: any
  try {
    event = JSON.parse(raw)
  } catch (e) {
    logEvent('warn', 'stripe_webhook_parse_error', { error: String(e) }, trace)
    return withCORS(env, text('Invalid JSON', 400))
  }

  try {
    const key = `${env.CAP_KV_PREFIX || 'cap'}:stripe:${event.id || parsed.t}`
    await env.KV.put(key, raw, { expirationTtl: 60 * 60 * 24 })
  } catch (e) {
    logEvent('warn', 'stripe_webhook_kv_error', { error: String(e) }, trace)
  }

  try {
    await processStripeEvent(env, event, trace)
  } catch (err) {
    logEvent('error', 'stripe_event_processing_error', { error: String(err) }, trace)
    return withCORS(env, text('Event processing error', 500))
  }

  return withCORS(env, text('ok', 200))
}

async function processStripeEvent(env: Env, event: any, trace: TraceContext): Promise<void> {
  const type = event?.type
  if (!type) return
  if (type === 'payment_intent.succeeded') {
    const payment = event?.data?.object
    if (!payment || payment.object !== 'payment_intent') {
      throw new Error('payment_intent.succeeded missing payment_intent object')
    }
    const metadata = (payment.metadata || {}) as Record<string, string>
    const tenantId = (metadata.tenant_id || env.DEFAULT_TENANT_ID || 'tenant_default').toString()
    const castId = metadata.cast_id ? metadata.cast_id.toString() : undefined
    const spellId = metadata.spell_id ? metadata.spell_id.toString() : undefined
    const amountRaw = typeof payment.amount_received === 'number' ? payment.amount_received : typeof payment.amount === 'number' ? payment.amount : null
    if (amountRaw === null) throw new Error('payment_intent missing amount')
    const cents = Math.max(0, Math.round(amountRaw))
    const currency = typeof payment.currency === 'string' ? payment.currency.toUpperCase() : 'USD'
    const occurredAt = typeof event?.created === 'number' && Number.isFinite(event.created) ? Math.floor(event.created * 1000) : Date.now()
    const entry: LedgerEntry = {
      id: `led_${crypto.randomUUID()}`,
      tenant_id: tenantId,
      cast_id: castId,
      spell_id: spellId,
      kind: 'charge',
      cents,
      currency,
      occurred_at: occurredAt,
      meta: {
        stripe_event_type: type,
        payment_intent_id: payment.id,
        customer: typeof payment.customer === 'string' ? payment.customer : undefined,
        run_id: metadata.run_id,
        description: payment.description,
        metadata,
      },
      external_id: typeof event.id === 'string' ? event.id : undefined,
      source: 'stripe',
      reason: 'usage',
    }
    await appendLedgerEntry(env, entry, trace)
    recordMetric('stripe.charge.cents', cents, { currency }, trace)
  } else if (type === 'charge.refunded') {
    const charge = event?.data?.object
    if (!charge || charge.object !== 'charge') {
      throw new Error('charge.refunded missing charge object')
    }
    const metadata = (charge.metadata || {}) as Record<string, string>
    const tenantId = (metadata.tenant_id || env.DEFAULT_TENANT_ID || 'tenant_default').toString()
    const castId = metadata.cast_id ? metadata.cast_id.toString() : undefined
    const spellId = metadata.spell_id ? metadata.spell_id.toString() : undefined
    const amountRefundedRaw = typeof charge.amount_refunded === 'number' ? charge.amount_refunded : typeof charge.amount === 'number' ? charge.amount : null
    if (amountRefundedRaw === null) throw new Error('charge.refunded missing amount_refunded')
    const cents = Math.max(0, Math.round(amountRefundedRaw))
    const currency = typeof charge.currency === 'string' ? charge.currency.toUpperCase() : 'USD'
    const occurredAt = typeof event?.created === 'number' && Number.isFinite(event.created) ? Math.floor(event.created * 1000) : Date.now()
    const entry: LedgerEntry = {
      id: `led_${crypto.randomUUID()}`,
      tenant_id: tenantId,
      cast_id: castId,
      spell_id: spellId,
      kind: 'refund',
      cents,
      currency,
      occurred_at: occurredAt,
      meta: {
        stripe_event_type: type,
        charge_id: charge.id,
        payment_intent_id: typeof charge.payment_intent === 'string' ? charge.payment_intent : undefined,
        metadata,
      },
      external_id: typeof event.id === 'string' ? event.id : undefined,
      source: 'stripe',
      reason: 'refund',
    }
    await appendLedgerEntry(env, entry, trace)
    recordMetric('stripe.refund.cents', cents, { currency }, trace)
  } else if (type === 'invoice.payment_failed') {
    const invoice = event?.data?.object
    if (!invoice || invoice.object !== 'invoice') {
      throw new Error('invoice.payment_failed missing invoice object')
    }
    const metadata = (invoice.metadata || {}) as Record<string, string>
    const tenantId = (metadata.tenant_id || env.DEFAULT_TENANT_ID || 'tenant_default').toString()
    const castId = metadata.cast_id ? metadata.cast_id.toString() : undefined
    const spellId = metadata.spell_id ? metadata.spell_id.toString() : undefined
    const amountDueRaw = typeof invoice.amount_due === 'number' ? invoice.amount_due : null
    if (amountDueRaw === null) throw new Error('invoice.payment_failed missing amount_due')
    const cents = Math.max(0, Math.round(amountDueRaw))
    const currency = typeof invoice.currency === 'string' ? invoice.currency.toUpperCase() : 'USD'
    const occurredAt = typeof event?.created === 'number' && Number.isFinite(event.created) ? Math.floor(event.created * 1000) : Date.now()
    const entry: LedgerEntry = {
      id: `led_${crypto.randomUUID()}`,
      tenant_id: tenantId,
      cast_id: castId,
      spell_id: spellId,
      kind: 'credit',
      cents,
      currency,
      occurred_at: occurredAt,
      meta: {
        stripe_event_type: type,
        invoice_id: invoice.id,
        customer: typeof invoice.customer === 'string' ? invoice.customer : undefined,
        metadata,
      },
      external_id: typeof event.id === 'string' ? event.id : undefined,
      source: 'stripe',
      reason: 'credit',
    }
    await appendLedgerEntry(env, entry, trace)
    recordMetric('stripe.invoice.failed.cents', cents, { currency }, trace)
  }
}

async function handleOAuthGithubStart(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const clientId = env.GITHUB_OAUTH_CLIENT_ID
  if (!clientId) return withCORS(env, text('GITHUB_OAUTH_CLIENT_ID not set', 500))
  const state = crypto.randomUUID()
  await env.KV.put(`${env.CAP_KV_PREFIX || 'cap'}:gh_state:${state}`, '1', { expirationTtl: 600 })
  const redirectUri = `${url.origin}/api/oauth/github/callback`
  const authorize = new URL('https://github.com/login/oauth/authorize')
  authorize.searchParams.set('client_id', clientId)
  authorize.searchParams.set('redirect_uri', redirectUri)
  authorize.searchParams.set('scope', 'read:user user:email')
  authorize.searchParams.set('state', state)
  return new Response(null, { status: 302, headers: { Location: authorize.toString(), ...corsHeaders(env) } })
}

async function handleOAuthGithubCallback(req: Request, env: Env): Promise<Response> {
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) return withCORS(env, text('Missing code/state', 400))
  const okState = await env.KV.get(`${env.CAP_KV_PREFIX || 'cap'}:gh_state:${state}`)
  if (!okState) return withCORS(env, text('Invalid state', 400))
  const clientId = env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return withCORS(env, text('GitHub OAuth not configured', 500))
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: `${url.origin}/api/oauth/github/callback` }),
  })
  if (!tokenRes.ok) return withCORS(env, text('OAuth exchange failed', 502))
  const tokenJson = (await tokenRes.json()) as any
  const accessToken = tokenJson.access_token as string
  if (!accessToken) return withCORS(env, text('No access token', 502))
  const userRes = await fetch('https://api.github.com/user', { headers: { Authorization: `token ${accessToken}`, Accept: 'application/vnd.github+json' } })
  if (!userRes.ok) return withCORS(env, text('GitHub user fetch failed', 502))
  const user = (await userRes.json()) as any
  let setCookie = ''
  try {
    if (env.SESSION_SECRET) {
      const jwt = await signJWT({ sub: `github:${user.id}`, name: user.login, iat: Math.floor(Date.now() / 1000) }, env)
      setCookie = `sid=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
    }
  } catch (e) {
    logEvent('warn', 'jwt_sign_error', { error: String(e) }, trace)
  }
  const headers: Record<string, string> = { ...corsHeaders(env) }
  if (setCookie) headers['Set-Cookie'] = setCookie
  return new Response(JSON.stringify({ ok: true, user }), { status: 200, headers: { 'content-type': 'application/json', ...headers } })
}

async function handleArtifact(req: Request, env: Env, pathname: string): Promise<Response> {
  const origin = env.R2_PUBLIC_BASE_URL
  const parts = pathname.split('/').filter(Boolean)
  const idx = parts.indexOf('artifacts')
  const key = parts.slice(idx + 1).join('/')
  if (!key) return withCORS(env, text('Missing key', 400))
  if (req.method === 'PUT') {
    const obj = await env.R2.put(key, req.body)
    const url = origin ? `${origin.replace(/\/$/, '')}/${encodeURIComponent(key)}` : undefined
    return okJSON(env, { ok: true, key, etag: obj?.etag, url })
  }
  if (req.method === 'GET') {
    const obj = await env.R2.get(key)
    if (!obj) return withCORS(env, text('Not Found', 404))
    const headers = new Headers(corsHeaders(env))
    obj.writeHttpMetadata(headers)
    headers.set('etag', obj.httpEtag)
    return new Response(obj.body, { status: 200, headers })
  }
  if (req.method === 'DELETE') {
    await env.R2.delete(key)
    return withCORS(env, text('ok', 200))
  }
  if (req.method === 'OPTIONS') return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  return withCORS(env, text('Method Not Allowed', 405))
}

async function handleGithubWebhook(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (req.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
  const secret = env.GITHUB_APP_WEBHOOK_SECRET
  if (!secret) return withCORS(env, text('Server misconfigured', 500))
  const sig = req.headers.get('x-hub-signature-256')
  if (!sig || !sig.startsWith('sha256=')) return withCORS(env, text('Missing signature', 400))
  const raw = await req.text()
  const digest = await hmacSHA256(secret, raw)
  const expected = `sha256=${digest}`
  if (!timingSafeEqual(expected, sig)) return withCORS(env, text('Invalid signature', 400))
  try {
    const delivery = req.headers.get('x-github-delivery') || `${Date.now()}`
    const key = `${env.CAP_KV_PREFIX || 'cap'}:gh:${delivery}`
    await env.KV.put(key, raw, { expirationTtl: 60 * 60 * 24 })
  } catch (_) {}
  return withCORS(env, text('ok', 200))
}

async function handleArtifactExtendTTL(req: Request, env: Env, runId: string): Promise<Response> {
  if (req.method === 'OPTIONS') return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  if (req.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const token = env.INTERNAL_API_TOKEN
  if (!token) return withCORS(env, text('Server misconfigured', 500))
  const header = req.headers.get('authorization') || ''
  if (!header.startsWith('Bearer ') || header.slice(7) !== token) {
    return withCORS(env, text('Unauthorized', 401))
  }
  let payload: any = {}
  try {
    payload = await req.json()
  } catch (_) {
    return withCORS(env, text('Invalid JSON', 400))
  }
  const daysInput = payload?.days
  let days = Math.round(Number(daysInput))
  if (!Number.isFinite(days) || days <= 0) {
    return withCORS(env, text('days must be positive integer', 400))
  }
  const maxDaysRaw = parseInt(env.ARTIFACT_EXTEND_MAX_DAYS || '30', 10)
  const maxDays = Number.isFinite(maxDaysRaw) && maxDaysRaw > 0 ? maxDaysRaw : 30
  if (days > maxDays) days = maxDays
  let rec: CastRecord | null = null
  if (env.DATABASE_URL) {
    const row = await runQuerySingle<CastRow>(env, 'SELECT * FROM casts WHERE run_id = ? LIMIT 1', [runId])
    if (row) rec = mapCastRow(row)
  } else {
    const castId = await env.KV.get(kvKeyRun(runId, env))
    if (!castId) return withCORS(env, text('Run not found', 404))
    const castKey = kvKeyCast(castId, env)
    const raw = await env.KV.get(castKey)
    if (!raw) return withCORS(env, text('Cast not found', 404))
    rec = JSON.parse(raw) as CastRecord
    if (rec.run_id !== runId) return withCORS(env, text('Run mismatch', 409))
  }
  if (!rec) return withCORS(env, text('Cast not found', 404))
  if (!rec.artifact_url) return withCORS(env, text('No artifact to extend', 400))

  const dayMs = 24 * 60 * 60 * 1000
  const base = typeof rec.artifact_expires_at === 'number' && rec.artifact_expires_at > Date.now() ? rec.artifact_expires_at : Date.now()
  const newExpiresAt = base + days * dayMs
  rec.artifact_expires_at = newExpiresAt
  await saveCastRecord(env, rec)
  if (!env.DATABASE_URL) {
    try {
      await env.KV.put(kvKeyRun(runId, env), rec.id, { expirationTtl: 60 * 60 * 24 * 120 })
    } catch (_) {}
  }

  const costPerDay = parseInt(env.ARTIFACT_EXTEND_COST_CENTS || '0', 10)
  const chargeCents = Number.isFinite(costPerDay) && costPerDay > 0 ? costPerDay * days : 0
  if (chargeCents > 0) {
    const entry: LedgerEntry = {
      id: `led_${crypto.randomUUID()}`,
      tenant_id: rec.tenant_id,
      cast_id: rec.id,
      spell_id: rec.spell_id,
      kind: 'charge',
      cents: chargeCents,
      currency: 'USD',
      occurred_at: Date.now(),
      meta: { action: 'artifact_ttl_extend', days },
      source: 'system',
      reason: 'extension',
    }
    try {
      await appendLedgerEntry(env, entry, trace)
    } catch (err) {
      logEvent('warn', 'ledger_extend_error', { error: String(err) }, trace)
    }
  }

  try {
    await appendAuditSnapshot(env, {
      run_id: rec.run_id,
      cast_id: rec.id,
      spell_id: rec.spell_id,
      tenant_id: rec.tenant_id,
      phase: 'artifact_ttl_extended',
      days,
      artifact_expires_at: new Date(newExpiresAt).toISOString(),
      occurred_at: new Date().toISOString(),
    }, trace)
  } catch (err) {
    logEvent('warn', 'audit_extend_error', { error: String(err) }, trace)
  }

  return okJSON(env, {
    run_id: rec.run_id,
    cast_id: Number(rec.id),
    artifact_expires_at: newExpiresAt,
    extended_days: days,
    charged_cents: chargeCents,
  })
}

async function cleanupExpiredArtifacts(env: Env, trace: TraceContext): Promise<void> {
  const prefix = `${env.CAP_KV_PREFIX || 'cap'}:cast:`
  let cursor: string | undefined
  const limit = 100
  const now = Date.now()
  try {
    while (true) {
      const list = await env.KV.list({ prefix, cursor, limit })
      for (const key of list.keys) {
        try {
          const raw = await env.KV.get(key.name)
          if (!raw) continue
          const rec = JSON.parse(raw) as CastRecord
          if (!rec.artifact_expires_at || rec.artifact_expires_at > now) continue
          if (!rec.run_id) continue
          const r2Key = buildR2Key(rec.run_id)
          try {
            await env.R2.delete(r2Key)
          } catch (e) {
            logEvent('warn', 'artifact_cleanup_delete_error', { error: String(e) }, trace)
          }
          rec.artifact_url = undefined
          rec.artifact_expires_at = undefined
          rec.artifact_size_bytes = undefined
          rec.artifact_sha256 = undefined
          await env.KV.put(key.name, JSON.stringify(rec), { expirationTtl: 60 * 60 })
          try {
            await appendAuditSnapshot(env, {
              run_id: rec.run_id,
              cast_id: rec.id,
              spell_id: rec.spell_id,
              tenant_id: rec.tenant_id,
              phase: 'artifact_deleted',
              occurred_at: new Date().toISOString(),
            }, trace)
          } catch (err) {
            logEvent('warn', 'audit_cleanup_error', { error: String(err) }, trace)
          }
        } catch (e) {
          logEvent('warn', 'artifact_cleanup_error', { error: String(e) }, trace)
        }
      }
      if (list.list_complete || !list.cursor) break
      cursor = list.cursor
    }
  } catch (e) {
    logEvent('warn', 'artifact_cleanup_list_error', { error: String(e) }, trace)
  }
}

const handler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const trace = parseTraceparent(request.headers.get('traceparent'))
    const url = new URL(request.url)
    const pathname = url.pathname

    if (request.method === 'OPTIONS') {
      return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
    }

    if (pathname === '/health' || pathname === '/api/health') {
      return withCORS(env, text('ok', 200))
    }

    if (pathname === '/api/stripe/webhook') {
      return handleStripeWebhook(request, env)
    }

    if (pathname === '/api/oauth/github/start') return handleOAuthGithubStart(request, env)
    if (pathname === '/api/oauth/github/callback') return handleOAuthGithubCallback(request, env)

    if (pathname.startsWith('/api/artifacts/')) {
      return handleArtifact(request, env, pathname)
    }

    if (pathname === '/api/github/webhook') {
      return handleGithubWebhook(request, env)
    }

    if (pathname.startsWith('/api/v1/')) {
      const castMatch = pathname.match(/^\/api\/v1\/spells\/(\d+):cast$/)
      if (castMatch) {
        return handleCastCreate(request, env, castMatch[1])
      }
      const getCast = pathname.match(/^\/api\/v1\/casts\/(\d+)$/)
      if (getCast) {
        return handleCastGet(request, env, getCast[1])
      }
      const cancelCast = pathname.match(/^\/api\/v1\/casts\/(\d+):cancel$/)
      if (cancelCast) {
        return handleCastCancel(request, env, cancelCast[1])
      }
      const verdictCast = pathname.match(/^\/api\/v1\/casts\/(\d+):verdict$/)
      if (verdictCast) {
        return handleCastVerdict(request, env, verdictCast[1])
      }
      const extendArtifact = pathname.match(/^\/api\/v1\/artifacts\/([^:]+):extend_ttl$/)
      if (extendArtifact) {
        return handleArtifactExtendTTL(request, env, extendArtifact[1])
      }
      const sseCast = pathname.match(/^\/api\/v1\/casts\/(\d+)\/events$/)
      if (sseCast) {
        return handleCastEvents(request, env, sseCast[1])
      }
    }

    logEvent('info', 'fallback_response', { pathname }, trace)
    return withCORS(env, text('spell-edge ready', 200))
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const trace = parseTraceparent(undefined)
    await cleanupExpiredArtifacts(env, trace)
  },
}

export default handler
