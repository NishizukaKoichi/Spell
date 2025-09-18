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
  // Support both PKCS#8 (BEGIN PRIVATE KEY) and PKCS#1 (BEGIN RSA PRIVATE KEY)
  const clean = pem.replace(/\\n/g, "\n").trim()
  const pkcs8 = clean.match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/)
  if (pkcs8) {
    const b64 = pkcs8[1].replace(/\s+/g, "")
    const raw = atob(b64)
    const buf = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)
    return { type: "pkcs8", data: buf.buffer.slice(0) as ArrayBuffer }
  }
  const pkcs1 = clean.match(/-----BEGIN RSA PRIVATE KEY-----([\s\S]+?)-----END RSA PRIVATE KEY-----/)
  if (pkcs1) {
    const b64 = pkcs1[1].replace(/\s+/g, "")
    const raw = atob(b64)
    const rsa = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) rsa[i] = raw.charCodeAt(i)
    const pk8 = wrapPkcs1ToPkcs8(rsa)
    return { type: "pkcs8", data: pk8.buffer.slice(0) as ArrayBuffer }
  }
  throw new Error("Invalid PEM: missing PRIVATE KEY block")
}

function derLen(len: number): Uint8Array {
  if (len < 128) return new Uint8Array([len])
  if (len < 256) return new Uint8Array([0x81, len])
  return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff])
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const p of parts) {
    out.set(p, off)
    off += p.length
  }
  return out
}

function wrapPkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  // PrivateKeyInfo ::= SEQUENCE {
  //   version Version (0),
  //   privateKeyAlgorithm AlgorithmIdentifier (rsaEncryption),
  //   privateKey OCTET STRING (PKCS#1 RSAPrivateKey)
  // }
  const version = new Uint8Array([0x02, 0x01, 0x00]) // INTEGER 0
  const algId = new Uint8Array([
    0x30, 0x0d, // SEQUENCE len=13
    0x06, 0x09, // OID len=9
    0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, // 1.2.840.113549.1.1.1 rsaEncryption
    0x05, 0x00, // NULL
  ])
  const pkcs1Octet = concatBytes(new Uint8Array([0x04]), derLen(pkcs1.length), pkcs1)
  const seqLen = version.length + algId.length + pkcs1Octet.length
  const top = concatBytes(new Uint8Array([0x30]), derLen(seqLen), version, algId, pkcs1Octet)
  return top
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
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "spell-edge/1.0",
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
  scope?: { permissions?: { actions?: "read" | "write"; contents?: "read" | "write" } },
  apiBase = DEFAULT_API_BASE,
): Promise<string> {
  const url = `${apiBase}/app/installations/${installationId}/access_tokens`
  const init: RequestInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: "application/vnd.github+json",
      "content-type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "spell-edge/1.0",
    },
    body: JSON.stringify(scope ?? {}),
  }
  const res = await fetch(url, init)
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
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "spell-edge/1.0",
    },
    body: JSON.stringify({ ref, inputs: { payload: JSON.stringify(payload) } }),
  })
  if (res.status === 404) throw new WorkflowNotFoundError("WORKFLOW_NOT_FOUND")
  if (res.status === 403) throw new RepoAccessError("FORBIDDEN_REPO")
  if (!res.ok) throw new GithubApiError("Failed to dispatch workflow", res.status)
}

export async function getLatestWorkflowRun(
  token: string,
  ownerRepo: string,
  workflowId: string,
  ref: string,
  apiBase = DEFAULT_API_BASE,
): Promise<any | null> {
  const [owner, repo] = ownerRepo.split("/")
  const url = `${apiBase}/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/runs?per_page=1&branch=${encodeURIComponent(ref)}&event=workflow_dispatch`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "spell-edge/1.0",
    },
  })
  if (!res.ok) throw new GithubApiError("Failed to list workflow runs", res.status)
  const json = (await res.json()) as any
  const runs = (json.workflow_runs as any[]) || []
  return runs.length ? runs[0] : null
}

export async function cancelWorkflowRun(
  token: string,
  ownerRepo: string,
  runId: number,
  apiBase = DEFAULT_API_BASE,
): Promise<void> {
  const [owner, repo] = ownerRepo.split('/')
  const url = `${apiBase}/repos/${owner}/${repo}/actions/runs/${runId}/cancel`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'spell-edge/1.0',
    },
  })
  if (res.status === 404) throw new WorkflowNotFoundError('WORKFLOW_NOT_FOUND')
  if (!res.ok) throw new GithubApiError('Failed to cancel workflow run', res.status)
}

export async function getWorkflowRun(
  token: string,
  ownerRepo: string,
  runId: number,
  apiBase = DEFAULT_API_BASE,
): Promise<any> {
  const [owner, repo] = ownerRepo.split("/")
  const url = `${apiBase}/repos/${owner}/${repo}/actions/runs/${runId}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "spell-edge/1.0",
    },
  })
  if (!res.ok) throw new GithubApiError("Failed to get workflow run", res.status)
  return await res.json()
}

export async function listArtifactsForRun(
  token: string,
  ownerRepo: string,
  runId: number,
  apiBase = DEFAULT_API_BASE,
): Promise<any[]> {
  const [owner, repo] = ownerRepo.split("/")
  const url = `${apiBase}/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "spell-edge/1.0",
    },
  })
  if (!res.ok) throw new GithubApiError("Failed to list artifacts", res.status)
  const json = (await res.json()) as any
  return (json.artifacts as any[]) || []
}

export async function getArtifactDownloadUrl(
  token: string,
  ownerRepo: string,
  artifactId: number,
  apiBase = DEFAULT_API_BASE,
): Promise<string | null> {
  const [owner, repo] = ownerRepo.split("/")
  const url = `${apiBase}/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "spell-edge/1.0",
    },
    redirect: "manual",
  } as RequestInit)
  if (res.status === 302) {
    return res.headers.get("location")
  }
  if (!res.ok) throw new GithubApiError("Failed to get artifact url", res.status)
  return null
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
