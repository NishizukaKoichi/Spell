"use client"

import { useMemo } from "react"
import { useSpellStore } from "@/lib/spell-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function currencyYen(cents: number | undefined) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(
    (cents ?? 0) / 100,
  )
}

export default function BillingPage() {
  const { spells } = useSpellStore()

  const { recurring, oneTime, topSpells } = useMemo(() => {
    const recurringSpells = spells.filter((spell) => spell.pricing_json.model !== "one_time")
    const oneTimeSpells = spells.filter((spell) => spell.pricing_json.model === "one_time")
    const ranking = [...spells]
      .filter((spell) => spell.executions && spell.price)
      .sort((a, b) => (b.executions ?? 0) - (a.executions ?? 0))
      .slice(0, 5)
    return { recurring: recurringSpells, oneTime: oneTimeSpells, topSpells: ranking }
  }, [spells])

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">課金と収益</h1>
        <p className="text-muted-foreground">Stripe で処理された取引と Spell ごとの収益概要を確認できます。</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>サブスクリプション型 Spell</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recurring.length === 0 && <p className="text-sm text-muted-foreground">該当する Spell がありません。</p>}
            {recurring.map((spell) => (
              <div key={spell.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{spell.name}</p>
                  <p className="text-xs text-muted-foreground">{spell.summary}</p>
                </div>
                <Badge variant="outline">{currencyYen(spell.pricing_json.amount_cents)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>単発課金 Spell</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {oneTime.length === 0 && <p className="text-sm text-muted-foreground">該当する Spell がありません。</p>}
            {oneTime.map((spell) => (
              <div key={spell.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{spell.name}</p>
                  <p className="text-xs text-muted-foreground">{spell.summary}</p>
                </div>
                <Badge variant="secondary">{currencyYen(spell.pricing_json.amount_cents)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>実行回数ランキング</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topSpells.length === 0 && <p className="text-sm text-muted-foreground">実行データがまだありません。</p>}
          {topSpells.map((spell) => {
            const executions = spell.executions ?? spell.stats?.executions ?? 0
            const revenue = (spell.price ?? 0) * executions
            return (
              <div key={spell.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{spell.name}</p>
                  <p className="text-xs text-muted-foreground">{executions.toLocaleString()} 回実行</p>
                </div>
                <Badge>{new Intl.NumberFormat("ja-JP").format(revenue)} 円</Badge>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
