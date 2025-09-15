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

  // secrets (may be undefined if not set yet)
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
  NATS_AUTH_TOKEN?: string
  OTLP_HEADERS?: string
}
import {
  createAppJwt,
  getInstallationIdForRepo,
  createInstallationToken,
  dispatchWorkflow,
  RepoAccessError,
  WorkflowNotFoundError,
  GithubApiError,
} from './github'

const text = (body: string, status = 200, headers: HeadersInit = {}) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", ...headers } })

function corsHeaders(env: Env): Record<string, string> {
  const origin = env.CORS_ALLOW_ORIGIN || "*"
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization,stripe-signature",
    "Access-Control-Max-Age": "600",
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
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders(env) },
  })
}

async function hmacSHA256(key: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data))
  return [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let res = 0
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return res === 0
}

function parseStripeSigHeader(header: string | null): { t: number; v1: string } | null {
  if (!header) return null
  // format: t=timestamp, v1=signature, ...
  const parts = header.split(",").map((s) => s.trim())
  let t = 0
  let v1 = ""
  for (const p of parts) {
    const [k, v] = p.split("=")
    if (k === "t") t = parseInt(v, 10)
    if (k === "v1") v1 = v
  }
  if (!t || !v1) return null
  return { t, v1 }
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  }
  if (request.method !== "POST") return withCORS(env, text("Method Not Allowed", 405))
  const sigHeader = request.headers.get("stripe-signature")
  const parsed = parseStripeSigHeader(sigHeader)
  if (!parsed) return withCORS(env, text("Missing or invalid Stripe-Signature", 400))
  const raw = await request.text() // raw body required
  const secret = env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.warn("STRIPE_WEBHOOK_SECRET not set")
    return withCORS(env, text("Server misconfigured", 500))
  }
  // Verify timestamp tolerance (5 minutes)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - parsed.t) > 300) return withCORS(env, text("Signature timestamp out of tolerance", 400))
  const signedPayload = `${parsed.t}.${raw}`
  const expected = await hmacSHA256(secret, signedPayload)
  if (!timingSafeEqual(expected, parsed.v1)) return withCORS(env, text("Invalid signature", 400))
  // Minimal event routing
  try {
    const event = JSON.parse(raw)
    // Optionally persist to KV for audit
    const key = `${env.CAP_KV_PREFIX || "cap"}:stripe:${event.id || parsed.t}`
    await env.KV.put(key, raw, { expirationTtl: 60 * 60 * 24 })
  } catch (e) {
    console.warn("Stripe webhook JSON parse error", e)
  }
  return withCORS(env, text("ok", 200))
}

async function handleOAuthGithubStart(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const clientId = env.GITHUB_OAUTH_CLIENT_ID
  if (!clientId) return withCORS(env, text("GITHUB_OAUTH_CLIENT_ID not set", 500))
  const state = crypto.randomUUID()
  await env.KV.put(`${env.CAP_KV_PREFIX || "cap"}:gh_state:${state}`, "1", { expirationTtl: 600 })
  const redirectUri = `${url.origin}/api/oauth/github/callback`
  const authorize = new URL("https://github.com/login/oauth/authorize")
  authorize.searchParams.set("client_id", clientId)
  authorize.searchParams.set("redirect_uri", redirectUri)
  authorize.searchParams.set("scope", "read:user user:email")
  authorize.searchParams.set("state", state)
  return new Response(null, { status: 302, headers: { Location: authorize.toString(), ...corsHeaders(env) } })
}

async function handleOAuthGithubCallback(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state) return withCORS(env, text("Missing code/state", 400))
  const okState = await env.KV.get(`${env.CAP_KV_PREFIX || "cap"}:gh_state:${state}`)
  if (!okState) return withCORS(env, text("Invalid state", 400))
  const clientId = env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) return withCORS(env, text("GitHub OAuth not configured", 500))
  // Exchange code for token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: `${url.origin}/api/oauth/github/callback` }),
  })
  if (!tokenRes.ok) return withCORS(env, text("OAuth exchange failed", 502))
  const tokenJson = (await tokenRes.json()) as any
  const accessToken = tokenJson.access_token as string
  if (!accessToken) return withCORS(env, text("No access token", 502))
  // Fetch user
  const userRes = await fetch("https://api.github.com/user", { headers: { Authorization: `token ${accessToken}`, Accept: "application/vnd.github+json" } })
  if (!userRes.ok) return withCORS(env, text("GitHub user fetch failed", 502))
  const user = (await userRes.json()) as any
  // Issue a minimal session JWT if configured
  let setCookie = ""
  try {
    if (env.SESSION_SECRET) {
      const jwt = await signJWT({ sub: `github:${user.id}`, name: user.login, iat: Math.floor(Date.now() / 1000) }, env)
      setCookie = `sid=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
    }
  } catch (e) {
    console.warn("JWT sign error", e)
  }
  const headers: Record<string, string> = { ...corsHeaders(env) }
  if (setCookie) headers["Set-Cookie"] = setCookie
  return new Response(JSON.stringify({ ok: true, user }), { status: 200, headers: { "content-type": "application/json", ...headers } })
}

async function signJWT(payload: Record<string, any>, env: Env): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" }
  const enc = (obj: any) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj)))).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  const iss = env.JWT_ISSUER || ""
  const aud = env.JWT_AUDIENCE || ""
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
  const body = { iss, aud, exp, ...payload }
  const base = `${enc(header)}.${enc(body)}`
  const key = env.SESSION_SECRET || ""
  const sigHex = await hmacSHA256(key, base)
  const sigB64 = btoa(String.fromCharCode(...sigHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  return `${base}.${sigB64}`
}

  async function handleArtifact(req: Request, env: Env, pathname: string): Promise<Response> {
  const origin = env.R2_PUBLIC_BASE_URL
  // Routes: /api/artifacts/:key for GET/PUT/DELETE
  const parts = pathname.split("/").filter(Boolean) // [api, artifacts, ...]
  const idx = parts.indexOf("artifacts")
  const key = parts.slice(idx + 1).join("/")
  if (!key) return withCORS(env, text("Missing key", 400))
  if (req.method === "PUT") {
    const obj = await env.R2.put(key, req.body)
    const url = origin ? `${origin.replace(/\/$/, "")}/${encodeURIComponent(key)}` : undefined
    return okJSON(env, { ok: true, key, etag: obj?.etag, url })
  }
  if (req.method === "GET") {
    const obj = await env.R2.get(key)
    if (!obj) return withCORS(env, text("Not Found", 404))
    const headers = new Headers(corsHeaders(env))
    obj.writeHttpMetadata(headers)
    headers.set("etag", obj.httpEtag)
    return new Response(obj.body, { status: 200, headers })
  }
  if (req.method === "DELETE") {
    await env.R2.delete(key)
    return withCORS(env, text("ok", 200))
  }
  if (req.method === "OPTIONS") return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
  return withCORS(env, text("Method Not Allowed", 405))
  }

  type CastRecord = {
    id: string
    run_id: string
    spell_id: string
    status: 'queued' | 'running' | 'succeeded' | 'failed'
    started_at: number
    estimate_cents: number
    done_at?: number
  }

  function kvKeyCast(id: string, env: Env) {
    return `${env.CAP_KV_PREFIX || 'cap'}:cast:${id}`
  }

  async function handleCastCreate(req: Request, env: Env, spellId: string): Promise<Response> {
    if (req.method === 'OPTIONS') return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
    if (req.method !== 'POST') return withCORS(env, text('Method Not Allowed', 405))
    const idem = req.headers.get('Idempotency-Key') || crypto.randomUUID()
    let json: any = {}
    try {
      if (req.headers.get('content-type')?.includes('application/json')) {
        json = await req.json()
      }
    } catch (_) {}
    const mode = (json?.mode as string) || 'workflow'

    const now = Date.now()
    const castId = `${Math.floor(now / 1000)}${Math.floor(Math.random() * 1000)}`
    const runId = `c_${crypto.randomUUID()}`

    // Base record
    const rec: CastRecord = {
      id: castId,
      run_id: runId,
      spell_id: spellId,
      status: 'queued',
      started_at: now,
      estimate_cents: 25,
    }

    // Workflow mode: dispatch GitHub Actions run via GitHub App
    if (mode === 'workflow') {
      const ownerRepo = 'NishizukaKoichi/Spell'
      const workflowId = 'spell-run.yml'
      const ref = 'main'
      const appId = env.GITHUB_APP_ID
      const pem = env.GITHUB_APP_PRIVATE_KEY
      if (!appId || !pem) {
        return withCORS(env, new Response(JSON.stringify({ code: 'INTERNAL', message: 'GitHub App not configured' }), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders(env) } }))
      }
      try {
        let stage: 'create_jwt' | 'get_installation' | 'create_token' | 'dispatch' = 'create_jwt'
        const jwt = await createAppJwt(appId, pem)
        stage = 'get_installation'
        const instId = await getInstallationIdForRepo(jwt, ownerRepo, env.GITHUB_API_BASE)
        stage = 'create_token'
        // Request default installation permissions (no explicit narrowing)
        const instTok = await createInstallationToken(jwt, instId, undefined, env.GITHUB_API_BASE)
        stage = 'dispatch'
        await dispatchWorkflow(instTok, ownerRepo, workflowId, ref, { run_id: runId, spell_id: spellId, input: json?.input }, env.GITHUB_API_BASE)
      } catch (e: any) {
        try {
          const name = e?.name || 'Error'
          const msg = e?.message || String(e)
          const status = e?.status
          console.warn('workflow dispatch error', { name, status, msg })
        } catch (_) {}
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
    }

    await env.KV.put(kvKeyCast(castId, env), JSON.stringify(rec), { expirationTtl: 60 * 60 })
    const body = {
      run_id: runId,
      cast_id: Number(castId),
      status: 'queued',
      estimate_cents: rec.estimate_cents,
      progress_sse: `/api/v1/casts/${castId}/events`,
      idempotency_key: idem,
      mode,
      gh: mode === 'workflow' ? { ownerRepo: 'NishizukaKoichi/Spell', workflowId: 'spell-run.yml', ref: 'main' } : undefined,
    }
    return okJSON(env, body)
  }

  async function handleCastGet(req: Request, env: Env, castId: string): Promise<Response> {
    const raw = await env.KV.get(kvKeyCast(castId, env))
    if (!raw) return withCORS(env, text('Not Found', 404))
    const rec = JSON.parse(raw) as CastRecord
    return okJSON(env, {
      cast_id: Number(rec.id),
      run_id: rec.run_id,
      status: rec.status,
      estimate_cents: rec.estimate_cents,
      started_at: rec.started_at,
      finished_at: rec.done_at,
    })
  }

  async function handleCastEvents(req: Request, env: Env, castId: string): Promise<Response> {
    const headers = new Headers({
      'content-type': 'text/event-stream; charset=utf-8',
      connection: 'keep-alive',
      'cache-control': 'no-cache',
      ...corsHeaders(env),
    })
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enc = new TextEncoder()
        function send(obj: any, event?: string) {
          let chunk = ''
          if (event) chunk += `event: ${event}\n`
          chunk += `data: ${JSON.stringify(obj)}\n\n`
          controller.enqueue(enc.encode(chunk))
        }
        send({ stage: 'queued', pct: 0, message: 'queued' }, 'progress')
        await new Promise((r) => setTimeout(r, 500))
        send({ stage: 'start', pct: 5, message: 'starting' }, 'progress')
        for (let i = 10; i <= 90; i += 20) {
          await new Promise((r) => setTimeout(r, 600))
          send({ stage: 'run', pct: i, message: `processing ${i}%` }, 'progress')
        }
        await new Promise((r) => setTimeout(r, 600))
        send({ stage: 'finalize', pct: 100, message: 'completed' }, 'progress')
        send({ status: 'succeeded' }, 'completed')
        controller.close()
        // mark as succeeded in KV (best-effort)
        try {
          const raw = await env.KV.get(kvKeyCast(castId, env))
          if (raw) {
            const rec = JSON.parse(raw) as CastRecord
            rec.status = 'succeeded'
            rec.done_at = Date.now()
            await env.KV.put(kvKeyCast(castId, env), JSON.stringify(rec), { expirationTtl: 60 * 60 })
          }
        } catch {}
      },
    })
    return new Response(stream, { status: 200, headers })
  }

  async function handleGithubWebhook(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") {
      return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
    }
    if (req.method !== "POST") return withCORS(env, text("Method Not Allowed", 405))
    const secret = env.GITHUB_APP_WEBHOOK_SECRET
    if (!secret) return withCORS(env, text("Server misconfigured", 500))
    const sig = req.headers.get("x-hub-signature-256")
    if (!sig || !sig.startsWith("sha256=")) return withCORS(env, text("Missing signature", 400))
    const raw = await req.text()
    const digest = await hmacSHA256(secret, raw)
    const expected = `sha256=${digest}`
    if (!timingSafeEqual(expected, sig)) return withCORS(env, text("Invalid signature", 400))
    try {
      const payload = JSON.parse(raw)
      const delivery = req.headers.get("x-github-delivery") || `${Date.now()}`
      const key = `${env.CAP_KV_PREFIX || "cap"}:gh:${delivery}`
      await env.KV.put(key, raw, { expirationTtl: 60 * 60 * 24 })
    } catch (_) {
      // ignore parse errors, still acknowledge
    }
    return withCORS(env, text("ok", 200))
  }

  export default {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url)
      const pathname = url.pathname

    // CORS preflight for API
    if (request.method === "OPTIONS") {
      return withCORS(env, new Response(null, { status: 204, headers: corsHeaders(env) }))
    }

    // Health checks (allow both roots and /api)
    if (pathname === "/health" || pathname === "/api/health") {
      return withCORS(env, text("ok", 200))
    }

    // Stripe webhook
    if (pathname === "/api/stripe/webhook") {
      return handleStripeWebhook(request, env)
    }

    // GitHub OAuth
    if (pathname === "/api/oauth/github/start") return handleOAuthGithubStart(request, env)
    if (pathname === "/api/oauth/github/callback") return handleOAuthGithubCallback(request, env)

    // R2 artifacts simple CRUD
    if (pathname.startsWith("/api/artifacts/")) {
      return handleArtifact(request, env, pathname)
    }

    // GitHub App webhook
    if (pathname === "/api/github/webhook") {
      return handleGithubWebhook(request, env)
    }

    // Minimal v1 API stubs to enable UI wiring
    if (pathname.startsWith('/api/v1/')) {
      // POST /api/v1/spells/{id}:cast
      const castMatch = pathname.match(/^\/api\/v1\/spells\/(\d+):cast$/)
      if (castMatch) {
        return handleCastCreate(request, env, castMatch[1])
      }
      // GET /api/v1/casts/{id}
      const getCast = pathname.match(/^\/api\/v1\/casts\/(\d+)$/)
      if (getCast) {
        return handleCastGet(request, env, getCast[1])
      }
      // GET /api/v1/casts/{id}/events (SSE)
      const sseCast = pathname.match(/^\/api\/v1\/casts\/(\d+)\/events$/)
      if (sseCast) {
        return handleCastEvents(request, env, sseCast[1])
      }
    }

    return withCORS(env, text("spell-edge-js ready", 200))
  },
}
