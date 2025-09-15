"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Filter, Star, Download, Clock, Users, TrendingUp, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSpellStore } from "@/lib/spell-store"

export default function BazaarPage() {
  const router = useRouter()

  const {
    searchQuery,
    selectedCategory,
    selectedMode,
    setSearchQuery,
    setSelectedCategory,
    setSelectedMode,
    downloadSpell,
    getFilteredBazaarSpells,
    fetchBazaarSpells,
  } = useSpellStore()

  const filteredSpells = getFilteredBazaarSpells()

  useEffect(() => {
    fetchBazaarSpells()
  }, [fetchBazaarSpells])

  const categories = [
    { name: "新着", count: 24, icon: Sparkles },
    { name: "人気", count: 156, icon: TrendingUp },
    { name: "AI・機械学習", count: 89, icon: Users },
    { name: "データ処理", count: 67, icon: Filter },
    { name: "ドキュメント", count: 45, icon: Clock },
  ]

  const featuredSpell =
    filteredSpells.find((spell) => spell.stats && spell.stats.executions > 1000) || filteredSpells[0]

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bazaar</h1>
            <p className="text-sm text-muted-foreground">魔法市で呪文を探そう</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push("/account")}>
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">A</span>
            </div>
          </Button>
        </div>

        {/* 検索バー */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="呪文、タグ、作者を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* 今日の呪文 */}
        {featuredSpell && (
          <section>
            <h2 className="text-xl font-bold mb-4 text-foreground">今日の呪文</h2>
            <Card className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/20 overflow-hidden">
              <CardContent className="p-0">
                <div className="relative">
                  <img
                    src={featuredSpell.author?.avatar || "/developer-working.png"}
                    alt={featuredSpell.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <Badge className="mb-2 bg-blue-500 text-white">エディターズチョイス</Badge>
                    <h3 className="text-xl font-bold text-white mb-1">{featuredSpell.name}</h3>
                    <p className="text-white/80 text-sm mb-3">{featuredSpell.summary}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-white/80 text-sm">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span>4.8</span>
                        </div>
                        <span>{featuredSpell.stats?.executions || 0}実行</span>
                      </div>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => downloadSpell(featuredSpell.id)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* カテゴリタブ */}
        <section>
          <Tabs defaultValue="new" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="new">新着</TabsTrigger>
              <TabsTrigger value="popular">人気</TabsTrigger>
              <TabsTrigger value="categories">カテゴリ</TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">新着呪文</h3>
                <Button variant="ghost" size="sm" className="text-blue-500">
                  すべて表示
                </Button>
              </div>
              {filteredSpells.slice(0, 5).map((spell) => (
                <Card key={spell.id} className="bg-card/50 border-border/50">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <img
                        src={spell.author?.avatar || "/placeholder.svg"}
                        alt={spell.name}
                        className="w-16 h-16 rounded-lg object-cover bg-muted"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-semibold text-foreground truncate">{spell.name}</h4>
                          <span className="text-sm font-medium text-blue-500 ml-2">
                            ¥{Math.floor(spell.pricing_json.amount_cents / 100)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{spell.summary}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span>4.8</span>
                            </div>
                            <span>{spell.stats?.executions || 0}実行</span>
                            <span>{spell.author?.name || "Unknown"}</span>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => downloadSpell(spell.id)}>
                            <Download className="h-3 w-3 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="popular" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">人気の呪文</h3>
                <Button variant="ghost" size="sm" className="text-blue-500">
                  すべて表示
                </Button>
              </div>
              {[...filteredSpells]
                .sort((a, b) => (b.stats?.executions || 0) - (a.stats?.executions || 0))
                .slice(0, 5)
                .map((spell, index) => (
                  <Card key={spell.id} className="bg-card/50 border-border/50">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <img
                          src={spell.author?.avatar || "/placeholder.svg"}
                          alt={spell.name}
                          className="w-12 h-12 rounded-lg object-cover bg-muted"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <h4 className="font-semibold text-foreground truncate">{spell.name}</h4>
                            <span className="text-sm font-medium text-blue-500 ml-2">
                              ¥{Math.floor(spell.pricing_json.amount_cents / 100)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span>4.8</span>
                            </div>
                            <span>{spell.stats?.executions || 0}実行</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => downloadSpell(spell.id)}>
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">カテゴリ</h3>
              <div className="grid grid-cols-1 gap-3">
                {categories.map((category) => {
                  const Icon = category.icon
                  return (
                    <Card
                      key={category.name}
                      className="bg-card/50 border-border/50 hover:bg-card/70 transition-colors cursor-pointer"
                      onClick={() => setSelectedCategory(category.name)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium text-foreground">{category.name}</h4>
                              <p className="text-sm text-muted-foreground">{category.count}個の呪文</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            探索
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>
        </section>
      </div>
    </div>
  )
}
