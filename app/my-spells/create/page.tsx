"use client"

import { SpellForm } from "../components/spell-form"
import { createSpellAction } from "../server-actions"

export default function CreateSpellPage() {
  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">新しい Spell を作成</h1>
        <p className="text-muted-foreground">基本情報を入力し、ドラフトとして保存します。</p>
      </header>
      <SpellForm onSubmit={createSpellAction} submitLabel="ドラフトとして保存" />
    </div>
  )
}
