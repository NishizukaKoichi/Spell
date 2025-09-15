import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, Filter, Grid3X3, List } from "lucide-react"
import { Database, Mail, ImageIcon, FileText, BarChart3, Shield } from "lucide-react"

export default function ExplorePage() {
  const categories = [
    { name: "すべて", count: 1234, active: true },
    { name: "開発ツール", count: 456, active: false },
    { name: "データ処理", count: 234, active: false },
    { name: "API", count: 189, active: false },
    { name: "自動化", count: 156, active: false },
  ]

  const spells = [
    {
      name: "AI画像生成API",
      developer: "ImageAI Inc.",
      category: "画像処理",
      rating: 4.8,
      reviews: 1234,
      price: "¥800",
      icon: ImageIcon,
      color: "bg-purple-500",
      featured: true,
    },
    {
      name: "PDF生成ツール",
      developer: "DocGen",
      category: "ドキュメント",
      rating: 4.9,
      reviews: 892,
      price: "¥500",
      icon: FileText,
      color: "bg-red-500",
      featured: false,
    },
    {
      name: "データ分析エンジン",
      developer: "Analytics Pro",
      category: "分析",
      rating: 4.7,
      reviews: 567,
      price: "¥1200",
      icon: BarChart3,
      color: "bg-blue-500",
      featured: false,
    },
    {
      name: "メール配信API",
      developer: "MailService",
      category: "通信",
      rating: 4.6,
      reviews: 445,
      price: "¥300",
      icon: Mail,
      color: "bg-green-500",
      featured: false,
    },
    {
      name: "データベース管理",
      developer: "DB Tools",
      category: "データベース",
      rating: 4.8,
      reviews: 678,
      price: "¥600",
      icon: Database,
      color: "bg-orange-500",
      featured: false,
    },
    {
      name: "セキュリティスキャン",
      developer: "SecureDev",
      category: "セキュリティ",
      rating: 4.9,
      reviews: 234,
      price: "¥900",
      icon: Shield,
      color: "bg-indigo-500",
      featured: false,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto bg-background min-h-screen">
      {/* モバイル用ヘッダー */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border md:hidden">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Explore</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* カテゴリタブ */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Button
              key={category.name}
              variant={category.active ? "default" : "outline"}
              size="sm"
              className="whitespace-nowrap rounded-full"
            >
              {category.name}
              <Badge variant="secondary" className="ml-2 text-xs">
                {category.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      {/* デスクトップ用ヘッダー */}
      <div className="hidden md:block px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Explore</h1>
            <p className="text-muted-foreground">Spellマーケットプレイス・カテゴリ・ランキング</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* デスクトップ用カテゴリタブ */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Button
              key={category.name}
              variant={category.active ? "default" : "outline"}
              size="sm"
              className="whitespace-nowrap rounded-full"
            >
              {category.name}
              <Badge variant="secondary" className="ml-2 text-xs">
                {category.count}
              </Badge>
            </Button>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-6 space-y-6 pb-6">
        {/* 注目のSpell */}
        <section>
          <h2 className="text-lg font-semibold mb-3">注目のSpell</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {spells
              .filter((spell) => spell.featured)
              .map((spell, i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex">
                      <div className={`w-20 h-20 ${spell.color} flex items-center justify-center`}>
                        <spell.icon className="h-8 w-8 text-white" />
                      </div>
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{spell.name}</h3>
                            <p className="text-sm text-muted-foreground">{spell.developer}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                <span className="text-xs">{spell.rating}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">({spell.reviews})</span>
                              <Badge variant="outline" className="text-xs">
                                {spell.category}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-primary">{spell.price}</p>
                            <Button size="sm" className="mt-1 rounded-full">
                              購入
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </section>

        {/* 全てのSpell */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">全てのSpell</h2>
            <Button variant="ghost" size="sm">
              <List className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {spells
              .filter((spell) => !spell.featured)
              .map((spell, i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl ${spell.color} flex items-center justify-center`}>
                      <spell.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">{spell.name}</h3>
                      <p className="text-xs text-muted-foreground">{spell.developer}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs">{spell.rating}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">({spell.reviews})</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-primary">{spell.price}</p>
                      <Button size="sm" variant="outline" className="mt-1 rounded-full text-xs bg-transparent">
                        購入
                      </Button>
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
