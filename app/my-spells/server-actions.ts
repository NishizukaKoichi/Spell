"use server"

import { cookies } from "next/headers"

const API_BASE = process.env.NEXT_PUBLIC_EDGE_BASE_URL || "https://api.example.com"

function buildHeaders() {
  const cookieStore = cookies()
  const sid = cookieStore.get("sid")?.value
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (sid) headers.cookie = `sid=${sid}`
  return headers
}

export async function createSpellAction(input: {
  name: string
  summary: string
  description: string
  execution_mode: "workflow" | "service" | "clone"
  visibility: "public" | "unlisted" | "private"
  pricing_cents: number
  repo_ref?: string | null
  workflow_id?: string | null
  template_repo?: string | null
}) {
  const body = {
    name: input.name,
    summary: input.summary,
    description: input.description,
    execution_mode: input.execution_mode,
    visibility: input.visibility,
    pricing: { flat_cents: input.pricing_cents, currency: 'JPY' },
    input_schema: {},
    repo_ref: input.repo_ref,
    workflow_id: input.workflow_id,
    template_repo: input.template_repo,
    spell_key: `custom.${Date.now()}`,
  }
  const res = await fetch(`${API_BASE}/api/v1/spells`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(await res.text())
  }
}

export async function updateSpellAction(spellId: number, patch: Partial<{
  name: string
  summary: string
  description: string
  visibility: "public" | "unlisted" | "private"
  execution_mode: "workflow" | "service" | "clone"
  pricing_cents: number
  repo_ref?: string | null
  workflow_id?: string | null
  template_repo?: string | null
}>) {
  const body: Record<string, any> = { ...patch }
  if (patch.pricing_cents !== undefined) {
    body.pricing = { flat_cents: patch.pricing_cents, currency: 'JPY' }
    delete body.pricing_cents
  }
  const res = await fetch(`${API_BASE}/api/v1/spells/${spellId}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    body: JSON.stringify(body),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function publishSpellAction(spellId: number) {
  const res = await fetch(`${API_BASE}/api/v1/spells/${spellId}:publish`, {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
}

export async function archiveSpellAction(spellId: number) {
  const res = await fetch(`${API_BASE}/api/v1/spells/${spellId}:archive`, {
    method: 'POST',
    headers: buildHeaders(),
    credentials: 'include',
  })
  if (!res.ok) throw new Error(await res.text())
}
