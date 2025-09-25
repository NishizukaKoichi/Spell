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
  generateRepoFromTemplate,
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
    'Access-Control-Allow-Credentials': 'true',
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

function jsonError(env: Env, status: number, code: string, message: string, details?: Record<string, unknown>) {
  const payload: Record<string, unknown> = {
    code,
    message,
    request_id: crypto.randomUUID(),
  }
  if (details && Object.keys(details).length > 0) {
    payload.details = details
  }
  return withCORS(
    env,
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(env) },
    }),
  )
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

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlEncodeString(input: string): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(input))
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=')
  return atob(padded)
}

function normalizeRepositoryName(name: string): string {
  if (!name) return ''
  const collapsed = name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-_.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+/, '')
    .replace(/[-_.]+$/, '')
  return collapsed
}

type SseEventEntry = {
  id: string
  event: string
  data: Record<string, unknown>
  ts: number
}

const SSE_BUFFER_LIMIT = 100

function kvKeySse(castId: string | number, env: Env) {
  return `${env.CAP_KV_PREFIX || 'cap'}:sse:${castId}`
}

function newSseEventId(): string {
  return `e${Date.now().toString(36)}${randomHex(4)}`
}

async function loadSseEvents(env: Env, castId: string | number, trace?: TraceContext): Promise<SseEventEntry[]> {
  if (!env.KV) return []
  const key = kvKeySse(castId, env)
  try {
    const raw = await env.KV.get(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as SseEventEntry[]
  } catch (e) {
    logEvent('warn', 'sse_event_load_error', { error: String(e), cast_id: castId }, trace)
  }
  return []
}

async function appendSseEvent(
  env: Env,
  castId: string | number,
  event: string,
  data: Record<string, unknown>,
  trace: TraceContext,
): Promise<SseEventEntry | null> {
  if (!env.KV) return null
  const entry: SseEventEntry = { id: newSseEventId(), event, data, ts: Date.now() }
  const key = kvKeySse(castId, env)
  try {
    let existing: SseEventEntry[] = []
    const raw = await env.KV.get(key)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) existing = parsed as SseEventEntry[]
      } catch (parseErr) {
        logEvent('warn', 'sse_event_parse_error', { error: String(parseErr), cast_id: castId }, trace)
      }
    }
    existing.push(entry)
    if (existing.length > SSE_BUFFER_LIMIT) {
      existing = existing.slice(existing.length - SSE_BUFFER_LIMIT)
    }
    await env.KV.put(key, JSON.stringify(existing), { expirationTtl: 60 * 60 * 24 * 14 })
  } catch (err) {
    logEvent('warn', 'sse_event_store_error', { error: String(err), cast_id: castId, event }, trace)
  }
  return entry
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

type TenantCapSettings = {
  monthly_cents?: number
  total_cents?: number
}

function kvKeyTenantCap(tenantId: string, env: Env): string {
  return `${env.CAP_KV_PREFIX || 'cap'}:tenant_cap:${tenantId}`
}

function normalizeCapValue(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN
  if (!Number.isFinite(parsed) || parsed < 0) return undefined
  return Math.round(parsed)
}

async function getTenantCapSettings(env: Env, tenantId: string, trace: TraceContext): Promise<TenantCapSettings> {
  if (!env.KV) return {}
  try {
    const raw = await env.KV.get(kvKeyTenantCap(tenantId, env))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      monthly_cents: normalizeCapValue(parsed.monthly_cents),
      total_cents: normalizeCapValue(parsed.total_cents),
    }
  } catch (e) {
    logEvent('warn', 'tenant_cap_read_error', { error: String(e), tenant_id: tenantId }, trace)
    return {}
  }
}

async function saveTenantCapSettings(env: Env, tenantId: string, caps: TenantCapSettings, trace: TraceContext): Promise<void> {
  if (!env.KV) throw new Error('KV not configured for tenant caps')
  const key = kvKeyTenantCap(tenantId, env)
  const hasValues = caps.monthly_cents !== undefined || caps.total_cents !== undefined
  try {
    if (!hasValues) {
      await env.KV.delete(key)
      return
    }
    const payload = {
      monthly_cents: caps.monthly_cents,
      total_cents: caps.total_cents,
      updated_at: Date.now(),
    }
    await env.KV.put(key, JSON.stringify(payload), { expirationTtl: 60 * 60 * 24 * 365 })
  } catch (e) {
    logEvent('warn', 'tenant_cap_write_error', { error: String(e), tenant_id: tenantId }, trace)
    throw e
  }
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
  if (res.status === 409) {
    return
  }
  if (!res.ok) {
    const textBody = await res.text().catch(() => '')
    throw new Error(`nats publish failed: ${res.status} ${textBody}`)
  }
  try {
    const ack = await res.clone().json()
    if (ack && typeof ack === 'object' && 'error' in ack && ack.error) {
      logEvent('warn', 'nats_publish_ack_error', { subject, error: ack.error }, trace)
    }
  } catch (_) {
    // ignore body parse issues
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

type GithubOAuthTokenRecord = {
  access_token: string
  login?: string | null
  token_type?: string | null
  scope?: string | null
  fetched_at?: number
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
  input_hash: string
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
  spell_name?: string | null
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
    input_hash: row.input_hash || '',
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

async function computeRunSubject(spellId: string | number, inputHash: string): Promise<string> {
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${spellId}:${inputHash}`))
  const hash = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `run.${hash}`
}

type SpellRow = {
  id: number
  tenant_id: number
  spell_key: string
  version: string
  name: string
  summary: string
  description: string | null
  visibility: string
  execution_mode: string
  pricing_json: string | null
  input_schema_json: string | null
  repo_ref: string | null
  workflow_id: string | null
  template_repo: string | null
  status: string
  published_at: string | null
  created_at: string
}

function parsePricing(json: string | null): { model: 'flat' | 'metered' | 'one_time'; currency: string; amount_cents: number } {
  if (!json) return { model: 'flat', currency: 'USD', amount_cents: 0 }
  try {
    const parsed = JSON.parse(json)
    const model = (parsed?.model ?? 'flat') as 'flat' | 'metered' | 'one_time'
    const currency = typeof parsed?.currency === 'string' ? parsed.currency.toUpperCase() : 'USD'
    const amount = typeof parsed?.amount_cents === 'number' ? Math.max(0, Math.round(parsed.amount_cents)) : 0
    return { model, currency, amount_cents: amount }
  } catch (_) {
    return { model: 'flat', currency: 'USD', amount_cents: 0 }
  }
}

function parseInputSchema(json: string | null): Record<string, any> {
  if (!json) return {}
  try {
    const parsed = JSON.parse(json)
    if (parsed && typeof parsed === 'object') return parsed
  } catch (_) {}
  return {}
}

function mapSpellRow(row: SpellRow): SpellRow & { pricing: ReturnType<typeof parsePricing>; inputSchema: Record<string, any> } {
  const pricing = parsePricing(row.pricing_json)
  const inputSchema = parseInputSchema(row.input_schema_json)
  return { ...row, pricing, inputSchema }
}

function spellRowToResponse(row: SpellRow & { pricing: ReturnType<typeof parsePricing>; inputSchema: Record<string, any> }) {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    spell_key: row.spell_key,
    name: row.name,
    summary: row.summary,
    description: row.description ?? undefined,
    visibility: (row.visibility as any) ?? 'private',
    execution_mode: (row.execution_mode as any) ?? 'service',
    pricing_json: row.pricing,
    input_schema_json: row.inputSchema,
    repo_ref: row.repo_ref ?? undefined,
    workflow_id: row.workflow_id ?? undefined,
    template_repo: row.template_repo ?? undefined,
    status: (row.status as any) ?? 'draft',
    published_at: row.published_at ?? undefined,
    created_at: row.created_at,
  }
}

function castRowToSummary(row: CastRow): Record<string, unknown> {
  return {
    id: row.id,
    spell_id: row.spell_id,
    spell_name: row.spell_name ?? undefined,
    run_id: row.run_id,
    status: row.status,
    estimate_cents: row.estimate_cents,
    cost_cents: row.cost_cents,
    created_at: row.created_at,
    finished_at: row.finished_at,
  }
}

type WizardRow = {
  id: number
  name: string
  avatar: string | null
  bio: string | null
  github_username: string | null
  published_spells: number | null
  total_executions: number | null
  success_rate: number | null
  joined_at: string | null
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

function kvKeyGithubToken(sub: string, env: Env) {
  return `${env.CAP_KV_PREFIX || 'cap'}:gh_token:${sub}`
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

type AuthContext = {
  tenantId: string
  tenantNumeric: number
  claims: Record<string, unknown>
  role?: string
}

type RequireAuthOptions = {
  roles?: string[]
}

async function requireAuthContext(
  req: Request,
  env: Env,
  opts: RequireAuthOptions = {},
): Promise<{ ok: true; context: AuthContext } | { ok: false; response: Response }> {
  const cookies = parseCookies(req.headers.get('cookie'))
  const claims = await verifyJWT(cookies['sid'], env)
  if (!claims) {
    return { ok: false, response: jsonError(env, 401, 'UNAUTHORIZED', '認証が必要です') }
  }
  const role = typeof claims.role === 'string' ? claims.role : undefined
  if (opts.roles && opts.roles.length) {
    if (!role || !opts.roles.includes(role)) {
      return {
        ok: false,
        response: jsonError(env, 403, 'FORBIDDEN', '権限がありません', role ? { role } : undefined),
      }
    }
  }
  const tenantValue = claims.tenant_id ?? env.DEFAULT_TENANT_ID
  if (tenantValue === undefined || tenantValue === null || tenantValue === '') {
    return { ok: false, response: jsonError(env, 400, 'TENANT_UNAVAILABLE', 'tenant_id を特定できません') }
  }
  const tenantId = String(tenantValue)
  const tenantNumeric = requiredDbId(tenantId, 0)
  return { ok: true, context: { tenantId, tenantNumeric, claims, role } }
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

type WorkflowConfig = {
  ownerRepo: string
  workflowId: string
  ref: string
}

type RepoRefParts = {
  ownerRepo: string
  ref: string
}

function parseRepoReference(repoRef: string | null | undefined): RepoRefParts | null {
  if (!repoRef) return null
  const trimmed = repoRef.trim()
  if (!trimmed) return null
  const [repoPart, refPart] = trimmed.split('@', 2)
  if (!repoPart || !repoPart.includes('/')) return null
  const ownerRepo = repoPart.trim()
  const ref = refPart && refPart.trim() ? refPart.trim() : 'main'
  return { ownerRepo, ref }
}

async function loadWorkflowConfig(
  env: Env,
  spellId: string | number,
  tenantId: string | number,
  trace?: TraceContext,
): Promise<WorkflowConfig | null> {
  let repoRef: string | null | undefined = null
  let workflowId: string | null | undefined = null
  if (env.DATABASE_URL) {
    try {
      const row = await runQuerySingle<{ repo_ref: string | null; workflow_id: string | null }>(
        env,
        'SELECT repo_ref, workflow_id FROM spells WHERE id = ? AND tenant_id = ? LIMIT 1',
        [requiredDbId(spellId, 0), requiredDbId(tenantId, 0)],
      )
      if (!row) return null
      repoRef = row.repo_ref
      workflowId = row.workflow_id
    } catch (err) {
      logEvent('warn', 'workflow_config_db_error', { error: String(err), spell_id: String(spellId) }, trace)
      return null
    }
  } else {
    try {
      const raw = await env.KV.get(kvKeySpell(String(spellId), env))
      if (!raw) return null
      const parsed = JSON.parse(raw) as { repo_ref?: string; workflow_id?: string; tenant_id?: string | number }
      if (String(parsed.tenant_id ?? '') !== String(tenantId)) return null
      repoRef = parsed.repo_ref
      workflowId = parsed.workflow_id
    } catch (err) {
      logEvent('warn', 'workflow_config_kv_error', { error: String(err), spell_id: String(spellId) }, trace)
      return null
    }
  }
  const base = parseRepoReference(repoRef)
  if (!base) return null
  if (!workflowId || !workflowId.trim()) return null
  return { ownerRepo: base.ownerRepo, ref: base.ref, workflowId: workflowId.trim() }
}

async function getSpellEstimate(env: Env, spellId: string, tenantId: string, trace: TraceContext): Promise<number> {
  if (env.DATABASE_URL) {
    try {
      const row = await runQuerySingle<{ pricing_json?: string | null }>(
        env,
        'SELECT pricing_json FROM spells WHERE id = ? AND tenant_id = ?',
        [requiredDbId(spellId, 0), requiredDbId(tenantId, 0)],
      )
      const estimate = parseEstimateFromPricing(row?.pricing_json)
      if (estimate !== null) return estimate
    } catch (e) {
      logEvent('warn', 'spell_estimate_db_error', { error: String(e), spell_id: spellId, tenant_id: tenantId }, trace)
    }
  } else {
    try {
      const raw = await env.KV.get(kvKeySpell(spellId, env))
      if (raw) {
        const parsed = JSON.parse(raw) as { estimate_cents?: number; tenant_id?: string | number; pricing?: Record<string, unknown> }
        if (String(parsed?.tenant_id ?? '') !== String(tenantId)) return parseInt(env.DEFAULT_SPELL_ESTIMATE_CENTS || '25', 10) || 25
        if (typeof parsed?.estimate_cents === 'number' && Number.isFinite(parsed.estimate_cents)) {
          return Math.max(0, Math.round(parsed.estimate_cents))
        }
        if (parsed?.pricing) {
          try {
            const fallback = parsePricing(JSON.stringify(parsed.pricing))
            if (typeof fallback.amount_cents === 'number') return fallback.amount_cents
          } catch (_) {}
        }
      }
    } catch (e) {
      logEvent('warn', 'spell_estimate_parse_error', { error: String(e), spell_id: spellId, tenant_id: tenantId }, trace)
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

async function getTotalEstimateUsage(env: Env, tenantId: string, trace: TraceContext): Promise<number> {
  if (env.DATABASE_URL) {
    try {
      const row = await runQuerySingle<{ total?: string | number | null }>(
        env,
        'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM billing_ledger WHERE tenant_id = ? AND kind = ?',
        [requiredDbId(tenantId, 0), 'estimate'],
      )
      const total = row?.total
      if (typeof total === 'number') return total
      if (typeof total === 'string') {
        const parsed = parseInt(total, 10)
        if (Number.isFinite(parsed)) return parsed
      }
    } catch (e) {
      logEvent('warn', 'ledger_usage_total_db_error', { error: String(e), tenant_id: tenantId }, trace)
    }
    return 0
  }

  if (!env.KV) return 0
  const prefix = `${env.CAP_KV_PREFIX || 'cap'}:ledger:${tenantId}:`
  let cursor: string | undefined
  let total = 0
  try {
    while (true) {
      const list = await env.KV.list({ prefix, cursor, limit: 100 })
      for (const key of list.keys) {
        try {
          const raw = await env.KV.get(key.name)
          if (!raw) continue
          const lines = raw.split('\n').filter(Boolean)
          for (const line of lines) {
            try {
              const entry = JSON.parse(line) as LedgerEntry
              if (entry.kind === 'estimate' && typeof entry.cents === 'number') total += entry.cents
            } catch (_) {}
          }
        } catch (err) {
          logEvent('warn', 'ledger_usage_total_read_error', { error: String(err), tenant_id: tenantId }, trace)
        }
      }
      if (list.list_complete || !list.cursor) break
      cursor = list.cursor
    }
  } catch (e) {
    logEvent('warn', 'ledger_usage_total_list_error', { error: String(e), tenant_id: tenantId }, trace)
  }
  return total
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

  const auth = await requireAuthContext(req, env, { roles: ['caster', 'maker', 'operator'] })
  if (!auth.ok) return auth.response
  const { tenantId, tenantNumeric, claims } = auth.context

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
  const cloneInput = mode === 'clone' && json && typeof json === 'object' ? (json.input ?? {}) : {}

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
  const estimateCents = await getSpellEstimate(env, spellId, tenantId, trace)
  const usageCents = await getMonthlyEstimateUsage(env, tenantId, now, trace)
  const capSettings = await getTenantCapSettings(env, tenantId, trace)
  const defaultCapRaw = parseInt(env.DEFAULT_TENANT_CAP_CENTS || '1000', 10)
  const monthlyCap = capSettings.monthly_cents ?? (Number.isFinite(defaultCapRaw) && defaultCapRaw >= 0 ? defaultCapRaw : null)

  if (monthlyCap !== null && usageCents + estimateCents > monthlyCap) {
    const body = {
      code: 'BUDGET_CAP_EXCEEDED',
      message: '見積費用が上限を超過しました',
      details: { estimate_cents: estimateCents, cap_cents: monthlyCap, usage_cents: usageCents, scope: 'monthly' },
      request_id: crypto.randomUUID(),
    }
    recordMetric('cast.cap.denied', 1, { tenant_id: tenantId, reason: 'monthly_cap' }, trace)
    return withCORS(env, new Response(JSON.stringify(body), { status: 402, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  if (capSettings.total_cents !== undefined) {
    const totalUsage = await getTotalEstimateUsage(env, tenantId, trace)
    if (totalUsage + estimateCents > capSettings.total_cents) {
      const body = {
        code: 'BUDGET_CAP_EXCEEDED',
        message: '見積費用が上限を超過しました',
        details: { estimate_cents: estimateCents, cap_cents: capSettings.total_cents, usage_cents: totalUsage, scope: 'lifetime' },
        request_id: crypto.randomUUID(),
      }
      recordMetric('cast.cap.denied', 1, { tenant_id: tenantId, reason: 'lifetime_cap' }, trace)
      return withCORS(env, new Response(JSON.stringify(body), { status: 402, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
  }

  const budgetCapRaw = json?.budget_cap_cents
  const budgetCapCents = typeof budgetCapRaw === 'number' && Number.isFinite(budgetCapRaw) && budgetCapRaw >= 0 ? Math.round(budgetCapRaw) : undefined

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
  let templateRepo: string | undefined

  if (env.DATABASE_URL) {
    const spellNumeric = requiredDbId(spellId, 0)
    if (!spellNumeric) {
      return withCORS(env, new Response(JSON.stringify({ code: 'SPELL_NOT_FOUND', message: 'Spell not found' }), { status: 404, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
    try {
      const spellRow = await runQuerySingle<{
        id: number
        tenant_id: number
        template_repo: string | null
        repo_ref: string | null
        workflow_id: string | null
      }>(
        env,
        'SELECT id, tenant_id, template_repo, repo_ref, workflow_id FROM spells WHERE id = ? AND tenant_id = ? LIMIT 1',
        [spellNumeric, tenantNumeric],
      )
      if (!spellRow) {
        return withCORS(env, new Response(JSON.stringify({ code: 'SPELL_NOT_FOUND', message: 'Spell not found' }), { status: 404, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
      }
      templateRepo = spellRow.template_repo ?? undefined

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
        'SELECT * FROM casts WHERE id = ? AND tenant_id = ? LIMIT 1',
        [parseInt(String(insertedId), 10), tenantNumeric],
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
      input_hash: inputHash,
    }
    try {
      const rawSpell = await env.KV.get(kvKeySpell(spellId, env))
      if (rawSpell) {
        const parsedSpell = JSON.parse(rawSpell) as { template_repo?: string }
        if (parsedSpell?.template_repo && !templateRepo) templateRepo = parsedSpell.template_repo
      }
    } catch (e) {
      logEvent('warn', 'kv_spell_parse_error', { error: String(e) }, trace)
    }
  }

  const castDbId = optionalDbId(cast.id)

  if (mode === 'workflow') {
    const workflowCfg = await loadWorkflowConfig(env, cast.spell_id, cast.tenant_id, trace)
    if (!workflowCfg) {
      if (env.DATABASE_URL && castDbId !== null) {
        await getDatabase(env).execute('DELETE FROM casts WHERE id = ?', [castDbId])
      }
      const body = { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow configuration is missing', request_id: crypto.randomUUID() }
      return withCORS(env, new Response(JSON.stringify(body), { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
    const { ownerRepo, ref, workflowId: workflowFile } = workflowCfg
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
      await dispatchWorkflow(instTok, ownerRepo, workflowFile, ref, { run_id: runId, spell_id: spellId, input: inputPayload }, env.GITHUB_API_BASE)
      try {
        const latest = await getLatestWorkflowRun(instTok, ownerRepo, workflowFile, ref, env.GITHUB_API_BASE)
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
      const runSubject = await computeRunSubject(cast.spell_id, cast.input_hash)
      await publishToNats(env, runSubject, {
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
  } else if (mode === 'clone') {
    if (!templateRepo) {
      const body = { code: 'CLONE_UNAVAILABLE', message: 'Spell template repository is not configured', request_id: crypto.randomUUID() }
      return withCORS(env, new Response(JSON.stringify(body), { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
    const subject = typeof claims?.sub === 'string' ? claims.sub : null
    if (!subject) {
      const body = { code: 'GITHUB_OAUTH_REQUIRED', message: 'GitHub OAuth session required for clone mode', request_id: crypto.randomUUID() }
      return withCORS(env, new Response(JSON.stringify(body), { status: 401, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
    let tokenRecord: GithubOAuthTokenRecord | null = null
    try {
      const rawToken = await env.KV.get(kvKeyGithubToken(subject, env))
      if (rawToken) tokenRecord = JSON.parse(rawToken) as GithubOAuthTokenRecord
    } catch (e) {
      logEvent('warn', 'github_token_fetch_error', { error: String(e) }, trace)
    }
    if (!tokenRecord?.access_token) {
      const body = { code: 'GITHUB_OAUTH_REQUIRED', message: 'GitHub OAuth grant has expired; please reconnect', request_id: crypto.randomUUID() }
      return withCORS(env, new Response(JSON.stringify(body), { status: 401, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }

    cast.status = 'running'
    await saveCastRecord(env, cast)
    try {
      await appendSseEvent(env, cast.id, 'progress', { stage: 'running', message: 'clone_start' }, trace)
    } catch (e) {
      logEvent('warn', 'clone_sse_running_error', { error: String(e) }, trace)
    }

    const ownerInput = typeof cloneInput?.owner === 'string' ? cloneInput.owner : undefined
    const repoInput = typeof cloneInput?.repo === 'string' ? cloneInput.repo : typeof cloneInput?.repo_name === 'string' ? cloneInput.repo_name : undefined
    const visibilityInput = typeof cloneInput?.visibility === 'string' ? cloneInput.visibility.toLowerCase() : undefined
    const includeAllBranches = Boolean(cloneInput?.include_all_branches)
    const description = typeof cloneInput?.description === 'string' ? cloneInput.description : undefined

    const defaultOwner = tokenRecord.login || subject.replace(/^github:/, '')
    const owner = ownerInput && ownerInput.trim() ? ownerInput.trim() : defaultOwner
    if (!owner) {
      const body = { code: 'CLONE_OWNER_REQUIRED', message: 'Unable to resolve target owner for template clone', request_id: crypto.randomUUID() }
      return withCORS(env, new Response(JSON.stringify(body), { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }

    let repoName = repoInput && typeof repoInput === 'string' ? repoInput : `spell-${cast.spell_id}-${cast.id}`
    repoName = normalizeRepositoryName(repoName)
    if (!repoName) repoName = `spell-${randomHex(4)}`
    const isPrivate = visibilityInput === 'public' ? false : true

    try {
      const cloneResult = await generateRepoFromTemplate(tokenRecord.access_token, templateRepo, {
        owner,
        name: repoName,
        private: isPrivate,
        description,
        include_all_branches: includeAllBranches,
      })

      cast.status = 'succeeded'
      cast.cost_cents = cast.estimate_cents
      cast.done_at = Date.now()
      cast.logs_url = (cloneResult?.html_url as string | undefined) || (cloneResult?.full_name ? `https://github.com/${cloneResult.full_name}` : undefined)
      cast.failure_reason = undefined
      await saveCastRecord(env, cast)
      try {
        await appendSseEvent(
          env,
          cast.id,
          'completed',
          { status: 'succeeded', cost_cents: cast.cost_cents ?? undefined, repo: cloneResult?.full_name || `${owner}/${repoName}` },
          trace,
        )
      } catch (e) {
        logEvent('warn', 'clone_sse_completed_error', { error: String(e) }, trace)
      }

      if (cast.cost_cents && cast.cost_cents > 0) {
        const chargeEntry: LedgerEntry = {
          id: `led_${crypto.randomUUID()}`,
          tenant_id: cast.tenant_id,
          cast_id: cast.id,
          spell_id: cast.spell_id,
          kind: 'charge',
          cents: cast.cost_cents,
          currency: 'USD',
          occurred_at: cast.done_at ?? Date.now(),
          meta: { source: 'clone', repo: cloneResult?.full_name || `${owner}/${repoName}` },
          source: 'system',
          reason: 'usage',
        }
        try {
          await appendLedgerEntry(env, chargeEntry, trace)
        } catch (err) {
          logEvent('warn', 'clone_charge_ledger_error', { error: String(err) }, trace)
        }
      }

      try {
        await appendFinalizeLedgerEntry(env, cast, trace)
      } catch (err) {
        logEvent('warn', 'clone_finalize_ledger_error', { error: String(err) }, trace)
      }

      try {
        await appendAuditSnapshot(
          env,
          {
            run_id: cast.run_id,
            cast_id: cast.id,
            spell_id: cast.spell_id,
            tenant_id: cast.tenant_id,
            phase: 'clone_completed',
            repo_full_name: cloneResult?.full_name || `${owner}/${repoName}`,
            occurred_at: new Date(cast.done_at ?? Date.now()).toISOString(),
          },
          trace,
        )
      } catch (err) {
        logEvent('warn', 'clone_audit_error', { error: String(err) }, trace)
      }
    } catch (err: any) {
      const status = err instanceof GithubApiError ? err.status : 500
      const message = err instanceof Error ? err.message : 'Clone failed'
      cast.status = 'failed'
      cast.failure_reason = message
      cast.done_at = Date.now()
      await saveCastRecord(env, cast)
      try {
        await appendSseEvent(env, cast.id, 'failed', { status: 'failed', reason: message }, trace)
      } catch (e) {
        logEvent('warn', 'clone_sse_failed_error', { error: String(e) }, trace)
      }
      try {
        await appendFinalizeLedgerEntry(env, cast, trace)
      } catch (finalizeErr) {
        logEvent('warn', 'clone_finalize_error', { error: String(finalizeErr) }, trace)
      }
      try {
        await appendAuditSnapshot(
          env,
          {
            run_id: cast.run_id,
            cast_id: cast.id,
            spell_id: cast.spell_id,
            tenant_id: cast.tenant_id,
            phase: 'clone_failed',
            error: message,
            occurred_at: new Date().toISOString(),
          },
          trace,
        )
      } catch (auditErr) {
        logEvent('warn', 'clone_audit_failed_error', { error: String(auditErr) }, trace)
      }
      const body = {
        code: 'CLONE_FAILED',
        message: 'Failed to generate repository from template',
        details: { reason: message },
        request_id: crypto.randomUUID(),
      }
      return withCORS(env, new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
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
    await appendSseEvent(env, cast.id, 'progress', { stage: cast.status, message: cast.status }, trace)
  } catch (e) {
    logEvent('warn', 'sse_event_init_error', { error: String(e) }, trace)
  }

  try {
    await appendEstimateLedgerEntry(env, cast, trace)
  } catch (e) {
    logEvent('warn', 'ledger_estimate_error', { error: String(e) }, trace)
  }

  return okJSON(env, buildCastResponse(cast))
}

async function handleCastGet(req: Request, env: Env, castId: string): Promise<Response> {
  const auth = await requireAuthContext(req, env, { roles: ['caster', 'maker', 'operator', 'auditor'] })
  if (!auth.ok) return auth.response
  const { tenantNumeric } = auth.context
  if (env.DATABASE_URL) {
    const row = await runQuerySingle<CastRow>(
      env,
      'SELECT * FROM casts WHERE id = ? AND tenant_id = ? LIMIT 1',
      [requiredDbId(castId, 0), tenantNumeric],
    )
    if (!row) return withCORS(env, text('Not Found', 404))
    return okJSON(env, buildCastDetail(mapCastRow(row)))
  }

  const raw = await env.KV.get(kvKeyCast(castId, env))
  if (!raw) return withCORS(env, text('Not Found', 404))
  const rec = JSON.parse(raw) as CastRecord
  if (String(rec.tenant_id) !== String(tenantId)) return withCORS(env, text('Not Found', 404))
  return okJSON(env, buildCastDetail(rec))
}

async function pollCastRecord(env: Env, castId: string, tenantId: string | number): Promise<CastRecord | null> {
  if (env.DATABASE_URL) {
    const row = await runQuerySingle<CastRow>(
      env,
      'SELECT * FROM casts WHERE id = ? AND tenant_id = ? LIMIT 1',
      [requiredDbId(castId, 0), requiredDbId(tenantId, 0)],
    )
    return row ? mapCastRow(row) : null
  }
  try {
    const raw = await env.KV.get(kvKeyCast(castId, env))
    if (!raw) return null
    const parsed = JSON.parse(raw) as CastRecord
    if (String(parsed.tenant_id) !== String(tenantId)) return null
    return parsed
  } catch (_) {
    return null
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function handleCastEvents(req: Request, env: Env, castId: string): Promise<Response> {
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const auth = await requireAuthContext(req, env, { roles: ['caster', 'maker', 'operator', 'auditor'] })
  if (!auth.ok) return auth.response
  const { tenantId } = auth.context
  const headers = new Headers({
    'content-type': 'text/event-stream; charset=utf-8',
    connection: 'keep-alive',
    'cache-control': 'no-cache',
    ...corsHeaders(env),
  })
  const lastEventIdHeader = req.headers.get('Last-Event-ID') || req.headers.get('last-event-id') || undefined
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder()
      const isTerminal = (status: string | undefined) => status === 'succeeded' || status === 'failed' || status === 'canceled'

      let rec = await pollCastRecord(env, castId, tenantId)
      if (!rec) {
        const chunk = `event: error
data: ${JSON.stringify({ message: 'cast not found' })}

`
        controller.enqueue(enc.encode(chunk))
        controller.close()
        return
      }

      let lastDeliveredEventId: string | null = null

      const sendEntry = (entry: SseEventEntry) => {
        let chunk = ''
        chunk += `id: ${entry.id}
`
        if (entry.event) chunk += `event: ${entry.event}
`
        chunk += `data: ${JSON.stringify(entry.data)}

`
        controller.enqueue(enc.encode(chunk))
        lastDeliveredEventId = entry.id
      }

      const sendHeartbeat = () => {
        const chunk = `event: heartbeat
data: ${JSON.stringify({ now: new Date().toISOString() })}

`
        controller.enqueue(enc.encode(chunk))
      }

      let stored = await loadSseEvents(env, castId, trace)
      if (!stored.length) {
        const seed = await appendSseEvent(env, castId, 'progress', { stage: rec.status || 'queued', message: rec.status || 'queued' }, trace)
        if (seed) stored = [seed]
      }

      const replayStart = lastEventIdHeader ? stored.findIndex((entry) => entry.id === lastEventIdHeader) : -1
      const replay = replayStart >= 0 ? stored.slice(replayStart + 1) : stored
      for (const entry of replay) sendEntry(entry)

      if (!lastDeliveredEventId && stored.length) {
        lastDeliveredEventId = stored[stored.length - 1].id
      }

      const deliverNewEvents = async () => {
        const events = await loadSseEvents(env, castId, trace)
        if (!events.length) return
        let startIndex = -1
        if (lastDeliveredEventId) {
          startIndex = events.findIndex((entry) => entry.id === lastDeliveredEventId)
        }
        const pending = startIndex >= 0 ? events.slice(startIndex + 1) : events
        for (const entry of pending) sendEntry(entry)
      }

      if (isTerminal(rec.status)) {
        controller.close()
        return
      }

      sendHeartbeat()

      if (rec.mode === 'service') {
        for (let i = 0; i < 300; i++) {
          await sleep(2000)
          const next = await pollCastRecord(env, castId, tenantId)
          if (!next) break
          rec = next
          await deliverNewEvents()
          if (isTerminal(rec.status)) break
          sendHeartbeat()
        }
        await deliverNewEvents()
        controller.close()
        return
      }

      const appId = env.GITHUB_APP_ID
      const pem = env.GITHUB_APP_PRIVATE_KEY
      const workflowCfg = await loadWorkflowConfig(env, rec.spell_id, rec.tenant_id, trace)
      if (!workflowCfg) {
        await deliverNewEvents()
        controller.close()
        return
      }
      const { ownerRepo, workflowId, ref } = workflowCfg
      if (!appId || !pem) {
        await deliverNewEvents()
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
            await deliverNewEvents()
            if (isTerminal(rec.status)) break
            sendHeartbeat()
            continue
          }

          const run = await getWorkflowRun(instTok, ownerRepo, rec.gh_run_id, env.GITHUB_API_BASE)
          const st = (run.status as string) || ''
          const concl = (run.conclusion as string | null) || null

          if (st === 'queued' && rec.status !== 'queued') {
            rec.status = 'queued'
            await saveCastRecord(env, rec)
            await appendSseEvent(env, rec.id, 'progress', { stage: 'queued', message: 'queued' }, trace)
          } else if (st === 'in_progress' && rec.status !== 'running') {
            rec.status = 'running'
            await saveCastRecord(env, rec)
            await appendSseEvent(env, rec.id, 'progress', { stage: 'running', message: 'in_progress' }, trace)
          } else if (st === 'completed') {
            const prevArtifact = rec.artifact_sha256
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
                }
              }
            } catch (artifactErr) {
              logEvent('warn', 'artifact_fetch_error', { error: String(artifactErr) }, trace)
            }

            rec.status = concl === 'success' ? 'succeeded' : 'failed'
            rec.done_at = Date.now()
            await saveCastRecord(env, rec)

            if (rec.artifact_sha256 && rec.artifact_sha256 !== prevArtifact && rec.artifact_url) {
              await appendSseEvent(
                env,
                rec.id,
                'artifact_ready',
                {
                  url: rec.artifact_url,
                  sha256: rec.artifact_sha256,
                  ttl_expires_at: rec.artifact_expires_at,
                  size_bytes: rec.artifact_size_bytes,
                },
                trace,
              )
            }

            if (rec.status === 'succeeded') {
              await appendSseEvent(env, rec.id, 'completed', { status: 'succeeded' }, trace)
            } else {
              await appendSseEvent(env, rec.id, 'failed', { status: 'failed' }, trace)
            }

            await deliverNewEvents()
            break
          }

          await deliverNewEvents()
          if (isTerminal(rec.status)) break
          sendHeartbeat()
        }
      } catch (err) {
        logEvent('error', 'workflow_sse_error', { error: String(err) }, trace)
      }

      await deliverNewEvents()
      controller.close()
    },
  })

  return withCORS(env, new Response(stream, { status: 200, headers }))
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
  const tenantRaw = payload?.tenant_id
  if (typeof runId !== 'string' || !runId) return withCORS(env, text('run_id required', 400))
  if (typeof statusInput !== 'string' || !statusInput) return withCORS(env, text('status required', 400))
  if ((tenantRaw === undefined || tenantRaw === null || tenantRaw === '') && tenantRaw !== 0) {
    return withCORS(env, text('tenant_id required', 400))
  }
  const tenantId = typeof tenantRaw === 'number' || typeof tenantRaw === 'string' ? tenantRaw : null
  if (tenantId === null) return withCORS(env, text('tenant_id invalid', 400))

  const rec = await pollCastRecord(env, castId, tenantId)
  if (!rec) return withCORS(env, text('Not Found', 404))
  if (String(rec.tenant_id) !== String(tenantId)) return withCORS(env, text('Forbidden', 403))
  if (rec.run_id !== runId) return withCORS(env, text('run mismatch', 409))
  if (payload?.spell_id && String(payload.spell_id) !== String(rec.spell_id)) {
    return withCORS(env, text('spell mismatch', 409))
  }

  const prevStatus = rec.status
  const prevArtifactSha = rec.artifact_sha256
  const prevCost = rec.cost_cents ?? null

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

  if (rec.artifact_sha256 && rec.artifact_sha256 !== prevArtifactSha && rec.artifact_url) {
    try {
      await appendSseEvent(
        env,
        rec.id,
        'artifact_ready',
        {
          url: rec.artifact_url,
          sha256: rec.artifact_sha256,
          ttl_expires_at: rec.artifact_expires_at,
          size_bytes: rec.artifact_size_bytes,
        },
        trace,
      )
    } catch (e) {
      logEvent('warn', 'sse_event_artifact_error', { error: String(e), cast_id: rec.id }, trace)
    }
  }

  const statusChanged = prevStatus !== rec.status
  const costChanged = rec.status === 'succeeded' && prevCost !== rec.cost_cents
  if (statusChanged || costChanged) {
    try {
      if (rec.status === 'running') {
        await appendSseEvent(env, rec.id, 'progress', { stage: 'running', message: 'in_progress' }, trace)
      } else if (rec.status === 'succeeded') {
        await appendSseEvent(
          env,
          rec.id,
          'completed',
          {
            status: 'succeeded',
            cost_cents: rec.cost_cents ?? undefined,
            p95_ms: rec.p95_ms ?? undefined,
            error_rate: rec.error_rate ?? undefined,
          },
          trace,
        )
      } else if (rec.status === 'failed') {
        await appendSseEvent(env, rec.id, 'failed', { status: 'failed', reason: rec.failure_reason ?? 'failed' }, trace)
      } else if (rec.status === 'canceled') {
        await appendSseEvent(env, rec.id, 'canceled', { status: 'canceled', by: 'system' }, trace)
      }
    } catch (e) {
      logEvent('warn', 'sse_event_status_error', { error: String(e), cast_id: rec.id, status: rec.status }, trace)
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
  const auth = await requireAuthContext(req, env, { roles: ['caster', 'operator'] })
  if (!auth.ok) return auth.response
  const { tenantId } = auth.context

  const rec = await pollCastRecord(env, castId, tenantId)
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
      const workflowCfg = await loadWorkflowConfig(env, rec.spell_id, rec.tenant_id, trace)
      if (!workflowCfg) {
        const err = { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow configuration is missing', request_id: crypto.randomUUID() }
        return withCORS(env, new Response(JSON.stringify(err), { status: 400, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
      }
      const { ownerRepo, workflowId, ref } = workflowCfg
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
    await appendSseEvent(env, rec.id, 'canceled', { status: 'canceled', by: 'user' }, trace)
  } catch (e) {
    logEvent('warn', 'sse_event_cancel_error', { error: String(e), cast_id: rec.id }, trace)
  }
  try {
    await appendFinalizeLedgerEntry(env, rec, trace)
  } catch (e) {
    logEvent('warn', 'ledger_cancel_finalize_error', { error: String(e) }, trace)
  }

  return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
}


async function signJWT(payload: Record<string, any>, env: Env): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' }
  const iss = env.JWT_ISSUER || ''
  const aud = env.JWT_AUDIENCE || ''
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
  const body = { iss, aud, exp, ...payload }
  const base = `${base64UrlEncodeString(JSON.stringify(header))}.${base64UrlEncodeString(JSON.stringify(body))}`
  const key = env.SESSION_SECRET || ''
  const sigHex = await hmacSHA256(key, base)
  const sigB64 = base64UrlEncodeBytes(new Uint8Array(sigHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))))
  return `${base}.${sigB64}`
}

async function verifyJWT(token: string | null | undefined, env: Env): Promise<Record<string, any> | null> {
  if (!token || !env.SESSION_SECRET) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerPart, payloadPart, signaturePart] = parts
  const expectedHex = await hmacSHA256(env.SESSION_SECRET, `${headerPart}.${payloadPart}`)
  const expectedSig = base64UrlEncodeBytes(new Uint8Array(expectedHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))))
  if (!timingSafeEqual(expectedSig, signaturePart)) return null
  try {
    const payloadJson = base64UrlDecode(payloadPart)
    const payload = JSON.parse(payloadJson) as Record<string, any>
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null
    return payload
  } catch (_) {
    return null
  }
}

function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  const parts = header.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    const value = trimmed.slice(eq + 1)
    out[key] = decodeURIComponent(value)
  }
  return out
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
  const sub = `github:${user.id}`
  const tenantId = (env.DEFAULT_TENANT_ID || '1').toString()
  try {
    if (env.SESSION_SECRET) {
      const jwt = await signJWT(
        {
          sub,
          name: user.login,
          iat: Math.floor(Date.now() / 1000),
          tenant_id: tenantId,
          role: 'caster',
        },
        env,
      )
      setCookie = `sid=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
    }
  } catch (e) {
    logEvent('warn', 'jwt_sign_error', { error: String(e) }, trace)
  }
  try {
    const ttlSeconds = 60 * 60
    const tokenRecord = {
      access_token: accessToken,
      token_type: tokenJson.token_type || 'bearer',
      scope: tokenJson.scope || 'repo',
      login: user.login,
      fetched_at: Date.now(),
    }
    await env.KV.put(kvKeyGithubToken(sub, env), JSON.stringify(tokenRecord), { expirationTtl: ttlSeconds })
  } catch (e) {
    logEvent('warn', 'github_token_store_error', { error: String(e) }, trace)
  }
  const headers: Record<string, string> = { ...corsHeaders(env) }
  if (setCookie) headers['Set-Cookie'] = setCookie
  return new Response(JSON.stringify({ ok: true, user }), { status: 200, headers: { 'content-type': 'application/json', ...headers } })
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (request.method !== 'GET') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(request.headers.get('traceparent'))
  const cookies = parseCookies(request.headers.get('cookie'))
  const claims = await verifyJWT(cookies['sid'], env)
  const headers = { ...corsHeaders(env), 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8' }
  if (!claims) {
    return withCORS(env, new Response(JSON.stringify({ authenticated: false }), { status: 401, headers }))
  }
  logEvent('info', 'session_resolved', { sub: claims.sub }, trace)
  return withCORS(env, new Response(JSON.stringify({ authenticated: true, user: { sub: claims.sub, name: claims.name } }), { status: 200, headers }))
}

function buildLogoutCookie(): string {
  return 'sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (request.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
  const headers = { ...corsHeaders(env), 'Set-Cookie': buildLogoutCookie() }
  return withCORS(env, new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...headers, 'content-type': 'application/json; charset=utf-8' } }))
}


async function handleSpellsList(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (req.method !== 'GET') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const auth = await requireAuthContext(req, env, { roles: ['maker', 'caster', 'operator', 'auditor'] })
  if (!auth.ok) return auth.response
  const { tenantId, tenantNumeric } = auth.context
  const url = new URL(req.url)
  const search = url.searchParams.get('query')?.trim()
  const visibility = url.searchParams.get('visibility')?.trim()
  const limitParam = parseInt(url.searchParams.get('limit') || '20', 10)
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20

  let items: any[] = []
  if (env.DATABASE_URL) {
    try {
      const where: string[] = ['tenant_id = ?']
      const params: Array<string | number> = [tenantNumeric]
      if (visibility) {
        where.push('visibility = ?')
        params.push(visibility)
      }
      if (search) {
        where.push('(name LIKE ? OR summary LIKE ? OR spell_key LIKE ?)')
        const q = `%${search}%`
        params.push(q, q, q)
      }
      const sql = `SELECT id, tenant_id, spell_key, version, name, summary, description, visibility, execution_mode, pricing_json, input_schema_json, repo_ref, workflow_id, template_repo, status, published_at, created_at
        FROM spells
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY (published_at IS NULL), published_at DESC, id DESC
        LIMIT ?`
      params.push(limit)
      const rows = await runQuery<SpellRow>(env, sql, params)
      items = rows.map((row) => spellRowToResponse(mapSpellRow(row)))
    } catch (err) {
      logEvent('warn', 'spells_list_db_error', { error: String(err) }, trace)
    }
  }

  if (!env.DATABASE_URL && env.KV) {
    try {
      const prefix = `${env.CAP_KV_PREFIX || 'cap'}:spell:`
      const list = await env.KV.list({ prefix, limit: 100 })
      for (const key of list.keys) {
        try {
          const raw = await env.KV.get(key.name)
          if (!raw) continue
          const parsed = JSON.parse(raw)
          if (String(parsed.tenant_id) !== String(tenantId)) continue
          items.push({
            id: parsed.id,
            tenant_id: parsed.tenant_id,
            spell_key: parsed.spell_key,
            version: parsed.version,
            name: parsed.name,
            summary: parsed.summary,
            description: parsed.description,
            visibility: parsed.visibility,
            execution_mode: parsed.execution_mode,
            pricing_json: parsed.pricing ?? {},
            input_schema_json: parsed.input_schema ?? {},
            repo_ref: parsed.repo_ref,
            workflow_id: parsed.workflow_id,
            template_repo: parsed.template_repo,
            status: parsed.status,
            published_at: parsed.published_at,
            created_at: parsed.created_at,
          })
        } catch (err) {
          logEvent('warn', 'spells_kv_parse_error', { error: String(err), key: key.name }, trace)
        }
      }
    } catch (err) {
      logEvent('warn', 'spells_kv_list_error', { error: String(err) }, trace)
    }
  }

  return okJSON(env, { items })
}

async function handleSpellsCreate(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (req.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const auth = await requireAuthContext(req, env, { roles: ['maker', 'operator'] })
  if (!auth.ok) return auth.response
  const { tenantId, tenantNumeric } = auth.context

  let payload: any = {}
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      payload = await req.json()
    }
  } catch (_) {}

  const spellKey = typeof payload?.spell_key === 'string' ? payload.spell_key.trim() : ''
  const name = typeof payload?.name === 'string' ? payload.name.trim() : ''
  const summary = typeof payload?.summary === 'string' ? payload.summary.trim() : ''
  if (!spellKey || !name || !summary) {
    const body = { code: 'VALIDATION_ERROR', message: 'spell_key, name, and summary are required', request_id: crypto.randomUUID() }
    return withCORS(env, new Response(JSON.stringify(body), { status: 422, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  const version = typeof payload?.version === 'string' ? payload.version.trim() : 'v1'
  const description = typeof payload?.description === 'string' ? payload.description : null
  const visibility = typeof payload?.visibility === 'string' ? payload.visibility : 'private'
  const executionMode = typeof payload?.execution_mode === 'string' ? payload.execution_mode : 'service'
  const pricing = payload?.pricing ?? {}
  const inputSchema = payload?.input_schema ?? {}
  const repoRef = typeof payload?.repo_ref === 'string' ? payload.repo_ref : null
  const workflowId = typeof payload?.workflow_id === 'string' ? payload.workflow_id : null
  const templateRepo = typeof payload?.template_repo === 'string' ? payload.template_repo : null
  const status = typeof payload?.status === 'string' ? payload.status : 'draft'

  if (!env.DATABASE_URL) {
    const id = Date.now()
    const record = {
      id,
      tenant_id: tenantId,
      spell_key: spellKey,
      version,
      name,
      summary,
      description,
      visibility,
      execution_mode: executionMode,
      pricing,
      input_schema: inputSchema,
      repo_ref: repoRef,
      workflow_id: workflowId,
      template_repo: templateRepo,
      status,
      published_at: null,
      created_at: new Date().toISOString(),
    }
    if (!env.KV) {
      return withCORS(env, text('Server misconfigured', 500))
    }
    await env.KV.put(kvKeySpell(String(id), env), JSON.stringify(record))
    return withCORS(env, new Response(JSON.stringify({ id }), { status: 201, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  try {
    const spellRow = await runQuerySingle<{ id: number }>(
      env,
      'SELECT id FROM spells WHERE tenant_id = ? AND spell_key = ? AND version = ? LIMIT 1',
      [tenantNumeric, spellKey, version],
    )
    if (spellRow) {
      const body = { code: 'VALIDATION_ERROR', message: 'Spell key and version already exist', request_id: crypto.randomUUID() }
      return withCORS(env, new Response(JSON.stringify(body), { status: 409, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
    }
  } catch (err) {
    logEvent('warn', 'spell_unique_check_failed', { error: String(err) }, trace)
  }

  const conn = getDatabase(env)
  let insertId = 0
  try {
    const result = await conn.execute(
      `INSERT INTO spells (tenant_id, spell_key, version, name, summary, description, visibility, execution_mode, pricing_json, input_schema_json, repo_ref, workflow_id, template_repo, status, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'published' THEN NOW() ELSE NULL END, NOW())`,
      [
        tenantNumeric,
        spellKey,
        version,
        name,
        summary,
        description,
        visibility,
        executionMode,
        JSON.stringify(pricing ?? {}),
        JSON.stringify(inputSchema ?? {}),
        repoRef,
        workflowId,
        templateRepo,
        status,
        status,
      ],
    )
    insertId = parseInt(String(result.insertId || 0), 10)
  } catch (err) {
    logEvent('error', 'spell_insert_db_error', { error: String(err) }, trace)
    const body = { code: 'INTERNAL', message: 'Failed to create spell', request_id: crypto.randomUUID() }
    return withCORS(env, new Response(JSON.stringify(body), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  return withCORS(env, new Response(JSON.stringify({ id: insertId }), { status: 201, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
}

async function handleSpellsGet(req: Request, env: Env, spellId: string): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (req.method !== 'GET') return withCORS(env, text('Method Not Allowed', 405))
  const auth = await requireAuthContext(req, env, { roles: ['maker', 'caster', 'operator', 'auditor'] })
  if (!auth.ok) return auth.response
  const { tenantId, tenantNumeric } = auth.context

  if (env.DATABASE_URL) {
    const row = await runQuerySingle<SpellRow>(
      env,
      'SELECT * FROM spells WHERE id = ? AND tenant_id = ? LIMIT 1',
      [requiredDbId(spellId, 0), tenantNumeric],
    )
    if (!row) return withCORS(env, text('Not Found', 404))
    return okJSON(env, spellRowToResponse(mapSpellRow(row)))
  }

  if (!env.KV) return withCORS(env, text('Not Found', 404))
  const raw = await env.KV.get(kvKeySpell(spellId, env))
  if (!raw) return withCORS(env, text('Not Found', 404))
  const parsed = JSON.parse(raw)
  if (String(parsed.tenant_id) !== String(tenantId)) return withCORS(env, text('Not Found', 404))
  return okJSON(env, parsed)
}

async function handleSpellsPatch(req: Request, env: Env, spellId: string): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (req.method !== 'PATCH') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const auth = await requireAuthContext(req, env, { roles: ['maker', 'operator'] })
  if (!auth.ok) return auth.response
  const { tenantId, tenantNumeric } = auth.context

  let payload: any = {}
  try {
    payload = await req.json()
  } catch (_) {}

  if (env.DATABASE_URL) {
    const spellNumeric = requiredDbId(spellId, 0)
    const existing = await runQuerySingle<SpellRow>(
      env,
      'SELECT * FROM spells WHERE id = ? AND tenant_id = ? LIMIT 1',
      [spellNumeric, tenantNumeric],
    )
    if (!existing) {
      return withCORS(env, text('Not Found', 404))
    }

    const updates: string[] = []
    const params: Array<string | number | null> = []

    if (typeof payload.name === 'string') {
      updates.push('name = ?')
      params.push(payload.name.trim())
    }
    if (typeof payload.summary === 'string') {
      updates.push('summary = ?')
      params.push(payload.summary.trim())
    }
    if (typeof payload.description === 'string') {
      updates.push('description = ?')
      params.push(payload.description)
    }
    if (typeof payload.visibility === 'string') {
      updates.push('visibility = ?')
      params.push(payload.visibility)
    }
    if (typeof payload.execution_mode === 'string') {
      updates.push('execution_mode = ?')
      params.push(payload.execution_mode)
    }
    if (payload.pricing !== undefined) {
      updates.push('pricing_json = ?')
      params.push(JSON.stringify(payload.pricing ?? {}))
    }
    if (payload.input_schema !== undefined) {
      updates.push('input_schema_json = ?')
      params.push(JSON.stringify(payload.input_schema ?? {}))
    }
    if (payload.repo_ref !== undefined) {
      updates.push('repo_ref = ?')
      params.push(typeof payload.repo_ref === 'string' ? payload.repo_ref : null)
    }
    if (payload.workflow_id !== undefined) {
      updates.push('workflow_id = ?')
      params.push(typeof payload.workflow_id === 'string' ? payload.workflow_id : null)
    }
    if (payload.template_repo !== undefined) {
      updates.push('template_repo = ?')
      params.push(typeof payload.template_repo === 'string' ? payload.template_repo : null)
    }
    if (typeof payload.status === 'string') {
      updates.push('status = ?')
      params.push(payload.status)
    }

    if (!updates.length) {
      return okJSON(env, spellRowToResponse(mapSpellRow(existing)))
    }

    updates.push('updated_at = NOW()')
    params.push(spellNumeric, tenantNumeric)
    await getDatabase(env).execute(`UPDATE spells SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params)

    const updated = await runQuerySingle<SpellRow>(
      env,
      'SELECT * FROM spells WHERE id = ? AND tenant_id = ? LIMIT 1',
      [spellNumeric, tenantNumeric],
    )
    if (!updated) return withCORS(env, text('Not Found', 404))
    return okJSON(env, spellRowToResponse(mapSpellRow(updated)))
  }

  if (!env.KV) return withCORS(env, text('Server misconfigured', 500))
  const key = kvKeySpell(spellId, env)
  const raw = await env.KV.get(key)
  if (!raw) return withCORS(env, text('Not Found', 404))
  const parsed = JSON.parse(raw)
  if (String(parsed.tenant_id) !== tenantId) return withCORS(env, text('Forbidden', 403))

  Object.assign(parsed, payload, { updated_at: new Date().toISOString() })
  await env.KV.put(key, JSON.stringify(parsed))
  return okJSON(env, parsed)
}

async function handleSpellPublish(req: Request, env: Env, spellId: string): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (req.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const cookies = parseCookies(req.headers.get('cookie'))
  const claims = await verifyJWT(cookies['sid'], env)
  if (!claims) return withCORS(env, text('Unauthorized', 401))
  const role = typeof claims.role === 'string' ? claims.role : null
  if (role !== 'maker' && role !== 'operator') return withCORS(env, text('Forbidden', 403))
  const tenantId = String(claims.tenant_id ?? env.DEFAULT_TENANT_ID ?? '1')

  if (env.DATABASE_URL) {
    const spellNumeric = requiredDbId(spellId, 0)
    await getDatabase(env).execute(
      'UPDATE spells SET status = ?, published_at = NOW() WHERE id = ? AND tenant_id = ?',
      ['published', spellNumeric, requiredDbId(tenantId, 0)],
    )
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }

  if (!env.KV) return withCORS(env, text('Server misconfigured', 500))
  const key = kvKeySpell(spellId, env)
  const raw = await env.KV.get(key)
  if (!raw) return withCORS(env, text('Not Found', 404))
  const parsed = JSON.parse(raw)
  if (String(parsed.tenant_id) !== tenantId) return withCORS(env, text('Forbidden', 403))
  parsed.status = 'published'
  parsed.published_at = new Date().toISOString()
  await env.KV.put(key, JSON.stringify(parsed))
  return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
}

async function handleSpellArchive(req: Request, env: Env, spellId: string): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (req.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const cookies = parseCookies(req.headers.get('cookie'))
  const claims = await verifyJWT(cookies['sid'], env)
  if (!claims) return withCORS(env, text('Unauthorized', 401))
  const role = typeof claims.role === 'string' ? claims.role : null
  if (role !== 'maker' && role !== 'operator') return withCORS(env, text('Forbidden', 403))
  const tenantId = String(claims.tenant_id ?? env.DEFAULT_TENANT_ID ?? '1')

  if (env.DATABASE_URL) {
    const spellNumeric = requiredDbId(spellId, 0)
    await getDatabase(env).execute(
      'UPDATE spells SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      ['archived', spellNumeric, requiredDbId(tenantId, 0)],
    )
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }

  if (!env.KV) return withCORS(env, text('Server misconfigured', 500))
  const key = kvKeySpell(spellId, env)
  const raw = await env.KV.get(key)
  if (!raw) return withCORS(env, text('Not Found', 404))
  const parsed = JSON.parse(raw)
  if (String(parsed.tenant_id) !== tenantId) return withCORS(env, text('Forbidden', 403))
  parsed.status = 'archived'
  parsed.updated_at = new Date().toISOString()
  await env.KV.put(key, JSON.stringify(parsed))
  return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
}

async function handleWizardsList(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (req.method !== 'GET') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const search = new URL(req.url).searchParams.get('query')?.trim()

  let items: any[] = []
  if (env.DATABASE_URL) {
    try {
      const where: string[] = ['1=1']
      const params: Array<string | number> = []
      if (search) {
        where.push('(name LIKE ? OR github_username LIKE ? OR bio LIKE ?)')
        const q = `%${search}%`
        params.push(q, q, q)
      }
      const sql = `SELECT id, name, avatar, bio, github_username, published_spells, total_executions, success_rate, joined_at
        FROM wizards
        WHERE ${where.join(' AND ')}
        ORDER BY total_executions DESC, success_rate DESC
        LIMIT 50`
      const rows = await runQuery<WizardRow>(env, sql, params)
      items = rows.map((row) => ({
        id: row.id,
        name: row.name,
        avatar: row.avatar ?? undefined,
        bio: row.bio ?? undefined,
        github_username: row.github_username ?? undefined,
        published_spells: row.published_spells ?? 0,
        total_executions: row.total_executions ?? 0,
        success_rate: row.success_rate ?? 0,
        joined_at: row.joined_at ?? undefined,
      }))
    } catch (err) {
      logEvent('warn', 'wizards_list_db_error', { error: String(err) }, trace)
      items = []
    }
  }

  return okJSON(env, { items })
}

async function handleCastsList(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (req.method !== 'GET') return withCORS(env, text('Method Not Allowed', 405))
  const url = new URL(req.url)
  const limitParam = parseInt(url.searchParams.get('limit') || '10', 10)
  let limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 10
  const auth = await requireAuthContext(req, env, { roles: ['caster', 'maker', 'operator', 'auditor'] })
  if (!auth.ok) return auth.response
  const { tenantId, tenantNumeric } = auth.context

  let items: any[] = []
  if (env.DATABASE_URL) {
    try {
      const sql = `SELECT c.id, c.spell_id, c.run_id, c.status, c.estimate_cents, c.cost_cents, c.created_at, c.finished_at, s.name as spell_name
        FROM casts c
        LEFT JOIN spells s ON s.id = c.spell_id
        WHERE c.tenant_id = ?
        ORDER BY c.created_at DESC
        LIMIT ?`
      const rows = await runQuery<CastRow>(env, sql, [tenantNumeric, limit])
      items = rows.map(castRowToSummary)
    } catch (err) {
      logEvent('warn', 'casts_list_db_error', { error: String(err) }, parseTraceparent(req.headers.get('traceparent')))
    }
  }

  return okJSON(env, { items })
}

async function handleLedgerList(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (req.method !== 'GET') return withCORS(env, text('Method Not Allowed', 405))
  const url = new URL(req.url)
  const limitParam = parseInt(url.searchParams.get('limit') || '10', 10)
  let limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 10
  const auth = await requireAuthContext(req, env, { roles: ['caster', 'maker', 'operator', 'auditor'] })
  if (!auth.ok) return auth.response
  const { tenantNumeric } = auth.context

  let items: any[] = []
  if (env.DATABASE_URL) {
    try {
      const sql = `SELECT id, cast_id, kind, amount_cents, currency, occurred_at, reason
        FROM billing_ledger
        WHERE tenant_id = ?
        ORDER BY occurred_at DESC
        LIMIT ?`
      const rows = await runQuery<{
        id: number
        cast_id: number | null
        kind: string
        amount_cents: number
        currency: string
        occurred_at: string
        reason: string
      }>(env, sql, [tenantNumeric, limit])
      items = rows.map((row) => ({
        id: row.id,
        cast_id: row.cast_id ?? undefined,
        kind: row.kind,
        amount_cents: row.amount_cents,
        currency: row.currency,
        occurred_at: row.occurred_at,
        reason: row.reason,
      }))
    } catch (err) {
      logEvent('warn', 'ledger_list_db_error', { error: String(err) }, parseTraceparent(req.headers.get('traceparent')))
    }
  }

  return okJSON(env, { items })
}

async function handleBillingCaps(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (req.method === 'GET') {
    const trace = parseTraceparent(req.headers.get('traceparent'))
    const auth = await requireAuthContext(req, env, { roles: ['caster', 'operator'] })
    if (!auth.ok) return auth.response
    const { tenantId } = auth.context
    const caps = await getTenantCapSettings(env, tenantId, trace)
    return okJSON(env, { monthly_cents: caps.monthly_cents ?? null, total_cents: caps.total_cents ?? null })
  }
  if (req.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
  const trace = parseTraceparent(req.headers.get('traceparent'))
  const auth = await requireAuthContext(req, env, { roles: ['caster', 'operator'] })
  if (!auth.ok) return auth.response
  const { tenantId } = auth.context

  let payload: any = {}
  try {
    payload = await req.json()
  } catch (_) {}

  const monthly = normalizeCapValue(payload?.monthly_cents)
  const total = normalizeCapValue(payload?.total_cents)

  try {
    await saveTenantCapSettings(env, tenantId, { monthly_cents: monthly, total_cents: total }, trace)
  } catch (err) {
    const body = { code: 'INTERNAL', message: 'Failed to persist cap settings', request_id: crypto.randomUUID() }
    return withCORS(env, new Response(JSON.stringify(body), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
}

async function handleBillingUsage(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
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
  } catch (_) {}

  const castIdRaw = payload?.cast_id
  const centsRaw = payload?.cents
  if (castIdRaw === null || castIdRaw === undefined) {
    return withCORS(env, text('cast_id required', 400))
  }
  const cents = typeof centsRaw === 'number' ? centsRaw : parseInt(String(centsRaw || ''), 10)
  if (!Number.isFinite(cents) || cents < 0) {
    return withCORS(env, text('cents must be a non-negative number', 400))
  }
  const normalizedCents = Math.round(cents)
  const units = payload?.units
  const currency = typeof payload?.currency === 'string' && payload.currency.trim() ? payload.currency.trim().toUpperCase() : 'USD'

  const tenantRaw = payload?.tenant_id
  if (tenantRaw === undefined || tenantRaw === null || tenantRaw === '') {
    return withCORS(env, text('tenant_id required', 400))
  }
  const castId = String(castIdRaw)
  const rec = await pollCastRecord(env, castId, tenantRaw)
  if (!rec) {
    const body = { code: 'NOT_FOUND', message: 'Cast not found', request_id: crypto.randomUUID() }
    return withCORS(env, new Response(JSON.stringify(body), { status: 404, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  if (normalizedCents > 0) {
    rec.cost_cents = (rec.cost_cents ?? 0) + normalizedCents
  }

  const entry: LedgerEntry = {
    id: `led_${crypto.randomUUID()}`,
    tenant_id: rec.tenant_id,
    cast_id: rec.id,
    spell_id: rec.spell_id,
    kind: 'charge',
    cents: normalizedCents,
    currency,
    occurred_at: Date.now(),
    meta: {
      source: 'usage_report',
      units: typeof units === 'number' && Number.isFinite(units) ? units : undefined,
      cast_id: rec.id,
    },
    source: 'system',
    reason: 'usage',
  }

  try {
    await appendLedgerEntry(env, entry, trace)
  } catch (err) {
    logEvent('warn', 'billing_usage_ledger_error', { error: String(err), cast_id: rec.id }, trace)
    const body = { code: 'INTERNAL', message: 'Failed to record usage', request_id: crypto.randomUUID() }
    return withCORS(env, new Response(JSON.stringify(body), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
  }

  if (normalizedCents > 0) {
    try {
      await saveCastRecord(env, rec)
    } catch (err) {
      logEvent('warn', 'billing_usage_cast_update_error', { error: String(err), cast_id: rec.id }, trace)
    }
  }

  try {
    await appendSseEvent(
      env,
      rec.id,
      'log',
      {
        level: 'info',
        message: 'usage_report',
        cents: normalizedCents,
        units: typeof units === 'number' && Number.isFinite(units) ? units : undefined,
      },
      trace,
    )
  } catch (err) {
    logEvent('warn', 'billing_usage_sse_error', { error: String(err), cast_id: rec.id }, trace)
  }

  return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
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

    if (pathname === '/api/session') {
      return handleSession(request, env)
    }

    if (pathname === '/api/logout') {
      return handleLogout(request, env)
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
      if (pathname === '/api/v1/spells') {
        if (request.method === 'POST') {
          return handleSpellsCreate(request, env)
        }
        return handleSpellsList(request, env)
      }
      if (pathname === '/api/v1/wizards') {
        return handleWizardsList(request, env)
      }
      if (pathname === '/api/v1/casts') {
        return handleCastsList(request, env)
      }
      if (pathname === '/api/v1/billing/ledger') {
        return handleLedgerList(request, env)
      }
      if (pathname === '/api/v1/billing/caps') {
        return handleBillingCaps(request, env)
      }
      if (pathname === '/api/v1/billing/usage') {
        return handleBillingUsage(request, env)
      }
      const castMatch = pathname.match(/^\/api\/v1\/spells\/(\d+):cast$/)
      if (castMatch) {
        return handleCastCreate(request, env, castMatch[1])
      }
      const getSpell = pathname.match(/^\/api\/v1\/spells\/(\d+)$/)
      if (getSpell) {
        if (request.method === 'GET') return handleSpellsGet(request, env, getSpell[1])
        if (request.method === 'PATCH') return handleSpellsPatch(request, env, getSpell[1])
        return withCORS(env, text('Method Not Allowed', 405))
      }
      const publishSpell = pathname.match(/^\/api\/v1\/spells\/(\d+):publish$/)
      if (publishSpell) {
        return handleSpellPublish(request, env, publishSpell[1])
      }
      const archiveSpell = pathname.match(/^\/api\/v1\/spells\/(\d+):archive$/)
      if (archiveSpell) {
        return handleSpellArchive(request, env, archiveSpell[1])
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
