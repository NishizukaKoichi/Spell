export type ExecutionMode = 'workflow' | 'service' | 'clone'

export type ExecutionStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface ExecutionInput {
  castId: string
  spellId: string
  spellKey: string
  executionMode: ExecutionMode
  input: Record<string, unknown>
  userId: string
}

export interface ExecutionResult {
  status: ExecutionStatus
  duration?: number
  artifactUrl?: string
  errorMessage?: string
}

export interface ExecutionService {
  execute(input: ExecutionInput): Promise<ExecutionResult>
}
