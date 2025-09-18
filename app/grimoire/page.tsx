"use client"

import { useMemo, useState } from "react"
import { useSpellStore } from "@/lib/spell-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SpellCastPanel } from "@/components/spell-cast-panel"

const TABS = [
  { id: "purchased", label: "購入済み" },
  { id: "casting", label: "詠唱" },
  { id: "creation", label: "作成" },
] as const

type TabId = (typeof TABS)[number]["id"]

export default function GrimoirePage() {
  const { purchasedSpells, mySpells, registerSpell, unregisterSpell, getRegisteredSpells } = useSpellStore()
  const [tab, setTab] = useState<TabId>("purchased")

  const registeredSpells = useMemo(() => getRegisteredSpells(), [getRegisteredSpells])

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">Grimoire</h1>
        <p className="text-muted-foreground">あなたの Spell コレクションと詠唱状況を管理します。</p>
      </header>

      <div className="flex gap-2">
        {TABS.map((item) => (
          <Button key={item.id} variant={tab === item.id ? "default" : "outline"} onClick={() => setTab(item.id)}>
            {item.label}
          </Button>
        ))}
      </div>

      {tab === "purchased" && (
        <div className="grid gap-4 md:grid-cols-2">
          {purchasedSpells.length === 0 && <p className="text-sm text-muted-foreground">まだ Spell を購入していません。</p>}
          {purchasedSpells.map((spell) => (
            <Card key={spell.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {spell.name}
                  <Badge variant="outline">{spell.execution_mode}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{spell.summary}</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => registerSpell(spell.id)}>
                    魔導書に登録
                  </Button>
                  <Button size="sm" variant="outline">
                    ドキュメント
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "casting" && (
        <div className="grid gap-4 md:grid-cols-2">
          {registeredSpells.length === 0 && <p className="text-sm text-muted-foreground">詠唱可能な Spell がありません。</p>}
          {registeredSpells.map((spell) => (
            <Card key={spell.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {spell.name}
                  <Badge variant="secondary">{spell.execution_mode}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{spell.summary}</p>
                <SpellCastPanel spell={spell} />
                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => unregisterSpell(spell.id)}>
                    登録解除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "creation" && (
        <div className="grid gap-4 md:grid-cols-2">
          {mySpells.length === 0 && <p className="text-sm text-muted-foreground">まだ Spell を作成していません。</p>}
          {mySpells.map((spell) => (
            <Card key={spell.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {spell.name}
                  <Badge variant={spell.status === "published" ? "default" : "outline"}>{spell.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">{spell.summary}</p>
                <p className="text-xs text-muted-foreground">最終更新: {spell.lastUpdated ?? "--"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
