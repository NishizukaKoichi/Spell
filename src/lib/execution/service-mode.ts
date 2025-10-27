import type { ExecutionInput, ExecutionResult, ExecutionService } from './types'

/**
 * Service Mode Execution
 *
 * Executes spells on WASM runtime with ultra-low latency (<100ms).
 * This mode is suitable for:
 * - Real-time operations
 * - High-frequency executions
 * - Latency-sensitive tasks
 */
export class ServiceExecutionService implements ExecutionService {
  private readonly wasmRuntimeUrl: string

  constructor() {
    // URL to external WASM runtime service (e.g., Cloudflare Workers, Fastly Compute@Edge)
    this.wasmRuntimeUrl =
      process.env.WASM_RUNTIME_URL || 'https://wasm.spell.run/execute'
  }

  async execute(input: ExecutionInput): Promise<ExecutionResult> {
    const startTime = Date.now()

    try {
      // Call external WASM runtime
      const response = await fetch(this.wasmRuntimeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.WASM_RUNTIME_TOKEN || ''}`,
        },
        body: JSON.stringify({
          spellKey: input.spellKey,
          input: input.input,
          metadata: {
            castId: input.castId,
            spellId: input.spellId,
            userId: input.userId,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`WASM runtime execution failed: ${response.statusText}`)
      }

      const result = await response.json()
      const duration = Date.now() - startTime

      return {
        status: 'succeeded',
        duration,
        artifactUrl: result.artifactUrl,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        status: 'failed',
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
