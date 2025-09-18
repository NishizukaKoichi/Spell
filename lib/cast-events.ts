export type CastEventType =
  | "progress"
  | "artifact_ready"
  | "completed"
  | "failed"
  | "canceled"
  | "heartbeat"
  | "log"
  | "message"
  | "error"

export interface CastArtifactState {
  url: string
  sha256?: string
  sizeBytes?: number
  ttlExpiresAt?: number
}

export type CastStatus = "queued" | "running" | "succeeded" | "failed" | "canceled"

export interface CastRuntimeState {
  castId: number
  runId?: string
  estimateCents?: number
  status: CastStatus
  progress?: { stage: string; pct?: number; message?: string }
  artifact?: CastArtifactState
  costCents?: number
  error?: string
  updatedAt: number
}

export const TERMINAL_STATUSES: CastStatus[] = ["succeeded", "failed", "canceled"]
export const CANCELABLE_STATUSES: CastStatus[] = ["queued", "running"]

export const isTerminalStatus = (status: CastStatus) => TERMINAL_STATUSES.includes(status)

export type CastEvent =
  | { type: "progress"; data: { stage: string; pct?: number; message?: string } }
  | {
      type: "artifact_ready"
      data: { url: string; sha256?: string; size_bytes?: number | string; ttl_expires_at?: number | string }
    }
  | { type: "completed"; data: { status?: string; cost_cents?: number | string } }
  | { type: "failed"; data: { message?: string } }
  | { type: "canceled"; data: { by?: "user" | "system" } }
  | { type: "heartbeat"; data: { now?: string } }
  | { type: "log"; data: { level?: string; line?: string } }
  | { type: "message"; data: unknown }
  | { type: "error"; data: unknown }

export interface CreateCastStateInput {
  castId: number
  runId?: string
  estimateCents?: number
}

export const createInitialCastState = (input: CreateCastStateInput): CastRuntimeState => ({
  castId: input.castId,
  runId: input.runId,
  estimateCents: input.estimateCents,
  status: "queued",
  updatedAt: Date.now(),
})

export const reduceCastEvent = (
  prev: CastRuntimeState,
  event: CastEvent,
): CastRuntimeState => {
  const now = Date.now()
  switch (event.type) {
    case "progress": {
      return {
        ...prev,
        status: event.data.stage === "running" ? "running" : prev.status,
        progress: event.data,
        updatedAt: now,
      }
    }
    case "artifact_ready": {
      const ttlRaw = event.data.ttl_expires_at
      const ttl = typeof ttlRaw === "string" ? Number(ttlRaw) : ttlRaw
      const sizeRaw = event.data.size_bytes
      const size = typeof sizeRaw === "string" ? Number(sizeRaw) : sizeRaw
      return {
        ...prev,
        artifact: {
          url: event.data.url,
          sha256: event.data.sha256,
          sizeBytes: Number.isFinite(size) ? size : prev.artifact?.sizeBytes,
          ttlExpiresAt: Number.isFinite(ttl) ? ttl : prev.artifact?.ttlExpiresAt,
        },
        updatedAt: now,
      }
    }
    case "completed": {
      const cost = event.data.cost_cents
      return {
        ...prev,
        status: "succeeded",
        costCents: typeof cost === "string" ? Number(cost) : cost ?? prev.costCents,
        progress: undefined,
        updatedAt: now,
      }
    }
    case "failed": {
      return {
        ...prev,
        status: "failed",
        error: event.data.message ?? prev.error,
        progress: undefined,
        updatedAt: now,
      }
    }
    case "canceled": {
      return {
        ...prev,
        status: "canceled",
        progress: undefined,
        updatedAt: now,
      }
    }
    case "heartbeat":
      return { ...prev, updatedAt: now }
    default:
      return { ...prev, updatedAt: now }
  }
}
