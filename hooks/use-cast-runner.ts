"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { castSpell, cancelCast, onCastProgress } from "@/lib/api"
import {
  CastRuntimeState,
  CastStatus,
  CastEvent,
  createInitialCastState,
  isTerminalStatus,
  reduceCastEvent,
} from "@/lib/cast-events"

export interface UseCastRunnerOptions {
  onEvent?: (event: CastEvent) => void
}

export interface UseCastRunnerResult {
  state: CastRuntimeState | null
  isCasting: boolean
  startCast: (spellId: number | string, input: unknown) => Promise<CastRuntimeState>
  cancel: () => Promise<void>
  reset: () => void
  status: CastStatus | null
}

export function useCastRunner(options: UseCastRunnerOptions = {}): UseCastRunnerResult {
  const { onEvent } = options
  const [state, setState] = useState<CastRuntimeState | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const isCasting = !!state && !isTerminalStatus(state.status)

  const cleanup = useCallback(() => {
    if (stopRef.current) {
      stopRef.current()
      stopRef.current = null
    }
  }, [])

  useEffect(() => cleanup, [cleanup])

  const reset = useCallback(() => {
    cleanup()
    setState(null)
  }, [cleanup])

  const startCast = useCallback(async (spellId: number | string, input: unknown) => {
    cleanup()
    const response = await castSpell(spellId, input)
    const initial = createInitialCastState({
      castId: response.cast_id,
      runId: response.run_id,
      estimateCents: response.estimate_cents,
    })
    setState(initial)

    const stop = onCastProgress(response.cast_id, (event) => {
      setState((prev) => (prev ? reduceCastEvent(prev, event) : prev))
      onEvent?.(event)
    })
    stopRef.current = stop
    return initial
  }, [cleanup, onEvent])

  const cancel = useCallback(async () => {
    if (!state) return
    await cancelCast(state.castId)
    setState((prev) => (prev ? { ...prev, status: "canceled", updatedAt: Date.now() } : prev))
    cleanup()
  }, [cleanup, state])

  return {
    state,
    isCasting,
    startCast,
    cancel,
    reset,
    status: state?.status ?? null,
  }
}
