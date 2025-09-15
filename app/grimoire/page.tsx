"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Star, Play, Plus, Edit, Settings, Wand2, Download, ShoppingCart } from "lucide-react"
import { Database } from "lucide-react"
import { useSpellStore } from "@/lib/spell-store"
import { useRouter } from "next/navigation"

export default function GrimoirePage() {
  const router = useRouter()
  const {
    purchasedSpells,
    mySpells,
    grimoireTab,
    setGrimoireTab,
    registerSpell,
    unregisterSpell,
    castSpell,
    createSpell,
    getRegisteredSpells,
  } = useSpellStore()

  const registeredSpells = getRegisteredSpells()

  const handleCastSpell = async (spellId: number) => {
    try {
      const cast = await castSpell(spellId, {
        /* input data */
      })
      console.log("Cast started:", cast)
      // 実際の実装では進捗表示やSSE接続を行う
    } catch (error) {
      console.error("Cast failed:", error)
    }
  }

  const handleProfileClick = () => {
    router.push("/account")
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Grimoire</h1>
            <p className="text-sm text-muted-foreground">あなたの魔導書</p>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleProfileClick}>
            <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">A</span>
            </div>
          </Button>
        </div>
      </div>

      <div className="p-4">
        <Tabs value={grimoireTab} onValueChange={setGrimoireTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="purchased" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              購入済み
            </TabsTrigger>
            <TabsTrigger value="casting" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              詠唱
            </TabsTrigger>
            <TabsTrigger value="creation" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              創造
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchased" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">購入済みSpell</h2>
              <Badge variant="outline">{purchasedSpells.length}個</Badge>
            </div>

            <div className="space-y-4">
              {purchasedSpells.map((spell) => (
                <Card key={spell.id} className="bg-card/50 border-border/50">
                  <div className="p-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <Database className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-foreground">{spell.name}</h3>
                            <p className="text-sm text-muted-foreground">{spell.execution_mode}</p>
                          </div>
                          <span className="text-sm font-medium text-blue-500">
                            ¥{Math.floor(spell.pricing_json.amount_cents / 100)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span>4.8</span>
                          </div>
                          <span>購入日: {new Date(spell.created_at).toLocaleDateString("ja-JP")}</span>
                        </div>
                        <div className="flex gap-2">
                          {registeredSpells.some((s) => s.id === spell.id) ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="text-xs"
                              onClick={() => unregisterSpell(spell.id)}
                            >
                              魔導書から削除
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="bg-purple-600 hover:bg-purple-700"
                              onClick={() => registerSpell(spell.id)}
                            >
                              魔導書に登録
                            </Button>
                          )}
                          <Button size="sm" variant="outline">
                            <Download className="h-3 w-3 mr-1" />
                            再ダウンロード
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {purchasedSpells.length === 0 && (
              <Card className="p-8 text-center bg-card/50">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">まだSpellを購入していません</h3>
                <p className="text-sm text-muted-foreground mb-4">Bazaarでお気に入りのSpellを見つけて購入しましょう</p>
                <Button>Bazaarを見る</Button>
              </Card>
            )}
          </TabsContent>

          {/* 詠唱タブ - 登録済みSpellをワンタップ実行 */}
          <TabsContent value="casting" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">詠唱可能なSpell</h2>
              <Badge variant="outline">{registeredSpells.length}個</Badge>
            </div>

            <div className="space-y-4">
              {registeredSpells.map((spell) => (
                <Card key={spell.id} className="bg-card/50 border-border/50">
                  <div className="p-4">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center flex-shrink-0">
                        <Wand2 className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground mb-1">{spell.name}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{spell.execution_mode}</p>
                        <div className="flex items-center gap-1 mb-3">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-xs">4.8</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-3">
                          <span>最終詠唱: 1日前</span>
                          <span>詠唱回数: {spell.stats?.executions || 0}回</span>
                        </div>
                        <Button
                          className="w-full bg-purple-600 hover:bg-purple-700"
                          size="sm"
                          onClick={() => handleCastSpell(spell.id)}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          詠唱実行
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {registeredSpells.length === 0 && (
              <Card className="p-8 text-center bg-card/50">
                <Wand2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">詠唱可能なSpellがありません</h3>
                <p className="text-sm text-muted-foreground mb-4">購入済みタブからSpellを魔導書に登録してください</p>
                <Button onClick={() => setGrimoireTab("purchased")}>購入済みを見る</Button>
              </Card>
            )}
          </TabsContent>

          {/* 創造タブ - 新しいSpellを登録・編集・公開 */}
          <TabsContent value="creation" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">作成したSpell</h2>
              <Button className="rounded-full">
                <Plus className="h-4 w-4 mr-1" />
                新しいSpell
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mySpells.map((spell) => (
                <Card key={spell.id} className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center">
                      <Database className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm">{spell.name}</h3>
                        <Badge variant={spell.status === "published" ? "default" : "secondary"} className="text-xs">
                          {spell.status === "published" ? "公開中" : "下書き"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{spell.execution_mode}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs">4.8</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">収益</span>
                      <span className="font-semibold text-primary">¥0</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">実行回数</span>
                      <span>{spell.stats?.executions || 0}回</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                      <Edit className="h-4 w-4 mr-1" />
                      編集
                    </Button>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {mySpells.length === 0 && (
              <Card className="p-8 text-center bg-card/50">
                <Wand2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">初めてのSpellを作成しましょう</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  あなたのコードを世界中の開発者と共有し、収益を得ることができます
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  Spellを作成
                </Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
