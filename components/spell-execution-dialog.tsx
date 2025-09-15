"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Play, Clock, CheckCircle, AlertCircle, Download, Copy } from "lucide-react"

interface ExecutionDialogProps {
  spellName: string
  price: number
  currency: string
  children: React.ReactNode
}

export function SpellExecutionDialog({ spellName, price, currency, children }: ExecutionDialogProps) {
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionStatus, setExecutionStatus] = useState<"idle" | "running" | "success" | "error">("idle")
  const [progress, setProgress] = useState(0)
  const [resultUrl, setResultUrl] = useState("")

  const handleExecute = async () => {
    setIsExecuting(true)
    setExecutionStatus("running")
    setProgress(0)

    // シミュレーション: 実際の実装では実際のAPI呼び出し
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setExecutionStatus("success")
          setResultUrl("https://artifacts.spell.dev/run_123/result.pdf")
          setIsExecuting(false)
          return 100
        }
        return prev + 10
      })
    }, 200)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            {spellName} を実行
          </DialogTitle>
          <DialogDescription>
            パラメータを設定してSpellを実行します。実行前に見積もり費用を確認してください。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 実行状態 */}
          {executionStatus !== "idle" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {executionStatus === "running" && (
                  <>
                    <Clock className="h-4 w-4 text-accent animate-pulse" />
                    <span className="font-medium">実行中...</span>
                  </>
                )}
                {executionStatus === "success" && (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium">実行完了</span>
                  </>
                )}
                {executionStatus === "error" && (
                  <>
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="font-medium">実行失敗</span>
                  </>
                )}
              </div>
              <Progress value={progress} className="h-2" />
              <div className="text-sm text-muted-foreground">
                {executionStatus === "running" && `進行状況: ${progress}%`}
                {executionStatus === "success" && "PDFの生成が完了しました"}
                {executionStatus === "error" && "エラーが発生しました"}
              </div>
            </div>
          )}

          {/* 結果表示 */}
          {executionStatus === "success" && resultUrl && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="font-medium text-green-700 dark:text-green-300">実行成功</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">結果ファイル:</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-background px-2 py-1 rounded">{resultUrl}</code>
                    <Button size="sm" variant="outline" onClick={() => copyToClipboard(resultUrl)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Button className="w-full" size="sm">
                  <Download className="h-3 w-3 mr-1" />
                  PDFをダウンロード
                </Button>
              </div>
            </div>
          )}

          {/* 入力フォーム */}
          {executionStatus === "idle" && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="html-input">HTMLコンテンツ *</Label>
                  <Textarea
                    id="html-input"
                    placeholder="<h1>Hello World</h1><p>変換するHTMLを入力してください</p>"
                    className="min-h-[120px] font-mono"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="format-select">用紙サイズ</Label>
                    <select
                      id="format-select"
                      className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    >
                      <option value="A4">A4</option>
                      <option value="A3">A3</option>
                      <option value="Letter">Letter</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orientation-select">向き</Label>
                    <select
                      id="orientation-select"
                      className="w-full px-3 py-2 border border-input bg-background rounded-md"
                    >
                      <option value="portrait">縦</option>
                      <option value="landscape">横</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="margin-input">余白</Label>
                  <Input id="margin-input" placeholder="20mm" />
                </div>
              </div>

              <Separator />

              {/* 見積もり */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">見積もり費用</p>
                  <p className="text-sm text-muted-foreground">基本料金 + 処理時間</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-accent">
                    {currency}
                    {price.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">約2-3秒</p>
                </div>
              </div>

              <Button className="w-full" size="lg" onClick={handleExecute} disabled={isExecuting}>
                <Play className="h-4 w-4 mr-2" />
                Spellを実行する
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
