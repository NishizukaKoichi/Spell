"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Settings,
  CreditCard,
  Download,
  Star,
  ChevronRight,
  LogOut,
  Bell,
  Shield,
  HelpCircle,
  TrendingUp,
  Zap,
  Coins,
  Calendar,
  BarChart3,
  X,
  Eye,
  FileText,
  MessageCircle,
} from "lucide-react"
import { useState, useEffect, useCallback } from "react"

export default function AccountPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<"month" | "total">("month")
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [selectedMenuItem, setSelectedMenuItem] = useState<string | null>(null)

  const [loadedItems, setLoadedItems] = useState(10)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const generateMoreData = (type: string, startIndex: number, count: number) => {
    const data = []
    for (let i = 0; i < count; i++) {
      const index = startIndex + i
      switch (type) {
        case "購入履歴":
          data.push({
            name: `AI呪文 #${index}`,
            date: `2024/${Math.floor(Math.random() * 12) + 1}/${Math.floor(Math.random() * 28) + 1}`,
            price: `¥${(Math.random() * 2000 + 500).toFixed(0)}`,
            status: "完了",
          })
          break
        case "お気に入り":
          data.push({
            name: `呪文 #${index}`,
            author: `開発者${index}`,
            price: `¥${(Math.random() * 2000 + 500).toFixed(0)}`,
            rating: (Math.random() * 1 + 4).toFixed(1),
          })
          break
        case "月別履歴":
          const year = 2024 - Math.floor(index / 12)
          const month = 12 - (index % 12)
          data.push({
            month: `${year}年${month}月`,
            revenue: `¥${(Math.random() * 100000 + 50000).toFixed(0)}`,
            sales: Math.floor(Math.random() * 100 + 20),
            expenses: `¥${(Math.random() * 50000 + 20000).toFixed(0)}`,
          })
          break
      }
    }
    return data
  }

  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop !== document.documentElement.offsetHeight ||
      isLoading
    ) {
      return
    }

    if (hasMore) {
      setIsLoading(true)
      setTimeout(() => {
        setLoadedItems((prev) => prev + 10)
        setIsLoading(false)
        if (loadedItems >= 100) {
          setHasMore(false)
        }
      }, 1000)
    }
  }, [isLoading, hasMore, loadedItems])

  const resetInfiniteScroll = () => {
    setLoadedItems(10)
    setHasMore(true)
    setIsLoading(false)
  }

  const revenueData = {
    month: {
      sales: { count: 89, percentage: 74 },
      amount: { value: "¥128,450", percentage: 85 },
      average: "¥1,443",
      executions: 1234,
      spells: 23,
      expenses: "¥45,231",
    },
    total: {
      sales: { count: 1847, percentage: 92 },
      amount: { value: "¥2,847,320", percentage: 95 },
      average: { value: "¥1,542", trend: "+6.8%" },
      executions: 28547,
      spells: 156,
      expenses: "¥892,450",
    },
  }

  const historyData = [
    {
      month: "2024年11月",
      revenue: "¥128,450",
      sales: 89,
      expenses: "¥45,231",
      details: {
        topSpells: [
          { name: "画像生成AI呪文", sales: 23, revenue: "¥34,500" },
          { name: "テキスト要約呪文", sales: 18, revenue: "¥27,000" },
          { name: "データ分析呪文", sales: 15, revenue: "¥22,500" },
        ],
        dailyStats: [
          { date: "11/30", revenue: "¥8,450", sales: 6 },
          { date: "11/29", revenue: "¥12,300", sales: 8 },
          { date: "11/28", revenue: "¥6,780", sales: 4 },
        ],
      },
    },
    {
      month: "2024年10月",
      revenue: "¥156,780",
      sales: 112,
      expenses: "¥52,100",
      details: {
        topSpells: [
          { name: "自動翻訳呪文", sales: 28, revenue: "¥42,000" },
          { name: "画像生成AI呪文", sales: 25, revenue: "¥37,500" },
          { name: "音声認識呪文", sales: 20, revenue: "¥30,000" },
        ],
        dailyStats: [
          { date: "10/31", revenue: "¥9,200", sales: 7 },
          { date: "10/30", revenue: "¥11,450", sales: 8 },
          { date: "10/29", revenue: "¥8,900", sales: 6 },
        ],
      },
    },
    {
      month: "2024年9月",
      revenue: "¥134,920",
      sales: 98,
      expenses: "¥48,650",
      details: {
        topSpells: [
          { name: "コード生成呪文", sales: 22, revenue: "¥33,000" },
          { name: "画像生成AI呪文", sales: 20, revenue: "¥30,000" },
          { name: "データ分析呪文", sales: 18, revenue: "¥27,000" },
        ],
        dailyStats: [
          { date: "9/30", revenue: "¥7,800", sales: 5 },
          { date: "9/29", revenue: "¥10,200", sales: 7 },
          { date: "9/28", revenue: "¥9,450", sales: 6 },
        ],
      },
    },
    {
      month: "2024年8月",
      revenue: "¥189,340",
      sales: 145,
      expenses: "¥61,200",
      details: {
        topSpells: [
          { name: "自動翻訳呪文", sales: 35, revenue: "¥52,500" },
          { name: "画像生成AI呪文", sales: 30, revenue: "¥45,000" },
          { name: "音声認識呪文", sales: 25, revenue: "¥37,500" },
        ],
        dailyStats: [
          { date: "8/31", revenue: "¥12,300", sales: 9 },
          { date: "8/30", revenue: "¥14,200", sales: 10 },
          { date: "8/29", revenue: "¥11,800", sales: 8 },
        ],
      },
    },
    {
      month: "2024年7月",
      revenue: "¥167,890",
      sales: 128,
      expenses: "¥55,780",
      details: {
        topSpells: [
          { name: "テキスト要約呪文", sales: 30, revenue: "¥45,000" },
          { name: "画像生成AI呪文", sales: 28, revenue: "¥42,000" },
          { name: "データ分析呪文", sales: 22, revenue: "¥33,000" },
        ],
        dailyStats: [
          { date: "7/31", revenue: "¥10,500", sales: 7 },
          { date: "7/30", revenue: "¥12,800", sales: 9 },
          { date: "7/29", revenue: "¥9,900", sales: 6 },
        ],
      },
    },
  ]

  const currentData = revenueData[selectedPeriod]

  const selectedHistoryData = selectedHistory ? historyData.find((item) => item.month === selectedHistory) : null

  const accountMenuItems = [
    { icon: Download, label: "購入履歴", badge: null },
    { icon: Star, label: "お気に入り", badge: "12" },
    { icon: CreditCard, label: "支払い方法", badge: null },
  ]

  const historyMenuItems = [
    { icon: Calendar, label: "月別履歴", badge: null },
    { icon: BarChart3, label: "売上分析", badge: null },
    { icon: Download, label: "レポート出力", badge: null },
  ]

  const settingsMenuItems = [
    { icon: Bell, label: "通知設定", badge: null },
    { icon: Shield, label: "プライバシー", badge: null },
    { icon: HelpCircle, label: "ヘルプ・サポート", badge: null },
    { icon: Settings, label: "設定", badge: null },
  ]

  const menuItemContent = {
    購入履歴: {
      title: "購入履歴",
      content: (
        <div className="space-y-4">
          {[
            { name: "画像生成AI呪文", date: "2024/11/30", price: "¥1,500", status: "完了" },
            { name: "テキスト要約呪文", date: "2024/11/28", price: "¥1,200", status: "完了" },
            { name: "データ分析呪文", date: "2024/11/25", price: "¥1,800", status: "完了" },
            { name: "自動翻訳呪文", date: "2024/11/22", price: "¥1,000", status: "完了" },
            ...generateMoreData("購入履歴", 5, loadedItems - 4),
          ]
            .slice(0, loadedItems)
            .map((item, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">{item.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{item.price}</div>
                      <Badge variant="secondary" className="text-xs">
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">読み込み中...</p>
            </div>
          )}
          {!hasMore && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">すべての履歴を表示しました</p>
            </div>
          )}
        </div>
      ),
    },
    お気に入り: {
      title: "お気に入り",
      content: (
        <div className="space-y-4">
          {[
            { name: "画像生成AI呪文", author: "AIマスター", price: "¥1,500", rating: 4.8 },
            { name: "テキスト要約呪文", author: "テキスト職人", price: "¥1,200", rating: 4.9 },
            { name: "データ分析呪文", author: "データサイエンティスト", price: "¥1,800", rating: 4.7 },
            ...generateMoreData("お気に入り", 4, loadedItems - 3),
          ]
            .slice(0, loadedItems)
            .map((item, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-muted-foreground">by {item.author}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs">{item.rating}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{item.price}</div>
                      <Button size="sm" variant="outline" className="mt-1 bg-transparent">
                        購入
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">読み込み中...</p>
            </div>
          )}
          {!hasMore && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">すべてのお気に入りを表示しました</p>
            </div>
          )}
        </div>
      ),
    },
    月別履歴: {
      title: "月別履歴",
      content: (
        <div className="space-y-4">
          {[...historyData, ...generateMoreData("月別履歴", historyData.length, loadedItems - historyData.length)]
            .slice(0, loadedItems)
            .map((item, i) => (
              <Card key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedHistory(item.month)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{item.month}</div>
                      <div className="text-sm text-muted-foreground">{item.sales}件の販売</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">{item.revenue}</div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          {isLoading && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">読み込み中...</p>
            </div>
          )}
          {!hasMore && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">すべての履歴を表示しました</p>
            </div>
          )}
        </div>
      ),
    },
    支払い方法: {
      title: "支払い方法",
      content: (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5" />
                  <div>
                    <div className="font-medium">**** **** **** 1234</div>
                    <div className="text-sm text-muted-foreground">Visa • 有効期限 12/26</div>
                  </div>
                </div>
                <Badge variant="secondary">メイン</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5" />
                  <div>
                    <div className="font-medium">**** **** **** 5678</div>
                    <div className="text-sm text-muted-foreground">Mastercard • 有効期限 08/27</div>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  編集
                </Button>
              </div>
            </CardContent>
          </Card>
          <Button className="w-full bg-transparent" variant="outline">
            新しいカードを追加
          </Button>
        </div>
      ),
    },
    売上分析: {
      title: "売上分析",
      content: (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">売上トレンド</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>今月の成長率</span>
                  <span className="text-green-600 font-semibold">+18.2%</span>
                </div>
                <div className="flex justify-between">
                  <span>平均月間売上</span>
                  <span className="font-semibold">¥155,476</span>
                </div>
                <div className="flex justify-between">
                  <span>最高売上月</span>
                  <span className="font-semibold">2024年8月 (¥189,340)</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">人気カテゴリ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { category: "AI・機械学習", percentage: 45, sales: "¥234,500" },
                  { category: "データ処理", percentage: 30, sales: "¥156,300" },
                  { category: "自動化", percentage: 25, sales: "¥130,200" },
                ].map((item, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{item.category}</span>
                      <span className="font-semibold">{item.sales}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    レポート出力: {
      title: "レポート出力",
      content: (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">月次レポート</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full bg-transparent" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                2024年11月レポート (PDF)
              </Button>
              <Button className="w-full bg-transparent" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                2024年10月レポート (PDF)
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">年次レポート</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-transparent" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                2024年年次レポート (PDF)
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">カスタムレポート</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                カスタムレポートを作成
              </Button>
            </CardContent>
          </Card>
        </div>
      ),
    },
    通知設定: {
      title: "通知設定",
      content: (
        <div className="space-y-4">
          {[
            { label: "新しい購入", description: "呪文が購入されたとき", enabled: true },
            { label: "レビュー投稿", description: "新しいレビューが投稿されたとき", enabled: true },
            { label: "売上レポート", description: "月次売上レポートの配信", enabled: false },
            { label: "システム通知", description: "重要なお知らせ", enabled: true },
          ].map((item, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  </div>
                  <div className={`w-10 h-6 rounded-full ${item.enabled ? "bg-blue-500" : "bg-muted"} relative`}>
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${item.enabled ? "left-5" : "left-1"}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    プライバシー: {
      title: "プライバシー設定",
      content: (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">プロフィール公開設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "プロフィールを公開", enabled: true },
                { label: "売上統計を公開", enabled: false },
                { label: "作成した呪文一覧を公開", enabled: true },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span>{item.label}</span>
                  <div className={`w-10 h-6 rounded-full ${item.enabled ? "bg-blue-500" : "bg-muted"} relative`}>
                    <div
                      className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${item.enabled ? "left-5" : "left-1"}`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">データ管理</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full bg-transparent">
                データのエクスポート
              </Button>
              <Button variant="destructive" className="w-full">
                アカウントの削除
              </Button>
            </CardContent>
          </Card>
        </div>
      ),
    },
    ヘルプ・サポート: {
      title: "ヘルプ・サポート",
      content: (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">よくある質問</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {["呪文の販売方法について", "収益の受け取り方法", "アカウントの設定変更", "技術的な問題の解決"].map(
                (item, i) => (
                  <Button key={i} variant="outline" className="w-full justify-start bg-transparent">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    {item}
                  </Button>
                ),
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">お問い合わせ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full">
                <MessageCircle className="h-4 w-4 mr-2" />
                チャットサポート
              </Button>
              <Button variant="outline" className="w-full bg-transparent">
                メールでお問い合わせ
              </Button>
            </CardContent>
          </Card>
        </div>
      ),
    },
    設定: {
      title: "設定",
      content: (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">アカウント情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">表示名</label>
                <input className="w-full p-2 border rounded-lg bg-background" defaultValue="開発者アカウント" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">メールアドレス</label>
                <input className="w-full p-2 border rounded-lg bg-background" defaultValue="developer@example.com" />
              </div>
              <Button className="w-full">変更を保存</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">セキュリティ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full bg-transparent">
                パスワードを変更
              </Button>
              <Button variant="outline" className="w-full bg-transparent">
                二段階認証を設定
              </Button>
            </CardContent>
          </Card>
        </div>
      ),
    },
  }

  useEffect(() => {
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  useEffect(() => {
    resetInfiniteScroll()
  }, [selectedMenuItem])

  if (selectedMenuItem && menuItemContent[selectedMenuItem]) {
    const content = menuItemContent[selectedMenuItem]
    return (
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <div className="px-4 py-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{content.title}</h1>
            <Button variant="outline" size="sm" onClick={() => setSelectedMenuItem(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="px-4 py-6">{content.content}</div>
      </div>
    )
  }

  if (selectedHistory && selectedHistoryData) {
    return (
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <div className="px-4 py-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{selectedHistoryData.month} 詳細</h1>
            <Button variant="outline" size="sm" onClick={() => setSelectedHistory(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 py-6 space-y-6">
          <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 text-green-900 dark:text-green-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg text-green-700 dark:text-green-400">収入統計</CardTitle>
                </div>
                <div className="flex gap-1 bg-background/80 rounded-lg p-1">
                  <Button
                    variant={selectedPeriod === "month" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => setSelectedPeriod("month")}
                  >
                    今月
                  </Button>
                  <Button
                    variant={selectedPeriod === "total" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => setSelectedPeriod("total")}
                  >
                    総計
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">{currentData.amount.value}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedPeriod === "month" ? "今月の売上" : "総売上"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold">{currentData.sales.count}</div>
                  <div className="text-xs text-muted-foreground">販売数</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">
                    {typeof currentData.average === "string" ? currentData.average : currentData.average.value}
                  </div>
                  <div className="text-xs text-muted-foreground">平均単価</div>
                </div>
              </div>

              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${currentData.amount.percentage}%` }} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="px-4 py-6 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                過去の履歴
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedHistoryData.details.topSpells.map((spell, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{spell.name}</div>
                    <div className="text-xs text-muted-foreground">{spell.sales}件販売</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">{spell.revenue}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                日別売上
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedHistoryData.details.dailyStats.map((day, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{day.date}</div>
                    <div className="text-xs text-muted-foreground">{day.sales}件販売</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">{day.revenue}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (showAllHistory) {
    return (
      <div className="max-w-md mx-auto bg-background min-h-screen">
        <div className="px-4 py-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">全ての履歴</h1>
            <Button variant="outline" size="sm" onClick={() => setShowAllHistory(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="px-4 py-6 space-y-4">
          {historyData.map((item, i) => (
            <Card
              key={i}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                setShowAllHistory(false)
                setSelectedHistory(item.month)
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{item.month}</div>
                    <div className="text-sm text-muted-foreground">{item.sales}件の販売</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold text-green-600">{item.revenue}</div>
                      <div className="text-xs text-muted-foreground">支出: {item.expenses}</div>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto bg-background min-h-screen">
      <div className="px-4 py-6 border-b border-border">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">アカウント</h1>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14">
            <AvatarImage src="/developer-avatar.png" />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">A</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">開発者アカウント</h2>
            <p className="text-sm text-muted-foreground">developer@example.com</p>
            <Badge variant="secondary" className="mt-1 text-xs">
              プレミアム
            </Badge>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        <section>
          <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 text-green-900 dark:text-green-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg text-green-700 dark:text-green-400">収入統計</CardTitle>
                </div>
                <div className="flex gap-1 bg-background/80 rounded-lg p-1">
                  <Button
                    variant={selectedPeriod === "month" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => setSelectedPeriod("month")}
                  >
                    今月
                  </Button>
                  <Button
                    variant={selectedPeriod === "total" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={() => setSelectedPeriod("total")}
                  >
                    総計
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">{currentData.amount.value}</div>
                <div className="text-sm text-muted-foreground">
                  {selectedPeriod === "month" ? "今月の売上" : "総売上"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold">{currentData.sales.count}</div>
                  <div className="text-xs text-muted-foreground">販売数</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">
                    {typeof currentData.average === "string" ? currentData.average : currentData.average.value}
                  </div>
                  <div className="text-xs text-muted-foreground">平均単価</div>
                </div>
              </div>

              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${currentData.amount.percentage}%` }} />
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="grid grid-cols-3 gap-3">
            <Card className="text-center">
              <CardContent className="p-3">
                <Zap className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <div className="text-lg font-bold">{currentData.executions.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">実行回数</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                <div className="text-lg font-bold">{currentData.spells}</div>
                <div className="text-xs text-muted-foreground">作成Spell</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="p-3">
                <Coins className="h-5 w-5 mx-auto mb-1 text-red-500" />
                <div className="text-lg font-bold">{currentData.expenses}</div>
                <div className="text-xs text-muted-foreground">
                  {selectedPeriod === "month" ? "今月支出" : "総支出"}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                過去の履歴
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {historyData.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedHistory(item.month)}
                >
                  <div>
                    <div className="font-medium text-sm">{item.month}</div>
                    <div className="text-xs text-muted-foreground">{item.sales}件の販売</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="font-semibold text-green-600">{item.revenue}</div>
                      <div className="text-xs text-muted-foreground">支出: {item.expenses}</div>
                    </div>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full mt-3 bg-transparent"
                size="sm"
                onClick={() => setShowAllHistory(true)}
              >
                すべての履歴を表示
              </Button>
            </CardContent>
          </Card>
        </section>

        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">アカウント管理</h3>
          <div className="space-y-2">
            {accountMenuItems.map((item, i) => (
              <Card
                key={i}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedMenuItem(item.label)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">履歴・分析</h3>
          <div className="space-y-2">
            {historyMenuItems.map((item, i) => (
              <Card
                key={i}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedMenuItem(item.label)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">設定・サポート</h3>
          <div className="space-y-2">
            {settingsMenuItems.map((item, i) => (
              <Card
                key={i}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedMenuItem(item.label)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Button variant="destructive" className="w-full" size="lg">
          <LogOut className="h-4 w-4 mr-2" />
          ログアウト
        </Button>
      </div>
    </div>
  )
}
