"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useSpellStore } from "@/lib/spell-store"

export default function CreateSpellPage() {
  const router = useRouter()
  const { createSpell } = useSpellStore()
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [summary, setSummary] = useState("")
  const [mode, setMode] = useState<"workflow" | "service" | "clone">("service")
  const [priceCents, setPriceCents] = useState(5000)

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "Spell 名を入力してください", variant: "destructive" })
      return
    }
    createSpell({
      tenant_id: 1,
      name,
      summary,
      description: summary,
      spell_key: `custom.${Date.now()}`,
      visibility: "private",
      execution_mode: mode,
      pricing_json: { model: mode === "clone" ? "one_time" : "flat", currency: "JPY", amount_cents: priceCents },
      input_schema_json: {},
      status: "draft",
      author: { name: "あなた", avatar: "/placeholder.svg" },
      tags: [],
    })
    toast({ title: "Spell を作成しました", description: "マイスペル一覧に追加されました" })
    router.push("/my-spells")
  }

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold">新しい Spell を作成</h1>
        <p className="text-muted-foreground">基本情報を入力し、ドラフトとして保存します。</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Spell 情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">名前</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Spell 名" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">概要</label>
            <Textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Spell の概要" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">実行モード</label>
            <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
              <SelectTrigger>
                <SelectValue placeholder="モードを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Service Runner</SelectItem>
                <SelectItem value="workflow">GitHub Workflow</SelectItem>
                <SelectItem value="clone">Clone テンプレート</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">価格 (JPY)</label>
            <Input
              type="number"
              min={0}
              value={priceCents / 100}
              onChange={(event) => setPriceCents(Number(event.target.value) * 100)}
            />
          </div>
          <Button onClick={handleSubmit}>ドラフトとして保存</Button>
        </CardContent>
      </Card>
    </div>
  )
}
