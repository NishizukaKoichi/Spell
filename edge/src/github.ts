// Minimal GitHub App client for Cloudflare Workers
// - Creates GitHub App JWT (RS256)
// - Resolves installation for a repo
// - Creates short‑lived installation access token
// - Dispatches a workflow via Actions API

const DEFAULT_API_BASE = "https://api.github.com"

function b64url(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_")
}

function b64urlJSON(obj: unknown): string {
  const json = new TextEncoder().encode(JSON.stringify(obj))
  return b64url(json)
}

function parsePem(pem: string): { type: "pkcs8"; data: ArrayBuffer } {
  // Expect PKCS#8: -----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----
  const clean = pem.trim()
  if (clean.includes("BEGIN RSA PRIVATE KEY")) {
    throw new Error("Unsupported key format: PKCS#1 (RSA PRIVATE KEY). Provide PKCS#8 'BEGIN PRIVATE KEY'.")
  }
  const m = clean.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/)
  if (!m) throw new Error("Invalid PEM: missing BEGIN/END PRIVATE KEY block")
  const b64 = m[1].replace(/\s+/g, "")
  const raw = atob(b64)
  const buf = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
  return { type: "pkcs8", data: buf.buffer }
}

async function importPrivateKeyRS256(pem: string): Promise<CryptoKey> {
  const { data } = parsePem(pem)
  return crypto.subtle.importKey(
    "pkcs8",
    data,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
}

export async function createAppJwt(appId: string, pem: string): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iat: now - 30, // allow clock skew
    exp: now + 9 * 60, // max 10m
    iss: appId,
  }
  const base = `${b64urlJSON(header)}.${b64urlJSON(payload)}`
  const key = await importPrivateKeyRS256(pem)
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(base),
  )
  const jwt = `${base}.${b64url(new Uint8Array(sig))}`
  return jwt
}

export async function getInstallationIdForRepo(jwt: string, ownerRepo: string, apiBase = DEFAULT_API_BASE): Promise<number> {
  const [owner, repo] = ownerRepo.split("/")
  const url = `${apiBase}/repos/${owner}/${repo}/installation`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
    },
  })
  if (res.status === 404) throw new RepoAccessError("FORBIDDEN_REPO")
  if (!res.ok) throw new GithubApiError("Failed to resolve installation", res.status)
  const json = (await res.json()) as any
  const id = json.id as number
  if (!id) throw new GithubApiError("Invalid installation response", res.status)
  return id
}

export async function createInstallationToken(
  jwt: string,
  installationId: number,
  scope: { permissions?: { actions?: "read" | "write"; contents?: "read" | "write" } } = {
    permissions: { actions: "write", contents: "read" },
  },
  apiBase = DEFAULT_API_BASE,
): Promise<string> {
  const url = `${apiBase}/app/installations/${installationId}/access_tokens`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "content-type": "application/json",
    },
    body: JSON.stringify(scope),
  })
  if (!res.ok) throw new GithubApiError("Failed to create installation token", res.status)
  const json = (await res.json()) as any
  const token = json.token as string
  if (!token) throw new GithubApiError("No token in response", res.status)
  return token
}

export async function dispatchWorkflow(
  token: string,
  ownerRepo: string,
  workflowId: string,
  ref: string,
  payload: any,
  apiBase = DEFAULT_API_BASE,
): Promise<void> {
  const [owner, repo] = ownerRepo.split("/")
  const url = `${apiBase}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ref, inputs: { payload: JSON.stringify(payload) } }),
  })
  if (res.status === 404) throw new WorkflowNotFoundError("WORKFLOW_NOT_FOUND")
  if (res.status === 403) throw new RepoAccessError("FORBIDDEN_REPO")
  if (!res.ok) throw new GithubApiError("Failed to dispatch workflow", res.status)
}

export class GithubApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "GithubApiError"
    this.status = status
  }
}

export class RepoAccessError extends Error {
  constructor(message = "FORBIDDEN_REPO") {
    super(message)
    this.name = "RepoAccessError"
  }
}

export class WorkflowNotFoundError extends Error {
  constructor(message = "WORKFLOW_NOT_FOUND") {
    super(message)
    this.name = "WorkflowNotFoundError"
  }
}

