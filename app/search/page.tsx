import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, TrendingUp, Clock, Star } from "lucide-react"
import { Code2, Database, Mail, ImageIcon, FileText, BarChart3 } from "lucide-react"

export default function SearchPage() {
  const trendingSearches = ["AI画像生成", "PDF作成", "データ分析", "メール送信", "画像処理", "自動化ツール"]

  const recentSearches = ["データベース管理", "API開発", "セキュリティ"]

  const suggestions = [
    {
      name: "AI画像生成API",
      category: "画像処理",
      rating: 4.8,
      price: "¥800",
      icon: ImageIcon,
      color: "bg-purple-500",
    },
    {
      name: "PDF生成ツール",
      category: "ドキュメント",
      rating: 4.9,
      price: "¥500",
      icon: FileText,
      color: "bg-red-500",
    },
    {
      name: "データ分析エンジン",
      category: "分析",
      rating: 4.7,
      price: "¥1200",
      icon: BarChart3,
      color: "bg-blue-500",
    },
  ]

  return (
    <div className="max-w-md mx-auto bg-background min-h-screen">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border">
        <h1 className="text-2xl font-bold mb-4">検索</h1>

        {/* 検索バー */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Spell、開発者、カテゴリを検索" className="pl-10 rounded-xl bg-muted border-0" />
        </div>
      </div>

      <div className="px-4 space-y-6 pb-6">
        {/* トレンド検索 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">トレンド検索</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {trendingSearches.map((search, i) => (
              <Button key={i} variant="outline" size="sm" className="rounded-full text-sm bg-transparent">
                {search}
              </Button>
            ))}
          </div>
        </section>

        {/* 最近の検索 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">最近の検索</h2>
          </div>
          <div className="space-y-2">
            {recentSearches.map((search, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <span className="text-sm">{search}</span>
                <Button variant="ghost" size="sm" className="text-muted-foreground">
                  ×
                </Button>
              </div>
            ))}
          </div>
        </section>

        {/* おすすめ */}
        <section>
          <h2 className="text-lg font-semibold mb-3">おすすめのSpell</h2>
          <div className="space-y-3">
            {suggestions.map((spell, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${spell.color} flex items-center justify-center`}>
                    <spell.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{spell.name}</h3>
                    <p className="text-xs text-muted-foreground">{spell.category}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs">{spell.rating}</span>
                      </div>
                      <span className="text-xs font-semibold text-primary">{spell.price}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-full bg-transparent">
                    実行
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* カテゴリ */}
        <section>
          <h2 className="text-lg font-semibold mb-3">カテゴリ</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "開発ツール", icon: Code2, count: 456, color: "bg-blue-500" },
              { name: "データ処理", icon: Database, count: 234, color: "bg-green-500" },
              { name: "通信", icon: Mail, count: 189, color: "bg-orange-500" },
              { name: "画像処理", icon: ImageIcon, count: 156, color: "bg-purple-500" },
              { name: "ドキュメント", icon: FileText, count: 123, color: "bg-red-500" },
              { name: "分析", icon: BarChart3, count: 98, color: "bg-cyan-500" },
            ].map((category, i) => (
              <Card key={i} className="p-4">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className={`w-10 h-10 rounded-lg ${category.color} flex items-center justify-center`}>
                    <category.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{category.name}</h3>
                    <p className="text-xs text-muted-foreground">{category.count} Spell</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
