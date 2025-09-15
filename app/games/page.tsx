import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Star, Gamepad2, Zap, Trophy, Target } from "lucide-react"

export default function GamesPage() {
  const featuredGame = {
    name: "コードバトルアリーナ",
    developer: "GameDev Studio",
    description: "リアルタイムでコーディングスキルを競う",
    rating: 4.9,
    reviews: 2345,
    price: "無料",
    image: "/game-featured.png",
  }

  const games = [
    {
      name: "アルゴリズムクエスト",
      developer: "EduGames",
      category: "教育",
      rating: 4.8,
      reviews: 1567,
      price: "¥600",
      color: "bg-blue-500",
    },
    {
      name: "デバッグマスター",
      developer: "CodeFun",
      category: "パズル",
      rating: 4.7,
      reviews: 892,
      price: "¥400",
      color: "bg-green-500",
    },
    {
      name: "API レーシング",
      developer: "SpeedCode",
      category: "レーシング",
      rating: 4.6,
      reviews: 634,
      price: "¥800",
      color: "bg-orange-500",
    },
    {
      name: "データ構造タワー",
      developer: "StructureGames",
      category: "戦略",
      rating: 4.8,
      reviews: 445,
      price: "¥500",
      color: "bg-purple-500",
    },
  ]

  const categories = [
    { name: "アクション", icon: Zap, count: 45, color: "bg-red-500" },
    { name: "パズル", icon: Target, count: 67, color: "bg-blue-500" },
    { name: "教育", icon: Trophy, count: 34, color: "bg-green-500" },
    { name: "戦略", icon: Gamepad2, count: 23, color: "bg-purple-500" },
  ]

  return (
    <div className="max-w-md mx-auto bg-background min-h-screen">
      {/* ヘッダー */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border">
        <h1 className="text-2xl font-bold">ゲーム</h1>
        <p className="text-sm text-muted-foreground">コーディングスキルを楽しく学習</p>
      </div>

      <div className="px-4 space-y-6 pb-6">
        {/* 注目のゲーム */}
        <section>
          <h2 className="text-lg font-semibold mb-3">今週の注目</h2>
          <Card className="overflow-hidden">
            <div className="relative h-48 bg-gradient-to-br from-primary/30 to-accent/30">
              <div className="absolute inset-0 bg-black/40" />
              <div className="absolute bottom-4 left-4 right-4">
                <Badge className="mb-2 bg-primary text-primary-foreground">エディターズチョイス</Badge>
                <h3 className="text-lg font-bold text-white mb-1">{featuredGame.name}</h3>
                <p className="text-sm text-white/80">{featuredGame.description}</p>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{featuredGame.rating}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">({featuredGame.reviews})</span>
                </div>
                <Button size="sm" className="rounded-full">
                  {featuredGame.price === "無料" ? "プレイ" : featuredGame.price}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* カテゴリ */}
        <section>
          <h2 className="text-lg font-semibold mb-3">カテゴリ</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((category, i) => (
              <Card key={i} className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center text-center gap-2">
                  <div className={`w-12 h-12 rounded-xl ${category.color} flex items-center justify-center`}>
                    <category.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{category.name}</h3>
                    <p className="text-xs text-muted-foreground">{category.count} ゲーム</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* 人気ゲーム */}
        <section>
          <h2 className="text-lg font-semibold mb-3">人気ゲーム</h2>
          <div className="space-y-3">
            {games.map((game, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${game.color} flex items-center justify-center`}>
                    <Gamepad2 className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{game.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {game.developer} • {game.category}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs">{game.rating}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">({game.reviews})</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-primary">{game.price}</p>
                    <Button size="sm" variant="outline" className="mt-1 rounded-full text-xs bg-transparent">
                      プレイ
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ランキング */}
        <section>
          <h2 className="text-lg font-semibold mb-3">今週のランキング</h2>
          <div className="space-y-2">
            {games.slice(0, 3).map((game, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-foreground">{i + 1}</span>
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${game.color} flex items-center justify-center`}>
                    <Gamepad2 className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{game.name}</h3>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-xs">{game.rating}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-full bg-transparent">
                    プレイ
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
