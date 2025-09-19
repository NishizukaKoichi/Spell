"use client"

import { useEffect, useMemo, useState } from "react"
import { useSpellStore } from "@/lib/spell-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SpellCastPanel } from "@/components/spell-cast-panel"
import { LoadingSkeleton } from "@/components/loading-skeleton"

export default function MySpellsPage() {
  const { mySpells, updateSpell, deleteSpell, executeSpell, fetchMySpells, isFetchingSpells } = useSpellStore()
  const [query, setQuery] = useState("")

  useEffect(() => {
    fetchMySpells()
  }, [fetchMySpells])

  const filtered = useMemo(() => {
    if (!query) return mySpells
    const q = query.toLowerCase()
    return mySpells.filter((spell) => spell.name.toLowerCase().includes(q) || spell.summary.toLowerCase().includes(q))
  }, [mySpells, query])

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">マイスペル</h1>
          <p className="text-muted-foreground">自作 Spell の公開状況と実行結果を確認します。</p>
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Spell を検索"
          className="border rounded-md px-3 py-2 text-sm"
        />
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {isFetchingSpells && mySpells.length === 0 && (
          <div className="space-y-3">
            {[...Array(3)].map((_, idx) => (
              <LoadingSkeleton key={idx} className="h-32" />
            ))}
          </div>
        )}
        {!isFetchingSpells && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">作成した Spell が見つかりません。</p>
        )}
        {filtered.map((spell) => {
          const executions = spell.executions ?? spell.stats?.executions ?? 0
          const revenue = (spell.price ?? 0) * executions
          return (
            <Card key={spell.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {spell.name}
                  <Badge variant={spell.status === "published" ? "default" : "outline"}>{spell.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <p className="text-sm text-muted-foreground">{spell.summary}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>実行回数: {executions.toLocaleString()}</span>
                  <span>推定収益: {new Intl.NumberFormat("ja-JP").format(revenue)} 円</span>
                </div>
                <SpellCastPanel spell={spell} variant="compact" />
                <div className="mt-auto flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateSpell(spell.id, { status: spell.status === 'published' ? 'draft' : 'published', isActive: !(spell.isActive ?? true) })}
                  >
                    {spell.status === 'published' ? '非公開にする' : '公開する'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteSpell(spell.id)}>
                    削除
                  </Button>
                  <Button size="sm" onClick={() => executeSpell(spell.id)}>
                    実行テスト
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
