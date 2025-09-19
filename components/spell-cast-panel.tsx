"use client"

import { useState, useMemo } from "react"
import { Play, Loader2, Download, Clock, Hash, FileText, ShieldX, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useCastRunner } from "@/hooks/use-cast-runner"
import { CANCELABLE_STATUSES, type CastEvent } from "@/lib/cast-events"
import type { Spell } from "@/lib/types"

const currency = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 })

function formatBytes(bytes?: number) {
  if (!bytes || !Number.isFinite(bytes)) return "-"
  const units = ["B", "KB", "MB", "GB"]
  let idx = 0
  let value = bytes
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  return `${value.toFixed(1)} ${units[idx]}`
}

function formatExpiry(ms?: number) {
  if (!ms || !Number.isFinite(ms)) return "-"
  const diff = ms - Date.now()
  const hours = Math.max(0, Math.round(diff / (1000 * 60 * 60)))
  return `${new Date(ms).toLocaleString()} (あと${hours}時間)`
}

interface SpellCastPanelProps {
  spell: Spell
  variant?: "default" | "compact"
}

export function SpellCastPanel({ spell, variant = "default" }: SpellCastPanelProps) {
  const { toast } = useToast()
  const [canceling, setCanceling] = useState(false)
  const {
    state: castState,
    isCasting,
    startCast,
    cancel: cancelCast,
    status,
  } = useCastRunner({
    onEvent: (event: CastEvent) => {
      if (event.type === "completed") {
        toast({ title: "詠唱が完了しました", description: "成果物が利用可能です。" })
      }
      if (event.type === "failed") {
        toast({ title: "詠唱に失敗しました", description: event.data?.message ?? "詳細はログをご確認ください", variant: "destructive" })
      }
      if (event.type === "artifact_ready") {
        toast({ title: "成果物を生成しました", description: event.data?.url ?? "" })
      }
    },
  })

  const statusLabel = useMemo(() => {
    switch (status) {
      case "running":
        return "詠唱中"
      case "queued":
        return "待機中"
      case "succeeded":
        return "成功"
      case "failed":
        return "失敗"
      case "canceled":
        return "キャンセル"
      default:
        return "未実行"
    }
  }, [status])

  const handleCast = async () => {
    try {
      await startCast(spell.id, {})
      toast({ title: "Spell をキューに登録しました" })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Spell の実行中にエラーが発生しました"
      toast({ title: "実行エラー", description: message, variant: "destructive" })
    }
  }

  const handleCancel = async () => {
    if (!castState || !CANCELABLE_STATUSES.includes(castState.status)) return
    try {
      setCanceling(true)
      await cancelCast()
    } finally {
      setCanceling(false)
    }
  }

  const progressLabel = castState?.progress?.message ?? castState?.progress?.stage
  const percent = castState?.progress?.pct

  return (
    <div className={variant === "compact" ? "space-y-2" : "space-y-3"}>
      <Button className="w-full" size={variant === "compact" ? "sm" : "default"} onClick={handleCast} disabled={isCasting}>
        {isCasting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
        {isCasting ? "実行中..." : "詠唱実行"}
      </Button>

      {castState && (
        <div className="border rounded-lg bg-muted/40 p-3 text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{statusLabel}</Badge>
              <span className="text-muted-foreground">Run ID: {castState.runId ?? "--"}</span>
            </div>
            {status && CANCELABLE_STATUSES.includes(status) && (
              <Button variant="ghost" size="sm" onClick={handleCancel} disabled={canceling}>
                {canceling ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                キャンセル
              </Button>
            )}
          </div>

          {progressLabel && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Activity className="h-3 w-3" />
              <span>{progressLabel}</span>
              {Number.isFinite(percent) && percent != null ? <span>{Math.round(percent)}%</span> : null}
            </div>
          )}

          {castState.error && (
            <div className="flex items-center gap-1 text-destructive">
              <ShieldX className="h-3 w-3" />
              <span>{castState.error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">推定コスト</p>
              <p className="font-semibold">{currency.format((castState.estimateCents ?? 0) / 100)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-muted-foreground">実コスト</p>
              <p className="font-semibold">
                {castState.costCents != null ? currency.format((castState.costCents ?? 0) / 100) : "-"}
              </p>
            </div>
          </div>

          {castState.artifact?.url && (
            <div className="rounded border bg-background p-2 space-y-1 text-[11px] text-muted-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>成果物</span>
                </div>
                <Button asChild size="sm" variant="outline">
                  <a href={castState.artifact.url} target="_blank" rel="noreferrer">
                    <Download className="mr-1 h-3 w-3" />
                    開く
                  </a>
                </Button>
              </div>
              {castState.artifact.sha256 && (
                <div className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  <span>{castState.artifact.sha256.slice(0, 12)}…</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatExpiry(castState.artifact.ttlExpiresAt)}</span>
              </div>
              <div>サイズ: {formatBytes(castState.artifact.sizeBytes)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
