"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Star, Users, Code, TrendingUp, Award, MapPin, RefreshCcw } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingSkeleton } from "@/components/loading-skeleton"
import { useSpellStore } from "@/lib/spell-store"
import { cn } from "@/lib/utils"

export default function WizardsPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")

  const { wizards, fetchWizards, isFetchingWizards } = useSpellStore()

  useEffect(() => {
    fetchWizards()
  }, [fetchWizards])

  const filteredWizards = useMemo(() => {
    if (!searchQuery) return wizards
    const q = searchQuery.toLowerCase()
    return wizards.filter((wizard) =>
      (wizard.name ?? "").toLowerCase().includes(q) || (wizard.bio ?? "").toLowerCase().includes(q),
    )
  }, [wizards, searchQuery])

  const featuredWizard = filteredWizards.find((w) => (w.success_rate ?? 0) > 0.98) || filteredWizards[0]

  const categories = useMemo(() => {
    const buckets: Array<{ name: string; count: number; icon: typeof Code }> = [
      { name: "AI・機械学習", count: 0, icon: Code },
      { name: "データ処理", count: 0, icon: TrendingUp },
      { name: "ツール/ユーティリティ", count: 0, icon: Users },
    ]
    wizards.forEach((wizard) => {
      const bio = (wizard.bio ?? "").toLowerCase()
      if (bio.includes("ai") || bio.includes("ml") || bio.includes("machine")) buckets[0].count += 1
      else if (bio.includes("data") || bio.includes("analytics")) buckets[1].count += 1
      else buckets[2].count += 1
    })
    return buckets
  }, [wizards])

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Wizards</h1>
            <p className="text-sm text-muted-foreground">魔法使いたちを探索しよう</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.push("/account")}>
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-white">A</span>
              </div>
            </Button>
            <Button variant="outline" size="icon" onClick={() => fetchWizards()}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

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
        {featuredWizard && !isFetchingWizards ? (
          <section>
            <h2 className="text-xl font-bold mb-4 text-foreground">注目の魔法使い</h2>
            <Card className="bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500/20 overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Image
                    src={featuredWizard.avatar || "/placeholder.svg"}
                    alt={featuredWizard.name ?? "wizard"}
                    width={64}
                    height={64}
                    className="w-16 h-16 rounded-full object-cover border-2 border-purple-500/50"
                    priority
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{featuredWizard.name ?? "匿名の魔法使い"}</h3>
                      <Award className="h-4 w-4 text-yellow-400" />
                    </div>
                    <p className="text-purple-200 text-sm mb-2">{featuredWizard.bio?.split(".")[0] ?? "自己紹介がありません"}</p>
                    <div className="flex items-center gap-4 text-white/80 text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span>{(featuredWizard.success_rate ?? 0).toFixed(1)}</span>
                      </div>
                      <span>{featuredWizard.published_spells ?? 0}個の呪文</span>
                      <span>{featuredWizard.total_executions ?? 0}実行</span>
                    </div>
                  </div>
                </div>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">プロフィールを見る</Button>
              </CardContent>
            </Card>
          </section>
        ) : (
          <section className="space-y-3">
            <LoadingSkeleton className="h-32 w-full" />
            <LoadingSkeleton className="h-24 w-full" />
          </section>
        )}

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
              </div>
              {isFetchingWizards ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, idx) => (
                    <LoadingSkeleton key={idx} className="h-28 w-full" />
                  ))}
                </div>
              ) : filteredWizards.length === 0 ? (
                <p className="text-sm text-muted-foreground">該当する魔法使いが見つかりません。</p>
              ) : (
                filteredWizards.slice(0, 5).map((wizard) => (
                  <Card key={wizard.id} className="bg-card/50 border-border/50">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <Image
                          src={wizard.avatar || "/placeholder.svg"}
                          alt={wizard.name}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-foreground">{wizard.name}</h4>
                            <Award className="h-4 w-4 text-yellow-500" />
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{wizard.bio?.split(".")[0] ?? '自己紹介がありません'}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                            <MapPin className="h-3 w-3" />
                            <span>@{wizard.github_username ?? 'unknown'}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span>{(wizard.success_rate ?? 0).toFixed(1)}</span>
                            </div>
                            <span>{wizard.published_spells ?? 0}個の呪文</span>
                            <span>{wizard.total_executions ?? 0}実行</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline">
                          フォロー
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="top" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">トップ魔法使い</h3>
              </div>
              {isFetchingWizards ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, idx) => (
                    <LoadingSkeleton key={idx} className="h-24 w-full" />
                  ))}
                </div>
              ) : filteredWizards.length === 0 ? (
                <p className="text-sm text-muted-foreground">該当する魔法使いが見つかりません。</p>
              ) : (
                [...filteredWizards]
                  .sort((a, b) => (b.success_rate ?? 0) - (a.success_rate ?? 0))
                  .slice(0, 5)
                  .map((wizard, index) => (
                    <Card key={wizard.id} className="bg-card/50 border-border/50">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full text-white font-bold text-sm">
                            {index + 1}
                          </div>
                          <Image
                            src={wizard.avatar || "/placeholder.svg"}
                            alt={wizard.name}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-foreground">{wizard.name}</h4>
                              <Award className="h-4 w-4 text-yellow-500" />
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>成功率 {(wizard.success_rate ?? 0) * 100}%</span>
                              <span>{wizard.total_executions ?? 0}実行</span>
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            フォロー
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
              )}
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">分野別</h3>
              <div className="grid grid-cols-1 gap-3">
                {categories.map((category) => {
                  const Icon = category.icon
                  return (
                    <Card
                      key={category.name}
                      className={cn(
                        "bg-card/50 border-border/50 transition-colors",
                        category.count ? "cursor-pointer hover:bg-card/70" : "opacity-50",
                      )}
                      onClick={() => category.count && router.push(`/wizards?category=${encodeURIComponent(category.name)}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium text-foreground">{category.name}</h4>
                              <p className="text-sm text-muted-foreground">{category.count}人の魔法使い</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" disabled={!category.count}>
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
