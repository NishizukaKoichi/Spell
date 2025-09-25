#!/usr/bin/env node
import { connect, StringCodec, credsAuthenticator, tokenAuthenticator } from 'nats'
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import JSZip from 'jszip'
import path from 'node:path'
import process from 'node:process'
import os from 'node:os'
import { webcrypto } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const crypto = webcrypto

const log = (...args) => {
  const ts = new Date().toISOString()
  console.log(ts, ...args)
}

function requireEnv(key, fallback) {
  const value = process.env[key]
  if (value && value.trim()) return value
  if (fallback !== undefined) return fallback
  throw new Error(`Missing required environment variable ${key}`)
}

export async function buildConnection() {
  const servers = requireEnv('NATS_URL')
  const name = process.env.SERVICE_RUNNER_ID || `service-runner-${os.hostname()}-${process.pid}`
  const options = { servers, name }
  if (process.env.NATS_CREDS_FILE) {
    const credsRaw = await readFile(process.env.NATS_CREDS_FILE, 'utf8')
    options.authenticator = credsAuthenticator(new TextEncoder().encode(credsRaw))
  } else if (process.env.NATS_AUTH_TOKEN) {
    options.authenticator = tokenAuthenticator(process.env.NATS_AUTH_TOKEN)
  }
  return connect(options)
}

export async function createArtifact(run, extras = {}) {
  const zip = new JSZip()
  const result = extras.result ?? {
    run_id: run.run_id,
    cast_id: run.cast_id,
    spell_id: run.spell_id,
    tenant_id: run.tenant_id,
    input: run.input ?? {},
    generated_at: new Date().toISOString(),
  }
  zip.file('result.json', JSON.stringify(result, null, 2))
  const logs = extras.logs ?? buildSandboxLogs(run)
  zip.file('logs.ndjson', `${logs.join('\n')}\n`)
  const sbom = extras.sbom ?? generateSbom(run)
  zip.file('sbom.spdx.json', sbom)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

function buildSandboxLogs(run) {
  const now = new Date().toISOString()
  const base = {
    run_id: run.run_id,
    spell_id: run.spell_id,
    tenant_id: run.tenant_id,
  }
  return [
    JSON.stringify({ ...base, level: 'info', message: 'sandbox.start', at: now }),
    JSON.stringify({ ...base, level: 'info', message: 'sandbox.input', fields: Object.keys(run.input ?? {}) }),
  ]
}

function generateSbom(run) {
  const now = new Date().toISOString()
  return JSON.stringify(
    {
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      SPDXID: `SPDXRef-DOCUMENT-${run.run_id}`,
      name: `spell-${run.spell_id}`,
      documentNamespace: `https://spell.local/spdx/${run.run_id}`,
      creationInfo: {
        created: now,
        creators: ['Organization: Spell Platform'],
      },
      packages: [
        {
          SPDXID: `SPDXRef-Package-${run.spell_id}`,
          name: `spell-${run.spell_id}`,
          versionInfo: run.input?.version ?? 'unknown',
          supplier: 'Organization: Spell Platform',
        },
      ],
    },
    null,
    2,
  )
}

async function emitOtlpEvent(kind, run, attributes = {}) {
  const endpoint = process.env.OTLP_HTTP_ENDPOINT || process.env.OTLP_ENDPOINT
  if (!endpoint) return
  try {
    const payload = {
      kind,
      run_id: run.run_id,
      spell_id: run.spell_id,
      tenant_id: run.tenant_id,
      timestamp: new Date().toISOString(),
      ...attributes,
    }
    await fetch(endpoint.replace(/\/$/, ''), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    log('otlp emit failed', err instanceof Error ? err.message : String(err))
  }
}

async function executeSandbox(run) {
  const cmd = process.env.RUNNER_SANDBOX_CMD
  if (!cmd) {
    const artifact = await createArtifact(run)
    return { artifact, cost: run.estimate_cents ?? null }
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'spell-run-'))
  const inputPath = path.join(tmpDir, 'input.json')
  const outputDir = path.join(tmpDir, 'out')
  await mkdir(outputDir, { recursive: true })
  await writeFile(inputPath, JSON.stringify(run.input ?? {}, null, 2))

  const argEnv = process.env.RUNNER_SANDBOX_ARGS
  const extraArgs = argEnv ? argEnv.split(' ').filter(Boolean) : []
  const args = [...extraArgs, inputPath, outputDir]

  const stdoutChunks = []
  const stderrChunks = []
  const timeoutMs = Number.isFinite(run.timeout_sec) && run.timeout_sec > 0 ? run.timeout_sec * 1000 : 60000

  const start = performance.now()
  const child = spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      SPELL_RUN_ID: String(run.run_id),
      SPELL_TENANT_ID: String(run.tenant_id),
      SPELL_ID: String(run.spell_id),
    },
  })
  const exit = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('sandbox command timed out'))
    }, timeoutMs)
    child.stdout.on('data', (chunk) => stdoutChunks.push(chunk))
    child.stderr.on('data', (chunk) => stderrChunks.push(chunk))
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code)
    })
  })
  const durationMs = performance.now() - start

  if (exit !== 0) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    const stderr = Buffer.concat(stderrChunks).toString().trim()
    throw new Error(`Sandbox command failed (exit ${exit}): ${stderr}`)
  }

  let logs = []
  try {
    const content = await readFile(path.join(outputDir, 'logs.ndjson'), 'utf8')
    logs = content.split('\n').filter(Boolean)
  } catch (_) {}

  const stdoutText = Buffer.concat(stdoutChunks).toString().trim()
  if (stdoutText) {
    logs.push(
      JSON.stringify({ level: 'info', message: 'sandbox.stdout', data: stdoutText, run_id: run.run_id }),
    )
  }
  const stderrText = Buffer.concat(stderrChunks).toString().trim()
  if (stderrText) {
    logs.push(
      JSON.stringify({ level: 'warn', message: 'sandbox.stderr', data: stderrText, run_id: run.run_id }),
    )
  }
  if (logs.length === 0) logs = buildSandboxLogs(run)

  let sbom
  try {
    const sbomText = await readFile(path.join(outputDir, 'sbom.spdx.json'), 'utf8')
    sbom = sbomText
  } catch (_) {}

  let resultOverride
  try {
    const resultText = await readFile(path.join(outputDir, 'result.json'), 'utf8')
    resultOverride = JSON.parse(resultText)
  } catch (_) {}

  const artifact = await createArtifact(run, {
    logs,
    sbom: sbom ?? undefined,
    result: resultOverride,
  })
  await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  const runtimeCost = run.estimate_cents ?? Math.max(1, Math.ceil(durationMs / 1000))
  return { artifact, cost: runtimeCost }
}

export async function uploadArtifact(baseUrl, prefix, runId, buffer) {
  const key = `${prefix.replace(/\/$/, '')}/${runId}/result.zip`
  const target = new URL(`/api/artifacts/${key}`, baseUrl)
  const res = await fetch(target, { method: 'PUT', body: buffer })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Artifact upload failed: ${res.status} ${text}`)
  }
  const body = await res.json()
  const shaBuf = await crypto.subtle.digest('SHA-256', buffer)
  const sha256 = [...new Uint8Array(shaBuf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return {
    url: body.url || new URL(`/api/artifacts/${key}`, baseUrl).toString(),
    key,
    sha256,
    size: buffer.length,
  }
}

export async function postVerdict(baseUrl, token, castId, payload) {
  const target = new URL(`/api/v1/casts/${castId}:verdict`, baseUrl)
  const res = await fetch(target, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Verdict post failed (${res.status}): ${text}`)
  }
}

export function ttlEpochMs(days) {
  const ttlDays = Number.isFinite(Number(days)) && Number(days) > 0 ? Number(days) : 7
  return Date.now() + ttlDays * 24 * 60 * 60 * 1000
}

export async function handleRun(opts, job, state) {
  const { baseUrl, internalToken, artifactPrefix, artifactTtlDays } = opts
  if (job.mode && job.mode !== 'service') {
    log(`Skipping run ${job.run_id} (mode=${job.mode})`)
    return
  }
  log(`Run ${job.run_id} accepted (cast ${job.cast_id})`)
  const baseVerdict = {
    run_id: job.run_id,
    tenant_id: job.tenant_id,
    spell_id: job.spell_id,
  }
  await postVerdict(baseUrl, internalToken, job.cast_id, { ...baseVerdict, status: 'running' })
  await emitOtlpEvent('status', job, { status: 'running' })
  if (state.aborted) {
    log(`Run ${job.run_id} canceled before start`)
    await postVerdict(baseUrl, internalToken, job.cast_id, {
      ...baseVerdict,
      status: 'canceled',
      message: 'Canceled before start',
    })
    await emitOtlpEvent('status', job, { status: 'canceled', reason: 'before_start' })
    return
  }
  try {
    const { artifact, cost } = await executeSandbox(job)
    if (state.aborted) {
      log(`Run ${job.run_id} canceled during artifact generation`)
      await postVerdict(baseUrl, internalToken, job.cast_id, {
        ...baseVerdict,
        status: 'canceled',
        message: 'Canceled during generation',
      })
      await emitOtlpEvent('status', job, { status: 'canceled', reason: 'during_generation' })
      return
    }
    const uploaded = await uploadArtifact(baseUrl, artifactPrefix, job.run_id, artifact)
    if (state.aborted) {
      log(`Run ${job.run_id} canceled after artifact upload`)
      await postVerdict(baseUrl, internalToken, job.cast_id, {
        ...baseVerdict,
        status: 'canceled',
        message: 'Canceled after upload',
      })
      await emitOtlpEvent('status', job, { status: 'canceled', reason: 'after_upload' })
      return
    }
    const ttl = ttlEpochMs(artifactTtlDays)
    await postVerdict(baseUrl, internalToken, job.cast_id, {
      ...baseVerdict,
      status: 'succeeded',
      cost_cents: cost ?? job.estimate_cents ?? 0,
      artifact: {
        url: uploaded.url,
        key: uploaded.key,
        sha256: uploaded.sha256,
        size_bytes: uploaded.size,
        ttl_expires_at: ttl,
      },
    })
    log(`Run ${job.run_id} completed (artifact ${uploaded.url})`)
    await emitOtlpEvent('status', job, { status: 'succeeded', cost_cents: cost ?? job.estimate_cents ?? 0 })
  } catch (err) {
    log(`Run ${job.run_id} failed`, err)
    await postVerdict(baseUrl, internalToken, job.cast_id, {
      ...baseVerdict,
      status: 'failed',
      message: err instanceof Error ? err.message : 'runner_error',
    })
    await emitOtlpEvent('status', job, { status: 'failed', error: err instanceof Error ? err.message : String(err) })
  }
}

export async function main() {
  const baseUrl = requireEnv('WORKER_BASE_URL', 'https://koichinishizuka.com')
  const internalToken = requireEnv('INTERNAL_API_TOKEN')
  const artifactPrefix = process.env.RUNNER_ARTIFACT_PREFIX || 'artifacts'
  const artifactTtlDays = Number(process.env.RUNNER_ARTIFACT_TTL_DAYS || '7')
  const queue = process.env.SERVICE_RUNNER_QUEUE || 'service-runners'

  const nc = await buildConnection()
  log('Connected to NATS', nc.getServer())
  const sc = StringCodec()
  const activeRuns = new Map()

  const opts = { baseUrl, internalToken, artifactPrefix, artifactTtlDays }

  ;(async () => {
    const cancelSub = nc.subscribe('cancel.*', { queue })
    for await (const msg of cancelSub) {
      const subject = msg.subject
      const parts = subject.split('.')
      const runId = parts[1]
      if (!runId) continue
      const state = activeRuns.get(runId)
      if (state) {
        state.aborted = true
        log(`Run ${runId} marked as canceled`)
      }
    }
  })().catch((err) => log('cancel subscription error', err))

  const sub = nc.subscribe('run.*', { queue })
  for await (const msg of sub) {
    let payload
    try {
      payload = JSON.parse(sc.decode(msg.data))
    } catch (err) {
      log('Invalid run payload', err)
      continue
    }
    const runId = payload.run_id
    if (!runId) {
      log('Run payload missing run_id')
      continue
    }
    const state = { aborted: false }
    activeRuns.set(runId, state)
    try {
      await handleRun(opts, payload, state)
    } finally {
      activeRuns.delete(runId)
    }
  }
}

const modulePath = fileURLToPath(import.meta.url)
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null

if (entryPath && entryPath === modulePath) {
  main().catch((err) => {
    console.error('Fatal runner error', err)
    process.exit(1)
  })
}
