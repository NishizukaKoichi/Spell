"use client"

import { useEffect, useMemo, useState } from "react"
import { useSpellStore } from "@/lib/spell-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { fetchSession, logout, type Session } from "@/lib/session"
import { cn } from "@/lib/utils"

const currency = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 })

const formatDateTime = (value?: string | null) => {
  if (!value) return "--"
  const ts = Date.parse(value)
  if (!Number.isFinite(ts)) return value
  return new Date(ts).toLocaleString()
}

export default function AccountPage() {
  const {
    stats,
    fetchBazaarSpells,
    fetchRecentCasts,
    fetchLedger,
    recentCasts,
    ledgerEntries,
    isFetchingCasts,
    isFetchingLedger,
  } = useSpellStore()
  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchBazaarSpells()
    void fetchRecentCasts()
    void fetchLedger()
  }, [fetchBazaarSpells, fetchRecentCasts, fetchLedger])

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const sess = await fetchSession()
        if (isMounted) {
          setSession(sess)
          setError(null)
        }
      } catch (err) {
        if (isMounted) {
          setSession(null)
          setError(err instanceof Error ? err.message : "セッション情報を取得できませんでした")
        }
      } finally {
        if (isMounted) setLoadingSession(false)
      }
    })()
    return () => {
      isMounted = false
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    setSession(null)
  }

  const userSection = useMemo(() => {
    if (loadingSession) {
      return (
        <div className="space-y-2">
          <LoadingSkeleton className="h-5" />
          <LoadingSkeleton className="h-5" />
          <LoadingSkeleton className="h-5" />
        </div>
      )
    }
    if (error) {
      return <p className="text-sm text-destructive">{error}</p>
    }
    if (session?.authenticated) {
      return (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">ユーザー</span>
            <Badge variant="outline">{session.user?.name ?? session.user?.sub ?? "登録ユーザー"}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">サブ</span>
            <Badge variant="secondary">{session.user?.sub ?? "---"}</Badge>
          </div>
        </>
      )
    }
    return <p className="text-sm text-muted-foreground">ログインしていません。</p>
  }, [loadingSession, error, session])

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">アカウント設定</h1>
          <p className="text-muted-foreground">利用状況や支払い設定を確認できます。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">プロフィール編集</Button>
          <Button variant="outline" onClick={handleLogout}>ログアウト</Button>
        </div>
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
        <CardContent className="space-y-2">{userSection}</CardContent>
      </Card>
    </div>
  )
}
