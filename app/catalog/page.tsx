"use client"

import { SpellSidebar } from "@/components/spell-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { castSpell, onCastProgress } from "@/lib/api"
import { useSpellStore, type Spell } from "@/lib/spell-store"
import { useEffect, useState } from "react"
import {
  Search,
  Filter,
  Star,
  Play,
  Download,
  Code2,
  Zap,
  GitBranch,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  Eye,
} from "lucide-react"

const categories = ["すべて", "文書処理", "画像処理", "データサイエンス", "通信", "フロントエンド", "ドキュメント"]
const modes = ["すべて", "workflow", "service", "clone"]

function SpellCard({ spell }: { spell: Spell }) {
  const { executeSpell } = useSpellStore()
  const { toast } = useToast()
  const [isExecuting, setIsExecuting] = useState(false)

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "workflow":
        return <GitBranch className="h-3 w-3" />
      case "service":
        return <Zap className="h-3 w-3" />
      case "clone":
        return <Download className="h-3 w-3" />
      default:
        return <Code2 className="h-3 w-3" />
    }
  }

  const getModeColor = (mode: string) => {
    switch (mode) {
      case "workflow":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "service":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "clone":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const handleExecute = async () => {
    setIsExecuting(true)
    try {
      const res = await castSpell(spell.id, { demo: true })
      const stop = onCastProgress(res.cast_id, (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data?.pct) {
            // Optional: could set local state for a progress bar
          }
        } catch {}
      })
      // simulate waiting a bit then close stream; SSE will auto-close on completion
      setTimeout(() => stop(), 8000)

      executeSpell(spell.id)
      toast({
        title: "Spellをキューに登録しました",
        description: `cast #${res.cast_id} 実行を開始しました。`,
      })
    } catch (error) {
      toast({
        title: "実行エラー",
        description: "Spellの実行中にエラーが発生しました。",
        variant: "destructive",
      })
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={spell.avatar || "/placeholder.svg"} />
              <AvatarFallback>{spell.author[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg group-hover:text-primary transition-colors">
                {spell.name}
                {spell.featured && <Badge className="ml-2 bg-accent text-accent-foreground">注目</Badge>}
              </CardTitle>
              <p className="text-sm text-muted-foreground">by {spell.author}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-medium">{spell.rating.toFixed(1)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <CardDescription className="text-sm leading-relaxed">{spell.description}</CardDescription>

        <div className="flex flex-wrap gap-1">
          {spell.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>{spell.executions.toLocaleString()}回実行</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{spell.lastUpdated}</span>
            </div>
          </div>
          <Badge className={getModeColor(spell.mode)}>
            {getModeIcon(spell.mode)}
            <span className="ml-1">{spell.mode}</span>
          </Badge>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-accent" />
            <span className="text-lg font-semibold text-accent">
              {spell.currency}
              {spell.price.toLocaleString()}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Eye className="h-3 w-3 mr-1" />
              詳細
            </Button>
            <Button size="sm" onClick={handleExecute} disabled={isExecuting}>
              <Play className="h-3 w-3 mr-1" />
              {isExecuting ? "実行中..." : "実行"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CatalogPage() {
  const {
    searchQuery,
    selectedCategory,
    selectedMode,
    activeTab,
    stats,
    setSearchQuery,
    setSelectedCategory,
    setSelectedMode,
    setActiveTab,
    getFilteredSpells,
    updateStats,
  } = useSpellStore()

  const [filteredSpells, setFilteredSpells] = useState<Spell[]>([])

  useEffect(() => {
    const filtered = getFilteredSpells()
    setFilteredSpells(filtered)
  }, [searchQuery, selectedCategory, selectedMode, activeTab, getFilteredSpells])

  useEffect(() => {
    const interval = setInterval(() => {
      updateStats()
    }, 5000) // 5秒ごとに統計を更新

    return () => clearInterval(interval)
  }, [updateStats])

  return (
    <SpellSidebar>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div>
          <h1 className="text-3xl font-bold text-balance">Spellカタログ</h1>
          <p className="text-muted-foreground text-pretty">
            コミュニティが作成した高品質なSpellを発見し、すぐに実行できます。
          </p>
        </div>

        {/* 検索とフィルター */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Spellを検索..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="カテゴリ" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMode} onValueChange={setSelectedMode}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="実行モード" />
              </SelectTrigger>
              <SelectContent>
                {modes.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* タブ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">すべて ({filteredSpells.length})</TabsTrigger>
            <TabsTrigger value="featured">注目</TabsTrigger>
            <TabsTrigger value="popular">人気</TabsTrigger>
            <TabsTrigger value="recent">最新</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
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

          <TabsContent value="featured" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredSpells.map((spell) => (
                <SpellCard key={spell.id} spell={spell} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="popular" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredSpells.map((spell) => (
                <SpellCard key={spell.id} spell={spell} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="recent" className="mt-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredSpells.map((spell) => (
                <SpellCard key={spell.id} spell={spell} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* 統計情報 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              マーケットプレイス統計（リアルタイム）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats.totalSpells.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">総Spell数</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">{stats.totalExecutions.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">総実行回数</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">{stats.activeDevelopers}</div>
                <p className="text-sm text-muted-foreground">アクティブ開発者</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats.averageRating.toFixed(1)}</div>
                <p className="text-sm text-muted-foreground">平均評価</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SpellSidebar>
  )
}
