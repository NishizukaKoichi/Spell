"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { SpellForm } from "../../components/spell-form"
import { updateSpellAction } from "../../server-actions"
import { useSpellStore } from "@/lib/spell-store"
import { LoadingSkeleton } from "@/components/loading-skeleton"

export default function EditSpellPage() {
  const params = useParams<{ id: string }>()
  const spellId = Number(params.id)
  const { mySpells, fetchMySpells } = useSpellStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchMySpells().finally(() => setIsLoading(false))
  }, [fetchMySpells])

  const spell = mySpells.find((s) => s.id === spellId)

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <LoadingSkeleton className="h-96" />
      </div>
    )
  }

  if (!spell) {
    return (
      <div className="max-w-3xl mx-auto py-10">
        <p className="text-sm text-muted-foreground">Spell が見つかりませんでした。</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Spell を編集</h1>
        <p className="text-muted-foreground">Spell のメタデータを更新します。</p>
      </header>
      <SpellForm
        initial={{
          name: spell.name,
          summary: spell.summary,
          description: spell.description,
          execution_mode: spell.execution_mode,
          visibility: spell.visibility,
          pricing: spell.pricing_json?.amount_cents,
          repo_ref: spell.repo_ref ?? null,
          workflow_id: spell.workflow_id ?? null,
          template_repo: spell.template_repo ?? null,
        }}
        onSubmit={async (values) => {
          await updateSpellAction(spellId, values)
          await fetchMySpells()
        }}
        submitLabel="更新"
      />
    </div>
  )
}
