import type { CastEvent, CastEventType } from "@/lib/cast-events"

export async function castSpell(spellId: number | string, input: any) {
  const idem = crypto.randomUUID()
  const res = await fetch(`/api/v1/spells/${spellId}:cast`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": idem,
    },
    body: JSON.stringify({ input }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Cast failed: ${res.status} ${text}`)
  }
  return (await res.json()) as {
    run_id: string
    cast_id: number
    estimate_cents: number
    progress_sse: string
  }
}

const SSE_EVENT_TYPES: CastEventType[] = [
  "progress",
  "artifact_ready",
  "completed",
  "failed",
  "canceled",
  "heartbeat",
  "log",
]

export function onCastProgress(castId: number, handler: (event: CastEvent) => void) {
  const es = new EventSource(`/api/v1/casts/${castId}/events`)

  const wrap = (type: CastEventType) => (evt: MessageEvent) => {
    let data: any = evt.data
    if (typeof evt.data === "string") {
      try {
        data = JSON.parse(evt.data)
      } catch (_) {}
    }
    handler({ type, data } as CastEvent)
  }

  SSE_EVENT_TYPES.forEach((type) => es.addEventListener(type, wrap(type)))
  es.onmessage = wrap("message")
  es.onerror = (evt) => handler({ type: "error", data: evt } as CastEvent)

  return () => es.close()
}

export async function cancelCast(castId: number | string) {
  const res = await fetch(`/api/v1/casts/${castId}:cancel`, { method: "POST" })
  if (!res.ok && res.status !== 204) {
    const text = await res.text().catch(() => "")
    throw new Error(`Cancel failed: ${res.status} ${text}`)
  }
}
