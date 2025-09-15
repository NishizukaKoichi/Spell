import { SpellSidebar } from "@/components/spell-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Star,
  Play,
  Download,
  Zap,
  Clock,
  Users,
  Shield,
  FileText,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Heart,
  Share2,
} from "lucide-react"

// モックデータ - 実際の実装では動的に取得
const spellData = {
  id: 1,
  name: "PDF生成API",
  description: "HTMLからPDFを生成する高性能なAPI。カスタムテンプレート対応、日本語フォント完全サポート。",
  longDescription: `
この高性能PDF生成APIは、HTMLコンテンツを美しいPDFドキュメントに変換します。
企業レベルの品質と信頼性を提供し、大量処理にも対応しています。

主な特徴：
• 日本語フォント完全サポート（ヒラギノ、游ゴシック等）
• カスタムCSS/HTMLテンプレート対応
• ヘッダー・フッター・透かし機能
• バッチ処理対応（最大100ファイル同時）
• 高速処理（平均2秒/ページ）
• セキュアな一時ファイル管理
  `,
  author: "dev-team",
  avatar: "/developer-working.png",
  price: 500,
  currency: "¥",
  rating: 4.8,
  totalRatings: 156,
  executions: 1234,
  mode: "service",
  category: "文書処理",
  tags: ["PDF", "HTML", "API", "日本語"],
  lastUpdated: "2日前",
  version: "v2.1.0",
  featured: true,
  inputSchema: {
    html: { type: "string", required: true, description: "変換するHTMLコンテンツ" },
    options: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["A4", "A3", "Letter"], default: "A4" },
        orientation: { type: "string", enum: ["portrait", "landscape"], default: "portrait" },
        margin: { type: "string", default: "20mm" },
        header: { type: "string", description: "ヘッダーHTML（オプション）" },
        footer: { type: "string", description: "フッターHTML（オプション）" },
      },
    },
  },
  examples: [
    {
      title: "基本的な使用例",
      input: {
        html: "<h1>Hello World</h1><p>これはテストPDFです。</p>",
        options: { format: "A4", orientation: "portrait" },
      },
    },
    {
      title: "カスタムヘッダー・フッター",
      input: {
        html: "<div>メインコンテンツ</div>",
        options: {
          format: "A4",
          header: "<div style='text-align: center;'>会社名</div>",
          footer: "<div style='text-align: center;'>ページ {{page}}</div>",
        },
      },
    },
  ],
  recentExecutions: [
    { id: 1, status: "成功", time: "5分前", duration: "2.3秒", cost: 500 },
    { id: 2, status: "成功", time: "1時間前", duration: "1.8秒", cost: 500 },
    { id: 3, status: "失敗", time: "3時間前", duration: "0.5秒", cost: 0, error: "無効なHTML" },
    { id: 4, status: "成功", time: "1日前", duration: "3.1秒", cost: 500 },
  ],
}

export default function SpellDetailPage({ params }: { params: { id: string } }) {
  return (
    <SpellSidebar>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={spellData.avatar || "/placeholder.svg"} />
                <AvatarFallback>{spellData.author[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold text-balance">{spellData.name}</h1>
                <p className="text-muted-foreground">
                  by {spellData.author} • {spellData.version} • {spellData.lastUpdated}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{spellData.rating}</span>
                <span className="text-muted-foreground">({spellData.totalRatings}件)</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{spellData.executions}回実行</span>
              </div>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <Zap className="h-3 w-3 mr-1" />
                {spellData.mode}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Heart className="h-4 w-4 mr-1" />
              お気に入り
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="h-4 w-4 mr-1" />
              共有
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* メインコンテンツ */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">概要</TabsTrigger>
                <TabsTrigger value="execute">実行</TabsTrigger>
                <TabsTrigger value="docs">ドキュメント</TabsTrigger>
                <TabsTrigger value="history">履歴</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>説明</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed">{spellData.description}</p>
                    <div className="mt-4 whitespace-pre-line text-sm">{spellData.longDescription}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>タグ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {spellData.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>使用例</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {spellData.examples.map((example, i) => (
                      <div key={i} className="space-y-2">
                        <h4 className="font-medium">{example.title}</h4>
                        <div className="bg-muted p-3 rounded-lg">
                          <pre className="text-sm overflow-x-auto">{JSON.stringify(example.input, null, 2)}</pre>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="execute" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Play className="h-5 w-5" />
                      Spell実行
                    </CardTitle>
                    <CardDescription>
                      入力パラメータを設定してSpellを実行します。実行前に見積もり費用を確認できます。
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="html">HTMLコンテンツ *</Label>
                      <Textarea
                        id="html"
                        placeholder="<h1>Hello World</h1><p>変換するHTMLを入力してください</p>"
                        className="min-h-[120px] font-mono"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="format">用紙サイズ</Label>
                        <select id="format" className="w-full px-3 py-2 border border-input bg-background rounded-md">
                          <option value="A4">A4</option>
                          <option value="A3">A3</option>
                          <option value="Letter">Letter</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="orientation">向き</Label>
                        <select
                          id="orientation"
                          className="w-full px-3 py-2 border border-input bg-background rounded-md"
                        >
                          <option value="portrait">縦</option>
                          <option value="landscape">横</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="margin">余白</Label>
                      <Input id="margin" placeholder="20mm" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="header">ヘッダーHTML（オプション）</Label>
                      <Input id="header" placeholder="<div>ヘッダーコンテンツ</div>" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="footer">フッターHTML（オプション）</Label>
                      <Input id="footer" placeholder="<div>フッターコンテンツ</div>" />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">見積もり費用</p>
                        <p className="text-sm text-muted-foreground">基本料金 + 処理時間</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-accent">¥500</p>
                        <p className="text-sm text-muted-foreground">約2-3秒</p>
                      </div>
                    </div>

                    <Button className="w-full" size="lg">
                      <Play className="h-4 w-4 mr-2" />
                      Spellを実行する
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="docs" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      API仕様
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">入力スキーマ</h4>
                      <div className="bg-muted p-3 rounded-lg">
                        <pre className="text-sm overflow-x-auto">{JSON.stringify(spellData.inputSchema, null, 2)}</pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">レスポンス形式</h4>
                      <div className="bg-muted p-3 rounded-lg">
                        <pre className="text-sm overflow-x-auto">
                          {JSON.stringify(
                            {
                              success: true,
                              data: {
                                pdf_url: "https://artifacts.spell.dev/run_123/result.pdf",
                                sha256: "abc123...",
                                pages: 1,
                                size_bytes: 45231,
                              },
                              execution_time_ms: 2300,
                              cost_cents: 500,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">エラーコード</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <code>400</code>
                          <span>無効な入力パラメータ</span>
                        </div>
                        <div className="flex justify-between">
                          <code>402</code>
                          <span>予算上限超過</span>
                        </div>
                        <div className="flex justify-between">
                          <code>429</code>
                          <span>レート制限</span>
                        </div>
                        <div className="flex justify-between">
                          <code>500</code>
                          <span>内部エラー</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      実行履歴
                    </CardTitle>
                    <CardDescription>このSpellの最近の実行結果を確認できます</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {spellData.recentExecutions.map((execution) => (
                        <div key={execution.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            {execution.status === "成功" && <CheckCircle className="h-4 w-4 text-green-500" />}
                            {execution.status === "失敗" && <AlertCircle className="h-4 w-4 text-destructive" />}
                            <div>
                              <p className="font-medium">実行 #{execution.id}</p>
                              <p className="text-sm text-muted-foreground">
                                {execution.time} • {execution.duration}
                                {execution.error && ` • ${execution.error}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant={execution.status === "成功" ? "default" : "destructive"}>
                              {execution.status}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">¥{execution.cost}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* サイドバー */}
          <div className="space-y-6">
            {/* 価格・実行ボタン */}
            <Card>
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div>
                    <div className="text-3xl font-bold text-accent">
                      {spellData.currency}
                      {spellData.price.toLocaleString()}
                    </div>
                    <p className="text-sm text-muted-foreground">実行あたり</p>
                  </div>
                  <Button className="w-full" size="lg">
                    <Play className="h-4 w-4 mr-2" />
                    今すぐ実行
                  </Button>
                  <Button variant="outline" className="w-full bg-transparent">
                    <Download className="h-4 w-4 mr-2" />
                    テンプレートをクローン
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 統計情報 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">統計情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">総実行回数</span>
                  <span className="font-medium">{spellData.executions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">成功率</span>
                  <span className="font-medium">98.2%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">平均実行時間</span>
                  <span className="font-medium">2.3秒</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最終更新</span>
                  <span className="font-medium">{spellData.lastUpdated}</span>
                </div>
              </CardContent>
            </Card>

            {/* セキュリティ情報 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  セキュリティ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">コード署名済み</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">セキュリティ監査済み</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">SBOM生成対応</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">データ暗号化</span>
                </div>
              </CardContent>
            </Card>

            {/* 作者情報 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">作者</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={spellData.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{spellData.author[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{spellData.author}</p>
                    <p className="text-sm text-muted-foreground">認証済み開発者</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-3 bg-transparent" size="sm">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  プロフィールを見る
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SpellSidebar>
  )
}
