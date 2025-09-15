"use client"

import { SpellSidebar } from "@/components/spell-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { useSpellStore } from "@/lib/spell-store"
import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Code2,
  GitBranch,
  Zap,
  Download,
  Save,
  Eye,
  Upload,
  FileText,
  Settings,
  DollarSign,
  Globe,
  Lock,
  EyeOff,
  Plus,
  X,
  AlertCircle,
  CheckCircle,
} from "lucide-react"

export default function CreateSpellPage() {
  const { addSpell } = useSpellStore()
  const { toast } = useToast()
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
    mode: "service" as "workflow" | "service" | "clone",
    price: 500,
    currency: "¥",
    tags: [] as string[],
    visibility: "public",
    featured: false,
    isActive: false,
  })

  const [currentTag, setCurrentTag] = useState("")
  const [activeTab, setActiveTab] = useState("basic")

  const validateForm = () => {
    const errors = []
    if (!formData.name.trim()) errors.push("Spell名は必須です")
    if (!formData.description.trim()) errors.push("説明は必須です")
    if (!formData.category) errors.push("カテゴリを選択してください")
    if (formData.price <= 0) errors.push("価格は0より大きい値を入力してください")

    return errors
  }

  const getCompletionStatus = () => {
    const checks = [
      { label: "基本情報の入力", completed: formData.name && formData.description && formData.category },
      { label: "実行モードの設定", completed: formData.mode },
      { label: "価格設定", completed: formData.price > 0 },
      { label: "タグの追加", completed: formData.tags.length > 0 },
      { label: "公開設定", completed: formData.visibility },
    ]

    return checks
  }

  const handleAddTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()],
      }))
      setCurrentTag("")
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }))
  }

  const handleSaveDraft = () => {
    const errors = validateForm()
    if (errors.length > 0) {
      toast({
        title: "入力エラー",
        description: errors[0],
        variant: "destructive",
      })
      return
    }

    addSpell({
      ...formData,
      author: "開発者ユーザー",
      avatar: "/developer-avatar.png",
      lastUpdated: "今",
      featured: formData.featured,
      isActive: false,
    })

    toast({
      title: "下書きを保存しました",
      description: `${formData.name}が下書きとして保存されました。`,
    })

    router.push("/my-spells")
  }

  const handlePublish = () => {
    const errors = validateForm()
    if (errors.length > 0) {
      toast({
        title: "入力エラー",
        description: errors[0],
        variant: "destructive",
      })
      return
    }

    addSpell({
      ...formData,
      author: "開発者ユーザー",
      avatar: "/developer-avatar.png",
      lastUpdated: "今",
      featured: formData.featured,
      isActive: true,
    })

    toast({
      title: "Spellを公開しました",
      description: `${formData.name}が正常に公開されました。`,
    })

    router.push("/my-spells")
  }

  const completionChecks = getCompletionStatus()
  const completedCount = completionChecks.filter((check) => check.completed).length

  return (
    <SpellSidebar>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-balance">新しいSpell作成</h1>
            <p className="text-muted-foreground text-pretty">
              コードを実行可能なSpellとして公開し、他の開発者と共有しましょう。
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              プレビュー
            </Button>
            <Button onClick={handleSaveDraft}>
              <Save className="h-4 w-4 mr-2" />
              下書き保存
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* メインフォーム */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">基本情報</TabsTrigger>
                <TabsTrigger value="code">コード</TabsTrigger>
                <TabsTrigger value="pricing">価格設定</TabsTrigger>
                <TabsTrigger value="publish">公開設定</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>基本情報</CardTitle>
                    <CardDescription>Spellの名前、説明、カテゴリを設定します</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="spell-name">Spell名 *</Label>
                      <Input
                        id="spell-name"
                        placeholder="例: PDF生成API"
                        className="font-medium"
                        value={formData.name}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">短い説明 *</Label>
                      <Input
                        id="description"
                        placeholder="HTMLからPDFを生成する高性能なAPI"
                        maxLength={100}
                        value={formData.description}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="category">カテゴリ *</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="カテゴリを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="文書処理">文書処理</SelectItem>
                            <SelectItem value="画像処理">画像処理</SelectItem>
                            <SelectItem value="データサイエンス">データサイエンス</SelectItem>
                            <SelectItem value="通信">通信</SelectItem>
                            <SelectItem value="フロントエンド">フロントエンド</SelectItem>
                            <SelectItem value="バックエンド">バックエンド</SelectItem>
                            <SelectItem value="その他">その他</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="execution-mode">実行モード *</Label>
                        <Select
                          value={formData.mode}
                          onValueChange={(value: "workflow" | "service" | "clone") =>
                            setFormData((prev) => ({ ...prev, mode: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="実行モードを選択" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="workflow">
                              <div className="flex items-center gap-2">
                                <GitBranch className="h-4 w-4" />
                                <span>Workflow (GitHub Actions)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="service">
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4" />
                                <span>Service (コンテナ実行)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="clone">
                              <div className="flex items-center gap-2">
                                <Download className="h-4 w-4" />
                                <span>Clone (テンプレート)</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>タグ</Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {formData.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                            <X className="h-3 w-3 ml-1 cursor-pointer" onClick={() => handleRemoveTag(tag)} />
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="新しいタグを追加"
                          className="flex-1"
                          value={currentTag}
                          onChange={(e) => setCurrentTag(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                        />
                        <Button variant="outline" size="sm" onClick={handleAddTag}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="code" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Code2 className="h-5 w-5" />
                      コード設定
                    </CardTitle>
                    <CardDescription>実行するコードとリポジトリ情報を設定します</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="repo-ref">GitHubリポジトリ *</Label>
                      <Input id="repo-ref" placeholder="owner/repository@branch" className="font-mono" />
                      <p className="text-xs text-muted-foreground">例: myorg/pdf-generator@main</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="workflow-id">ワークフローファイル</Label>
                      <Input id="workflow-id" placeholder=".github/workflows/spell-run.yml" className="font-mono" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="input-schema">入力スキーマ (JSON Schema)</Label>
                      <Textarea
                        id="input-schema"
                        placeholder={`{
  "type": "object",
  "properties": {
    "html": {
      "type": "string",
      "description": "変換するHTMLコンテンツ"
    }
  },
  "required": ["html"]
}`}
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      価格設定
                    </CardTitle>
                    <CardDescription>Spellの価格モデルと料金を設定します</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="price">価格 (¥) *</Label>
                        <Input
                          id="price"
                          type="number"
                          placeholder="500"
                          min="1"
                          value={formData.price}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, price: Number.parseInt(e.target.value) || 0 }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency">通貨</Label>
                        <Select
                          value={formData.currency}
                          onValueChange={(value) => setFormData((prev) => ({ ...prev, currency: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="¥">日本円 (¥)</SelectItem>
                            <SelectItem value="$">米ドル ($)</SelectItem>
                            <SelectItem value="€">ユーロ (€)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">価格プレビュー</h4>
                      <div className="text-2xl font-bold text-accent">
                        {formData.currency}
                        {formData.price.toLocaleString()}
                      </div>
                      <p className="text-sm text-muted-foreground">実行あたり</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="publish" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      公開設定
                    </CardTitle>
                    <CardDescription>Spellの公開範囲とアクセス権限を設定します</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>公開範囲</Label>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="public"
                            name="visibility"
                            value="public"
                            checked={formData.visibility === "public"}
                            onChange={(e) => setFormData((prev) => ({ ...prev, visibility: e.target.value }))}
                          />
                          <Label htmlFor="public" className="flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            パブリック - 誰でも発見・実行可能
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="unlisted"
                            name="visibility"
                            value="unlisted"
                            checked={formData.visibility === "unlisted"}
                            onChange={(e) => setFormData((prev) => ({ ...prev, visibility: e.target.value }))}
                          />
                          <Label htmlFor="unlisted" className="flex items-center gap-2">
                            <EyeOff className="h-4 w-4" />
                            非公開 - URLを知っている人のみ
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="private"
                            name="visibility"
                            value="private"
                            checked={formData.visibility === "private"}
                            onChange={(e) => setFormData((prev) => ({ ...prev, visibility: e.target.value }))}
                          />
                          <Label htmlFor="private" className="flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            プライベート - 自分のみ
                          </Label>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="featured">注目Spellに推薦</Label>
                          <p className="text-sm text-muted-foreground">高品質なSpellをコミュニティに推薦します</p>
                        </div>
                        <Switch
                          id="featured"
                          checked={formData.featured}
                          onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, featured: checked }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* サイドバー */}
          <div className="space-y-6">
            {/* 公開チェックリスト */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  公開チェックリスト ({completedCount}/{completionChecks.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {completionChecks.map((check, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {check.completed ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-sm">{check.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* プレビュー */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">プレビュー</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="font-medium">{formData.name || "Spell名"}</h4>
                    <p className="text-sm text-muted-foreground">{formData.description || "説明"}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">{formData.mode}</Badge>
                    <span className="font-semibold text-accent">
                      {formData.currency}
                      {formData.price.toLocaleString()}
                    </span>
                  </div>
                  {formData.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {formData.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {formData.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{formData.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* アクション */}
            <div className="space-y-2">
              <Button
                className="w-full"
                size="lg"
                onClick={handlePublish}
                disabled={completedCount < completionChecks.length}
              >
                <Upload className="h-4 w-4 mr-2" />
                Spellを公開
              </Button>
              <Button variant="outline" className="w-full bg-transparent" onClick={handleSaveDraft}>
                <Save className="h-4 w-4 mr-2" />
                下書きとして保存
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SpellSidebar>
  )
}
