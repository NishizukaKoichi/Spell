#!/usr/bin/env node
import { connect, StringCodec, credsAuthenticator, tokenAuthenticator } from 'nats'
import { readFile } from 'node:fs/promises'
import JSZip from 'jszip'
import process from 'node:process'
import os from 'node:os'
import { webcrypto } from 'node:crypto'

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

async function buildConnection() {
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

async function createArtifact(run) {
  const zip = new JSZip()
  zip.file('result.json', JSON.stringify({
    run_id: run.run_id,
    cast_id: run.cast_id,
    spell_id: run.spell_id,
    tenant_id: run.tenant_id,
    input: run.input ?? {},
    generated_at: new Date().toISOString(),
  }, null, 2))
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

async function uploadArtifact(baseUrl, prefix, runId, buffer) {
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

async function postVerdict(baseUrl, token, castId, payload) {
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

function ttlEpochMs(days) {
  const ttlDays = Number.isFinite(Number(days)) && Number(days) > 0 ? Number(days) : 7
  return Date.now() + ttlDays * 24 * 60 * 60 * 1000
}

async function handleRun(opts, job, state) {
  const { baseUrl, internalToken, artifactPrefix, artifactTtlDays } = opts
  if (job.mode && job.mode !== 'service') {
    log(`Skipping run ${job.run_id} (mode=${job.mode})`)
    return
  }
  log(`Run ${job.run_id} accepted (cast ${job.cast_id})`)
  await postVerdict(baseUrl, internalToken, job.cast_id, { run_id: job.run_id, status: 'running' })
  if (state.aborted) {
    log(`Run ${job.run_id} canceled before start`)
    await postVerdict(baseUrl, internalToken, job.cast_id, { run_id: job.run_id, status: 'canceled', message: 'Canceled before start' })
    return
  }
  try {
    const buffer = await createArtifact(job)
    if (state.aborted) {
      log(`Run ${job.run_id} canceled during artifact generation`)
      await postVerdict(baseUrl, internalToken, job.cast_id, { run_id: job.run_id, status: 'canceled', message: 'Canceled during generation' })
      return
    }
    const uploaded = await uploadArtifact(baseUrl, artifactPrefix, job.run_id, buffer)
    if (state.aborted) {
      log(`Run ${job.run_id} canceled after artifact upload`)
      await postVerdict(baseUrl, internalToken, job.cast_id, { run_id: job.run_id, status: 'canceled', message: 'Canceled after upload' })
      return
    }
    const ttl = ttlEpochMs(artifactTtlDays)
    await postVerdict(baseUrl, internalToken, job.cast_id, {
      run_id: job.run_id,
      status: 'succeeded',
      cost_cents: job.estimate_cents ?? 0,
      artifact: {
        url: uploaded.url,
        key: uploaded.key,
        sha256: uploaded.sha256,
        size_bytes: uploaded.size,
        ttl_expires_at: ttl,
      },
    })
    log(`Run ${job.run_id} completed (artifact ${uploaded.url})`)
  } catch (err) {
    log(`Run ${job.run_id} failed`, err)
    await postVerdict(baseUrl, internalToken, job.cast_id, {
      run_id: job.run_id,
      status: 'failed',
      message: err instanceof Error ? err.message : 'runner_error',
    })
  }
}

async function main() {
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

  const sub = nc.subscribe('spell.run.*', { queue })
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

main().catch((err) => {
  console.error('Fatal runner error', err)
  process.exit(1)
})
