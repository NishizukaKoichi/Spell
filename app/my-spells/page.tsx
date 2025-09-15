"use client"

import { SpellSidebar } from "@/components/spell-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useSpellStore } from "@/lib/spell-store"
import { useState, useEffect } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Copy,
  BarChart3,
  DollarSign,
  Users,
  Star,
  GitBranch,
  Zap,
  Download,
  Settings,
  Archive,
  Play,
  Pause,
  TrendingUp,
  Clock,
} from "lucide-react"

interface Activity {
  id: string
  type: "execution" | "rating" | "update"
  spellName: string
  description: string
  time: string
  revenue: number
}

function SpellCard({ spell }: { spell: any }) {
  const { updateSpell, deleteSpell } = useSpellStore()
  const { toast } = useToast()

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "draft":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "archived":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "workflow":
        return <GitBranch className="h-3 w-3" />
      case "service":
        return <Zap className="h-3 w-3" />
      case "clone":
        return <Download className="h-3 w-3" />
      default:
        return <Settings className="h-3 w-3" />
    }
  }

  const handleToggleStatus = () => {
    const newStatus = spell.isActive ? false : true
    updateSpell(spell.id, { isActive: newStatus })

    toast({
      title: newStatus ? "Spellを公開しました" : "Spellを非公開にしました",
      description: `${spell.name}のステータスが更新されました。`,
    })
  }

  const handleDelete = () => {
    deleteSpell(spell.id)
    toast({
      title: "Spellを削除しました",
      description: `${spell.name}が削除されました。`,
    })
  }

  return (
    <Card className="group hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg group-hover:text-primary transition-colors">{spell.name}</CardTitle>
              <Badge className={getStatusColor(spell.isActive ? "published" : "draft")}>
                {spell.isActive ? "公開中" : "下書き"}
              </Badge>
              {spell.featured && <Badge className="bg-accent text-accent-foreground">注目</Badge>}
            </div>
            <CardDescription className="text-sm">{spell.description}</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="h-4 w-4 mr-2" />
                詳細を見る
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Edit className="h-4 w-4 mr-2" />
                編集
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="h-4 w-4 mr-2" />
                複製
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleToggleStatus}>
                {spell.isActive ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    非公開にする
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    公開する
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Archive className="h-4 w-4 mr-2" />
                アーカイブ
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1">
          {spell.tags.map((tag: string) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-1">
            {getModeIcon(spell.mode)}
            <span>{spell.mode}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{spell.lastUpdated}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{spell.executions}回実行</span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            <span>¥{(spell.executions * spell.price).toLocaleString()}</span>
          </div>
        </div>

        {spell.isActive && (
          <div className="flex items-center gap-4 pt-2 border-t">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{spell.rating.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-lg font-semibold text-accent">
                {spell.currency}
                {spell.price.toLocaleString()}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1 bg-transparent">
            <Edit className="h-3 w-3 mr-1" />
            編集
          </Button>
          <Button variant="outline" size="sm" className="flex-1 bg-transparent">
            <BarChart3 className="h-3 w-3 mr-1" />
            統計
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function MySpellsPage() {
  const { spells, stats } = useSpellStore()
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredSpells, setFilteredSpells] = useState(spells)
  const [activities, setActivities] = useState<Activity[]>([])

  useEffect(() => {
    const filtered = spells.filter(
      (spell) =>
        spell.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        spell.description.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    setFilteredSpells(filtered)
  }, [spells, searchQuery])

  useEffect(() => {
    const generateActivity = () => {
      const activeSpells = spells.filter((spell) => spell.isActive)
      if (activeSpells.length === 0) return

      const randomSpell = activeSpells[Math.floor(Math.random() * activeSpells.length)]
      const activityTypes = ["execution", "rating", "update"] as const
      const randomType = activityTypes[Math.floor(Math.random() * activityTypes.length)]

      const newActivity: Activity = {
        id: Date.now().toString(),
        type: randomType,
        spellName: randomSpell.name,
        description:
          randomType === "execution"
            ? "新しい実行が完了しました"
            : randomType === "rating"
              ? `新しい評価を受けました (★${Math.floor(Math.random() * 2) + 4})`
              : "バージョンが更新されました",
        time: "今",
        revenue: randomType === "execution" ? randomSpell.price : 0,
      }

      setActivities((prev) => [newActivity, ...prev.slice(0, 9)])
    }

    // 10秒ごとに新しいアクティビティを生成
    const interval = setInterval(generateActivity, 10000)
    return () => clearInterval(interval)
  }, [spells])

  const mySpells = filteredSpells
  const totalRevenue = mySpells.reduce((sum, spell) => sum + spell.executions * spell.price, 0)
  const totalExecutions = mySpells.reduce((sum, spell) => sum + spell.executions, 0)
  const publishedSpells = mySpells.filter((spell) => spell.isActive).length

  return (
    <SpellSidebar>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-balance">マイSpell</h1>
            <p className="text-muted-foreground text-pretty">
              作成したSpellの管理、統計の確認、新しいSpellの作成ができます。
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新しいSpell作成
          </Button>
        </div>

        {/* 統計カード */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総Spell数</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mySpells.length}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-accent">{publishedSpells}</span> 公開中
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総実行回数</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalExecutions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-accent">+12%</span> 先月比
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">総収益</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥{totalRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-accent">+18%</span> 先月比
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均評価</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageRating.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-accent">{totalExecutions}</span> 件の評価
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="spells" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="spells">Spell一覧</TabsTrigger>
            <TabsTrigger value="analytics">分析</TabsTrigger>
            <TabsTrigger value="activity">アクティビティ</TabsTrigger>
          </TabsList>

          <TabsContent value="spells" className="space-y-4">
            {/* 検索とフィルター */}
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Spellを検索..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline">すべて ({mySpells.length})</Button>
              <Button variant="outline">公開中 ({publishedSpells})</Button>
              <Button variant="outline">下書き ({mySpells.length - publishedSpells})</Button>
            </div>

            {/* Spellカード */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredSpells.map((spell) => (
                <SpellCard key={spell.id} spell={spell} />
              ))}
            </div>

            {filteredSpells.length === 0 && (
              <div className="text-center py-12">
                <p className="text-muted-foreground">条件に一致するSpellが見つかりませんでした。</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* 収益推移 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    収益推移（リアルタイム）
                  </CardTitle>
                  <CardDescription>Spellごとの収益とパフォーマンス</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mySpells
                      .filter((spell) => spell.isActive)
                      .sort((a, b) => b.executions * b.price - a.executions * a.price)
                      .map((spell) => {
                        const revenue = spell.executions * spell.price
                        return (
                          <div key={spell.id} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{spell.name}</span>
                              <span>¥{revenue.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0}
                                className="flex-1 h-2"
                              />
                              <span className="text-xs text-muted-foreground w-12">
                                {totalRevenue > 0 ? ((revenue / totalRevenue) * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {spell.executions}回実行 • 評価 {spell.rating.toFixed(1)}
                            </p>
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
              </Card>

              {/* Spell別パフォーマンス */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    実行統計
                  </CardTitle>
                  <CardDescription>各Spellの実行回数と評価</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mySpells
                      .filter((spell) => spell.isActive)
                      .sort((a, b) => b.executions - a.executions)
                      .map((spell) => (
                        <div key={spell.id} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{spell.name}</span>
                            <span>{spell.executions}回</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={totalExecutions > 0 ? (spell.executions / totalExecutions) * 100 : 0}
                              className="flex-1 h-2"
                            />
                            <span className="text-xs text-muted-foreground w-12">
                              {totalExecutions > 0 ? ((spell.executions / totalExecutions) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            評価 {spell.rating.toFixed(1)} • ¥{spell.price.toLocaleString()}/回
                          </p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  リアルタイムアクティビティ
                </CardTitle>
                <CardDescription>Spellに関する最新の活動履歴（自動更新）</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activities.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">アクティビティはまだありません。</p>
                      <p className="text-sm text-muted-foreground">Spellが実行されると、ここに表示されます。</p>
                    </div>
                  ) : (
                    activities.map((activity) => (
                      <div key={activity.id} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className="flex-shrink-0">
                          {activity.type === "execution" && (
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                              <Play className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                          )}
                          {activity.type === "rating" && (
                            <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                              <Star className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                            </div>
                          )}
                          {activity.type === "update" && (
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                              <Edit className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{activity.spellName}</p>
                          <p className="text-sm text-muted-foreground">{activity.description}</p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                        {activity.revenue > 0 && (
                          <div className="text-right">
                            <p className="font-medium text-accent">+¥{activity.revenue.toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SpellSidebar>
  )
}
