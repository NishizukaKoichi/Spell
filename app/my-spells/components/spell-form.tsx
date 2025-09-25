"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface SpellFormProps {
  initial?: {
    name?: string
    summary?: string
    description?: string | null
    execution_mode?: "workflow" | "service" | "clone"
    pricing?: number
    visibility?: "public" | "unlisted" | "private"
    repo_ref?: string | null
    workflow_id?: string | null
    template_repo?: string | null
  }
  onSubmit: (values: {
    name: string
    summary: string
    description: string
    execution_mode: "workflow" | "service" | "clone"
    visibility: "public" | "unlisted" | "private"
    pricing_cents: number
    repo_ref?: string | null
    workflow_id?: string | null
    template_repo?: string | null
  }) => Promise<void>
  submitLabel?: string
}

export function SpellForm({ initial, onSubmit, submitLabel = "保存" }: SpellFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState(initial?.name ?? "")
  const [summary, setSummary] = useState(initial?.summary ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [mode, setMode] = useState<"workflow" | "service" | "clone">(initial?.execution_mode ?? "service")
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">(initial?.visibility ?? "private")
  const [priceCents, setPriceCents] = useState(initial?.pricing ?? 5000)
  const [repoRef, setRepoRef] = useState(initial?.repo_ref ?? "")
  const [workflowId, setWorkflowId] = useState(initial?.workflow_id ?? "")
  const [templateRepo, setTemplateRepo] = useState(initial?.template_repo ?? "")
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Spell 名を入力してください", variant: "destructive" })
      return
    }
    if (!summary.trim()) {
      toast({ title: "概要を入力してください", variant: "destructive" })
      return
    }

    if (mode === "workflow" && !workflowId.trim()) {
      toast({ title: "Workflow ID を入力してください", variant: "destructive" })
      return
    }

    if (mode === "clone" && !templateRepo.trim()) {
      toast({ title: "テンプレートリポジトリを入力してください", variant: "destructive" })
      return
    }

    setIsSaving(true)
    try {
      await onSubmit({
        name: name.trim(),
        summary: summary.trim(),
        description: description.trim(),
        execution_mode: mode,
        visibility,
        pricing_cents: priceCents,
        repo_ref: repoRef.trim() || undefined,
        workflow_id: workflowId.trim() || undefined,
        template_repo: templateRepo.trim() || undefined,
      })
      toast({ title: "保存しました" })
      router.push("/my-spells")
    } catch (err: any) {
      toast({
        title: "保存に失敗しました",
        description: err?.message || "不明なエラー",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
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
          <label className="text-sm font-medium">詳細説明</label>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="詳細な説明" rows={4} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Visibility</label>
          <Select value={visibility} onValueChange={(value) => setVisibility(value as typeof visibility)}>
            <SelectTrigger>
              <SelectValue placeholder="可視性を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="unlisted">Unlisted</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
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
        <div className="space-y-2">
          <label className="text-sm font-medium">リポジトリ参照</label>
          <Input
            value={repoRef}
            onChange={(event) => setRepoRef(event.target.value)}
            placeholder="owner/repo@branch"
          />
        </div>
        {mode === "workflow" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Workflow ID</label>
            <Input
              value={workflowId}
              onChange={(event) => setWorkflowId(event.target.value)}
              placeholder=".github/workflows/spell-run.yml"
            />
          </div>
        )}
        {mode === "clone" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">テンプレートリポジトリ</label>
            <Input
              value={templateRepo}
              onChange={(event) => setTemplateRepo(event.target.value)}
              placeholder="owner/template-repo"
            />
          </div>
        )}
        <Button onClick={handleSubmit} disabled={isSaving} className="w-full">
          {isSaving ? "保存中..." : submitLabel}
        </Button>
      </CardContent>
    </Card>
  )
}
