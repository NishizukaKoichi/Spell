import { describe, expect, beforeEach, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'

const castsById = new Map<number, any>()
const castsByIdem = new Map<string, number>()
const castsByRun = new Map<string, number>()
const ledgerRecords: Array<{ tenantId: number; castId: number | null; kind: string; amount: number; externalId: string | null }> = []
let nextCastId = 100

const executeMock = vi.fn(async (sql: string, params: Array<any>) => {
  const trimmed = sql.trim().toUpperCase()
  if (trimmed.startsWith('INSERT INTO CASTS')) {
    const id = ++nextCastId
    const nowIso = new Date().toISOString()
    const tenantId = Number(params[0])
    const spellId = Number(params[1])
    const casterId = Number(params[2])
    const runId = String(params[3])
    const idem = String(params[4])
    const mode = String(params[5])
    const estimate = Number(params[7])
    const timeoutSec = Number(params[8])
    const region = params[9] == null ? 'auto' : String(params[9])
    const budgetCap = params[10] == null ? null : Number(params[10])
    const inputHash = String(params[11])

    const row = {
      id,
      run_id: runId,
      tenant_id: tenantId,
      spell_id: spellId,
      caster_user_id: casterId,
      idempotency_key: idem,
      mode,
      status: 'queued',
      estimate_cents: estimate,
      cost_cents: null,
      timeout_sec: timeoutSec,
      region,
      budget_cap_cents: budgetCap,
      input_hash: inputHash,
      started_at: nowIso,
      finished_at: null,
      canceled_at: null,
      artifact_url: null,
      artifact_expires_at: null,
      artifact_size_bytes: null,
      artifact_sha256: null,
      logs_url: null,
      failure_reason: null,
      p95_ms: null,
      error_rate: null,
      gh_run_id: null,
      sse_channel: null,
      created_at: nowIso,
      updated_at: nowIso,
    }
    castsById.set(id, row)
    castsByIdem.set(idem, id)
    castsByRun.set(runId, id)
    return { insertId: id }
  }

  if (trimmed.startsWith('UPDATE CASTS SET')) {
    const id = Number(params[16])
    const row = castsById.get(id)
    if (!row) throw new Error('cast not found for update')
    row.status = params[0]
    row.cost_cents = params[1]
    row.artifact_url = params[2]
    row.artifact_sha256 = params[3]
    row.artifact_size_bytes = params[4]
    row.artifact_expires_at = params[5]
    row.logs_url = params[6]
    row.failure_reason = params[7]
    row.p95_ms = params[8]
    row.error_rate = params[9]
    row.gh_run_id = params[10]
    row.finished_at = params[11]
    row.canceled_at = params[12]
    row.region = params[13]
    row.timeout_sec = params[14]
    row.budget_cap_cents = params[15]
    row.updated_at = new Date().toISOString()
    return { rowsAffected: 1 }
  }

  if (trimmed.startsWith('INSERT INTO BILLING_LEDGER')) {
    const tenantId = Number(params[0])
    const castId = params[1] == null ? null : Number(params[1])
    const kind = String(params[3])
    const amount = Number(params[4])
    const externalId = params[8] == null ? null : String(params[8])
    if (externalId && ledgerRecords.some((entry) => entry.externalId === externalId)) {
      return { insertId: 0 }
    }
    ledgerRecords.push({ tenantId, castId, kind, amount, externalId })
    return { insertId: ledgerRecords.length }
  }

  return { insertId: 0 }
})

const runQuerySingleImpl = async (_env: any, sql: string, params: Array<any>) => {
  const upper = sql.trim().toUpperCase()
  if (upper.includes('FROM CASTS WHERE TENANT_ID') && upper.includes('IDEMPOTENCY_KEY')) {
    const idem = String(params[1])
    const id = castsByIdem.get(idem)
    return id ? castsById.get(id) ?? null : null
  }
  if (upper.startsWith('SELECT ID, TENANT_ID FROM SPELLS')) {
    const spellId = Number(params[0])
    return { id: spellId, tenant_id: 1 }
  }
  if (upper.includes('FROM CASTS WHERE ID =')) {
    const id = Number(params[0])
    return castsById.get(id) ?? null
  }
  if (upper.includes('COALESCE(SUM(AMOUNT_CENTS)')) {
    return { total: 0 }
  }
  if (upper.includes('FROM BILLING_LEDGER WHERE CAST_ID =')) {
    const castId = Number(params[0])
    const kind = String(params[1])
    const existing = ledgerRecords.find((entry) => entry.castId === castId && entry.kind === kind)
    return existing ? { id: 1 } : null
  }
  if (upper.includes('FROM CASTS WHERE RUN_ID =')) {
    const runId = String(params[0])
    const id = castsByRun.get(runId)
    return id ? castsById.get(id) ?? null : null
  }
  return null
}

const runQuerySingleMock = vi.fn(runQuerySingleImpl)

vi.mock('../src/db', () => ({
  getDatabase: () => ({ execute: executeMock }),
  runQuery: async () => [],
  runQuerySingle: (...args: [any, string, Array<any>]) => runQuerySingleMock(...args),
}))

const kvStore = new Map<string, string>()
const auditStore = new Map<string, string>()

const envBase: any = {
  DATABASE_URL: 'mysql://local/test',
  DEFAULT_TENANT_ID: '1',
  DEFAULT_CASTER_USER_ID: '10',
  DEFAULT_TENANT_CAP_CENTS: '1000',
  DEFAULT_SPELL_ESTIMATE_CENTS: '25',
  INTERNAL_API_TOKEN: 'internal-token',
  NATS_URL: 'https://nats.example.com',
  NATS_AUTH_TOKEN: 'nats-secret',
  CAP_KV_PREFIX: 'cap',
  AUDIT_R2_PREFIX: 'audit',
  ARTIFACT_TTL_DAYS: '7',
  ARTIFACT_EXTEND_COST_CENTS: '0',
  ARTIFACT_EXTEND_MAX_DAYS: '30',
  JWT_ISSUER: 'https://spell.test',
  JWT_AUDIENCE: 'https://spell.test',
  KV: {
    async get(key: string) {
      return kvStore.get(key) ?? null
    },
    async put(key: string, value: string) {
      kvStore.set(key, value)
    },
    async delete(key: string) {
      kvStore.delete(key)
    },
    async list() {
      return { keys: [], list_complete: true }
    },
  },
  R2: {
    async put(key: string, value: any) {
      const existing = auditStore.get(key) ?? ''
      auditStore.set(key, existing + (typeof value === 'string' ? value : ''))
      return null
    },
    async get(key: string) {
      const value = auditStore.get(key)
      if (!value) return null
      return {
        body: new Response(value).body,
        writeHttpMetadata: () => {},
        httpEtag: 'etag',
      }
    },
    async delete(key: string) {
      auditStore.delete(key)
    },
  },
}

const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))

vi.stubGlobal('fetch', fetchMock)

// Import the worker after mocks are in place
import handler from '../src/worker'

function freshEnv() {
  return { ...envBase }
}

describe('cast lifecycle via PlanetScale path', () => {
  beforeEach(() => {
    castsById.clear()
    castsByIdem.clear()
    castsByRun.clear()
    ledgerRecords.length = 0
    kvStore.clear()
    auditStore.clear()
    nextCastId = 100
    executeMock.mockClear()
    runQuerySingleMock.mockClear()
    fetchMock.mockClear()
  })

  it('creates a cast, responds to duplicate idempotency calls, and finalizes verdict', async () => {
    const env = freshEnv()

    const castRequest = new Request('https://spell.test/api/v1/spells/123:cast', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': 'idem-001',
      },
      body: JSON.stringify({ mode: 'service', input: { foo: 'bar' } }),
    })

    const res = await handler.fetch(castRequest, env)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.mode).toBe('service')
    expect(typeof data.cast_id).toBe('number')
    expect(data.status).toBe('queued')

    const firstCast = castsById.get(data.cast_id)
    expect(firstCast).toBeTruthy()
    expect(firstCast?.status).toBe('queued')

    const dupRequest = new Request('https://spell.test/api/v1/spells/123:cast', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': 'idem-001',
      },
      body: JSON.stringify({ mode: 'service', input: { foo: 'bar' } }),
    })
    const dupRes = await handler.fetch(dupRequest, env)
    expect(dupRes.status).toBe(200)
    const dupJson = await dupRes.json()
    expect(dupJson.cast_id).toBe(data.cast_id)
    expect(fetchMock).toHaveBeenCalledTimes(1) // duplicate idempotency should not re-publish

    const verdictReq = new Request(`https://spell.test/api/v1/casts/${data.cast_id}:verdict`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer internal-token',
      },
      body: JSON.stringify({
        run_id: data.run_id,
        status: 'succeeded',
        cost_cents: 42,
      }),
    })

    const verdictRes = await handler.fetch(verdictReq, env)
    expect(verdictRes.status).toBe(204)

    const stored = castsById.get(data.cast_id)
    expect(stored?.status).toBe('succeeded')
    expect(stored?.cost_cents).toBe(42)

    const estimateEntries = ledgerRecords.filter((entry) => entry.kind === 'estimate')
    const chargeEntries = ledgerRecords.filter((entry) => entry.kind === 'charge')
    const finalizeEntries = ledgerRecords.filter((entry) => entry.kind === 'finalize')

    expect(estimateEntries.length).toBe(1)
    expect(chargeEntries.length).toBe(1)
    expect(finalizeEntries.length).toBe(1)
  })

  it('cancels a queued cast and records finalize ledger entry without charges', async () => {
    const env = freshEnv()

    const castRequest = new Request('https://spell.test/api/v1/spells/456:cast', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': 'cancel-test-idem',
      },
      body: JSON.stringify({ mode: 'service', input: { a: 1 } }),
    })

    const res = await handler.fetch(castRequest, env)
    expect(res.status).toBe(200)
    const data = await res.json()
    const castId = data.cast_id as number

    const cancelReq = new Request(`https://spell.test/api/v1/casts/${castId}:cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    })

    const cancelRes = await handler.fetch(cancelReq, env)
    expect(cancelRes.status).toBe(204)

    const stored = castsById.get(castId)
    expect(stored?.status).toBe('canceled')
    expect(stored?.failure_reason).toBe('Canceled by user')

    const estimateEntries = ledgerRecords.filter((entry) => entry.kind === 'estimate')
    const chargeEntries = ledgerRecords.filter((entry) => entry.kind === 'charge')
    const finalizeEntries = ledgerRecords.filter((entry) => entry.kind === 'finalize')

    expect(estimateEntries.length).toBe(1)
    expect(chargeEntries.length).toBe(0)
    expect(finalizeEntries.length).toBe(1)

    // One publish for create, one for cancel
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('processes payment_intent.succeeded webhook and writes charge entry', async () => {
    const env = freshEnv()
    env.STRIPE_WEBHOOK_SECRET = 'whsec_test'

    const event = {
      id: 'evt_test_123',
      type: 'payment_intent.succeeded',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          object: 'payment_intent',
          id: 'pi_test_123',
          amount_received: 8800,
          currency: 'jpy',
          metadata: {
            tenant_id: '1',
            cast_id: '205',
            spell_id: '305',
            run_id: 'c_run',
          },
        },
      },
    }

    const body = JSON.stringify(event)
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
      .update(`${timestamp}.${body}`)
      .digest('hex')

    const webhookReq = new Request('https://spell.test/api/stripe/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${timestamp},v1=${signature}`,
      },
      body,
    })

    const webhookRes = await handler.fetch(webhookReq, env)
    expect(webhookRes.status).toBe(200)

    const chargeEntries = ledgerRecords.filter((entry) => entry.kind === 'charge')
    expect(chargeEntries.length).toBeGreaterThanOrEqual(1)
    expect(chargeEntries.some((entry) => entry.amount === 8800)).toBe(true)
  })
})
