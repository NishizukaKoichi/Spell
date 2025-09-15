export async function castSpell(spellId: number | string, input: any) {
  const idem = crypto.randomUUID()
  const res = await fetch(`/api/v1/spells/${spellId}:cast`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': idem,
    },
    body: JSON.stringify({ input }),
  })
  if (!res.ok) throw new Error(`Cast failed: ${res.status}`)
  return (await res.json()) as {
    run_id: string
    cast_id: number
    estimate_cents: number
    progress_sse: string
  }
}

export function onCastProgress(castId: number, cb: (evt: MessageEvent) => void) {
  const es = new EventSource(`/api/v1/casts/${castId}/events`)
  es.onmessage = cb
  return () => es.close()
}

