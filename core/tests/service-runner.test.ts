// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import JSZip from 'jszip'
import { createArtifact, handleRun, ttlEpochMs } from '../service-runner.mjs'

type FetchCall = Parameters<typeof fetch>

const originalFetch = global.fetch

let fetchMock: ReturnType<typeof vi.fn>
let consoleSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchMock = vi.fn()
  global.fetch = fetchMock as any
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  global.fetch = originalFetch
  consoleSpy.mockRestore()
  vi.restoreAllMocks()
})

describe('service runner helpers', () => {
  it('creates artifact zip with result.json', async () => {
    const buffer = await createArtifact({
      run_id: 'run-123',
      cast_id: '456',
      spell_id: '789',
      tenant_id: '42',
      input: { foo: 'bar' },
    })

    const zip = await JSZip.loadAsync(buffer)
    const file = zip.file('result.json')
    expect(file).toBeTruthy()
    const json = await file!.async('string')
    const data = JSON.parse(json)
    expect(data).toMatchObject({
      run_id: 'run-123',
      cast_id: '456',
      spell_id: '789',
      tenant_id: '42',
      input: { foo: 'bar' },
    })
  })

  it('computes TTL in the future', () => {
    const ttl = ttlEpochMs(2)
    const diff = ttl - Date.now()
    expect(diff).toBeGreaterThan(0)
    expect(diff).toBeLessThanOrEqual(2 * 24 * 60 * 60 * 1000 + 2000)
  })
})

describe('handleRun', () => {
  const opts = {
    baseUrl: 'https://worker.test',
    internalToken: 'internal-token',
    artifactPrefix: 'artifacts',
    artifactTtlDays: 7,
  }

  function buildJob(overrides: Partial<any> = {}) {
    return {
      run_id: 'run-1',
      cast_id: '101',
      spell_id: '555',
      tenant_id: '333',
      estimate_cents: 25,
      input: { foo: 'bar' },
      ...overrides,
    }
  }

  it('uploads artifact and posts succeeded verdict', async () => {
    const responses = [
      new Response('{}', { status: 200 }),
      new Response(JSON.stringify({ url: 'https://files.test/artifacts/run-1/result.zip' }), { status: 200 }),
      new Response('{}', { status: 200 }),
    ]
    fetchMock.mockImplementation(() => Promise.resolve(responses.shift()!))

    const state = { aborted: false }
    await handleRun(opts, buildJob(), state)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const firstCall = fetchMock.mock.calls[0] as FetchCall
    expect(firstCall[0].toString()).toContain('/api/v1/casts/101:verdict')

    const uploadCall = fetchMock.mock.calls[1] as FetchCall
    const uploadInit = uploadCall[1] || {}
    expect((uploadInit.method || 'PUT').toUpperCase()).toBe('PUT')

    const finalCall = fetchMock.mock.calls[2] as FetchCall
    const finalBody = JSON.parse(finalCall[1]!.body as string)
    expect(finalBody.status).toBe('succeeded')
    expect(finalBody.artifact.url).toBe('https://files.test/artifacts/run-1/result.zip')
    expect(finalBody.artifact.sha256).toHaveLength(64)
  })

  it('marks run as canceled when aborted before artifact generation', async () => {
    const responses = [new Response('{}', { status: 200 }), new Response('{}', { status: 200 })]
    fetchMock.mockImplementation(() => Promise.resolve(responses.shift()!))

    const state = { aborted: true }
    await handleRun(opts, buildJob(), state)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const cancelBody = JSON.parse(fetchMock.mock.calls[1][1].body as string)
    expect(cancelBody.status).toBe('canceled')
    expect(cancelBody.message).toContain('Canceled')
  })

  it('reports failure when artifact upload fails', async () => {
    const responses = [
      new Response('{}', { status: 200 }),
      new Response('error', { status: 500 }),
      new Response('{}', { status: 200 }),
    ]
    fetchMock.mockImplementation(() => Promise.resolve(responses.shift()!))

    const state = { aborted: false }
    await handleRun(opts, buildJob(), state)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const failureBody = JSON.parse(fetchMock.mock.calls[2][1].body as string)
    expect(failureBody.status).toBe('failed')
    expect(failureBody.message).toBeTruthy()
  })
})
