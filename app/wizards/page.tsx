"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Star, Users, Code, TrendingUp, Award, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSpellStore } from "@/lib/spell-store"

export default function WizardsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")

  const { wizards, fetchWizards } = useSpellStore()

  useEffect(() => {
    fetchWizards()
  }, [fetchWizards])

  const filteredWizards = wizards.filter(
    (wizard) =>
      wizard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      wizard.bio.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const topCategories = [
    { name: "AI・機械学習", wizards: 156, icon: Code },
    { name: "データ処理", wizards: 89, icon: TrendingUp },
    { name: "ドキュメント", wizards: 67, icon: Users },
  ]

  const featuredWizard = filteredWizards.find((w) => w.success_rate > 0.98) || filteredWizards[0]

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Wizards</h1>
            <p className="text-sm text-muted-foreground">魔法使いたちを探索しよう</p>
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
              placeholder="魔法使いを検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* 注目の魔法使い */}
        {featuredWizard && (
          <section>
            <h2 className="text-xl font-bold mb-4 text-foreground">注目の魔法使い</h2>
            <Card className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/20 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <img
                    src={featuredWizard.avatar || "/placeholder.svg"}
                    alt={featuredWizard.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-purple-500/50"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{featuredWizard.name}</h3>
                      <Award className="h-4 w-4 text-yellow-400" />
                    </div>
                    <p className="text-purple-200 text-sm mb-2">{featuredWizard.bio.split(".")[0]}</p>
                    <div className="flex items-center gap-4 text-white/80 text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{featuredWizard.success_rate.toFixed(1)}</span>
                      </div>
                      <span>{featuredWizard.published_spells}個の呪文</span>
                      <span>{featuredWizard.total_executions}実行</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {["AI", "機械学習", "画像生成"].map((tag) => (
                    <Badge key={tag} variant="secondary" className="bg-white/20 text-white border-white/30">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">プロフィールを見る</Button>
              </CardContent>
            </Card>
          </section>
        )}

        {/* タブ */}
        <section>
          <Tabs defaultValue="trending" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="trending">トレンド</TabsTrigger>
              <TabsTrigger value="top">トップ</TabsTrigger>
              <TabsTrigger value="categories">分野別</TabsTrigger>
            </TabsList>

            <TabsContent value="trending" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">トレンドの魔法使い</h3>
                <Button variant="ghost" size="sm" className="text-blue-500">
                  すべて表示
                </Button>
              </div>
              {filteredWizards.slice(0, 5).map((wizard) => (
                <Card key={wizard.id} className="bg-card/50 border-border/50">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <img
                        src={wizard.avatar || "/placeholder.svg"}
                        alt={wizard.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground">{wizard.name}</h4>
                          <Award className="h-4 w-4 text-yellow-500" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{wizard.bio.split(".")[0]}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                          <MapPin className="h-3 w-3" />
                          <span>@{wizard.github_username}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span>{wizard.success_rate.toFixed(1)}</span>
                          </div>
                          <span>{wizard.published_spells}個の呪文</span>
                          <span>{wizard.total_executions}実行</span>
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        フォロー
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="top" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">トップ魔法使い</h3>
                <Button variant="ghost" size="sm" className="text-blue-500">
                  すべて表示
                </Button>
              </div>
              {[...filteredWizards]
                .sort((a, b) => b.success_rate - a.success_rate)
                .slice(0, 5)
                .map((wizard, index) => (
                  <Card key={wizard.id} className="bg-card/50 border-border/50">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full text-white font-bold text-sm">
                          {index + 1}
                        </div>
                        <img
                          src={wizard.avatar || "/placeholder.svg"}
                          alt={wizard.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-foreground">{wizard.name}</h4>
                            <Award className="h-4 w-4 text-yellow-500" />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>成功率 {(wizard.success_rate * 100).toFixed(1)}%</span>
                            <span>{wizard.total_executions}実行</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          フォロー
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">分野別</h3>
              <div className="grid grid-cols-1 gap-3">
                {topCategories.map((category) => {
                  const Icon = category.icon
                  return (
                    <Card
                      key={category.name}
                      className="bg-card/50 border-border/50 hover:bg-card/70 transition-colors cursor-pointer"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium text-foreground">{category.name}</h4>
                              <p className="text-sm text-muted-foreground">{category.wizards}人の魔法使い</p>
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
