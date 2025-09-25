"use client"

import { useEffect, useMemo } from "react"
import { useSpellStore } from "@/lib/spell-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

function currencyYen(cents: number | undefined) {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 }).format(
    (cents ?? 0) / 100,
  )
}

export default function BillingPage() {
  const {
    spells,
    ledgerEntries,
    recentCasts,
    billingCaps,
    isFetchingLedger,
    isFetchingCaps,
    fetchLedger,
    fetchRecentCasts,
    fetchBillingCaps,
  } = useSpellStore()

  useEffect(() => {
    void fetchLedger()
    void fetchRecentCasts()
    void fetchBillingCaps()
  }, [fetchLedger, fetchRecentCasts, fetchBillingCaps])

  const { recurring, oneTime, topSpells } = useMemo(() => {
    const recurringSpells = spells.filter((spell) => spell.pricing_json.model !== "one_time")
    const oneTimeSpells = spells.filter((spell) => spell.pricing_json.model === "one_time")
    const ranking = [...spells]
      .filter((spell) => spell.executions && spell.price)
      .sort((a, b) => (b.executions ?? 0) - (a.executions ?? 0))
      .slice(0, 5)
    return { recurring: recurringSpells, oneTime: oneTimeSpells, topSpells: ranking }
  }, [spells])

  const totalCharges = useMemo(
    () =>
      ledgerEntries
        .filter((entry) => entry.kind === "charge")
        .reduce((sum, entry) => sum + entry.amount_cents, 0),
    [ledgerEntries],
  )

  const totalEstimates = useMemo(
    () =>
      ledgerEntries
        .filter((entry) => entry.kind === "estimate")
        .reduce((sum, entry) => sum + entry.amount_cents, 0),
    [ledgerEntries],
  )

  const recentCastRows = useMemo(
    () =>
      recentCasts.slice(0, 8).map((cast) => ({
        id: cast.id,
        name: cast.spell_name ?? `#${cast.spell_id}`,
        status: cast.status,
        cost: cast.cost_cents,
        estimate: cast.estimate_cents,
        createdAt: cast.created_at,
      })),
    [recentCasts],
  )

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">課金と収益</h1>
        <p className="text-muted-foreground">Stripe で処理された取引と Spell ごとの収益概要を確認できます。</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>月次上限</CardTitle>
          </CardHeader>
          <CardContent>
            {isFetchingCaps ? (
              <p className="text-sm text-muted-foreground">読み込み中…</p>
            ) : billingCaps?.monthly_cents != null ? (
              <div className="space-y-1">
                <p className="text-2xl font-semibold">{currencyYen(billingCaps.monthly_cents)}</p>
                <p className="text-xs text-muted-foreground">このテナントに設定されている月次 Cap</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">月次 Cap は未設定です。</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>累計上限</CardTitle>
          </CardHeader>
          <CardContent>
            {isFetchingCaps ? (
              <p className="text-sm text-muted-foreground">読み込み中…</p>
            ) : billingCaps?.total_cents != null ? (
              <div className="space-y-1">
                <p className="text-2xl font-semibold">{currencyYen(billingCaps.total_cents)}</p>
                <p className="text-xs text-muted-foreground">テナント全体の累計 Cap</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">累計 Cap は未設定です。</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>今月の推定コスト</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{currencyYen(totalEstimates)}</p>
            <p className="text-xs text-muted-foreground">最新の見積コスト合計</p>
            <p className="text-sm">
              確定コスト: <span className="font-medium">{currencyYen(totalCharges)}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>最近の課金イベント</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isFetchingLedger && <p className="text-sm text-muted-foreground">読み込み中…</p>}
            {!isFetchingLedger && ledgerEntries.length === 0 && (
              <p className="text-sm text-muted-foreground">取引履歴がありません。</p>
            )}
            {!isFetchingLedger &&
              ledgerEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {entry.kind === "charge"
                        ? "課金"
                        : entry.kind === "refund"
                        ? "返金"
                        : entry.kind === "credit"
                        ? "クレジット"
                        : "見積"}
                    </p>
                    <p className="text-xs text-muted-foreground">{new Date(entry.occurred_at).toLocaleString()}</p>
                  </div>
                  <Badge
                    className={cn(
                      entry.kind === "charge" && "bg-primary/10 text-primary",
                      entry.kind === "refund" && "bg-amber-100 text-amber-900",
                      entry.kind === "credit" && "bg-emerald-100 text-emerald-900",
                    )}
                    variant="outline"
                  >
                    {currencyYen(entry.amount_cents)}
                  </Badge>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近の詠唱</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentCastRows.length === 0 && <p className="text-sm text-muted-foreground">詠唱履歴がありません。</p>}
            {recentCastRows.map((cast) => (
              <div key={cast.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{cast.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(cast.createdAt).toLocaleString()} ・ 見積 {currencyYen(cast.estimate)}
                  </p>
                </div>
                <Badge
                  variant={cast.status === "succeeded" ? "default" : cast.status === "failed" ? "destructive" : "secondary"}
                >
                  {cast.status}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

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
