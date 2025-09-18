"use client"

import { useMemo, useState } from "react"
import { useSpellStore } from "@/lib/spell-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function CatalogPage() {
  const { spells, downloadSpell, executeSpell } = useSpellStore()
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<"all" | "workflow" | "service" | "clone">("all")

  const filtered = useMemo(() => {
    return spells.filter((spell) => {
      if (spell.status !== "published") return false
      if (mode !== "all" && spell.execution_mode !== mode) return false
      if (!query) return true
      const q = query.toLowerCase()
      return (
        spell.name.toLowerCase().includes(q) ||
        spell.summary.toLowerCase().includes(q) ||
        spell.spell_key.toLowerCase().includes(q)
      )
    })
  }, [spells, query, mode])

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Spell カタログ</h1>
          <p className="text-muted-foreground">公開中の Spell を検索・購入できます。</p>
        </div>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="キーワードを入力"
            className="border rounded-md px-3 py-2 text-sm"
          />
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
            className="border rounded-md px-3 py-2 text-sm"
          >
            <option value="all">すべて</option>
            <option value="workflow">Workflow</option>
            <option value="service">Service</option>
            <option value="clone">Clone</option>
          </select>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {filtered.map((spell) => (
          <Card key={spell.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-lg">
                {spell.name}
                <Badge variant="outline">{spell.execution_mode}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <p className="text-sm text-muted-foreground">{spell.summary}</p>
              <div className="flex flex-wrap gap-1">
                {spell.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <div className="mt-auto flex items-center justify-between">
                <span className="text-sm font-medium">
                  {new Intl.NumberFormat("ja-JP", { style: "currency", currency: spell.pricing_json.currency }).format(
                    spell.pricing_json.amount_cents / 100,
                  )}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => downloadSpell(spell.id)}>
                    購入
                  </Button>
                  <Button size="sm" onClick={() => executeSpell(spell.id)}>
                    サンプル実行
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">該当する Spell が見つかりませんでした。</p>
        )}
      </div>
    </div>
  )
}
