"use client"

import { useEffect } from "react"
import { useSpellStore } from "@/lib/spell-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function AccountPage() {
  const { currentUser, stats, fetchBazaarSpells } = useSpellStore()

  useEffect(() => {
    void fetchBazaarSpells()
  }, [fetchBazaarSpells])

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">アカウント設定</h1>
          <p className="text-muted-foreground">利用状況や支払い設定を確認できます。</p>
        </div>
        <Button variant="secondary">プロフィール編集</Button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">登録 Spell 数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalSpells}</p>
            <p className="text-xs text-muted-foreground">公開済み Spell の合計</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">累計実行回数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalExecutions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">成功・失敗を含む全キャスト数</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">平均評価</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.averageRating.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">公開 Spell 全体の平均</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ユーザー情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tenant ID</span>
            <Badge variant="outline">{currentUser?.tenant_id ?? "未設定"}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">GitHub ユーザー</span>
            <Badge variant="secondary">{currentUser?.gh_user_id ?? "未連携"}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">役割</span>
            <Badge>{currentUser?.role ?? "caster"}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
