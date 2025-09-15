"use client"

import { SpellSidebar } from "@/components/spell-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useSpellStore } from "@/lib/spell-store"
import { useState, useEffect } from "react"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  PieChart,
  Receipt,
  Shield,
} from "lucide-react"

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  status: "完了" | "返金済み" | "処理中"
  spellName: string
  executionId: string
}

export default function BillingPage() {
  const { spells, stats } = useSpellStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [currentUsage, setCurrentUsage] = useState({
    monthlySpent: 0,
    monthlyLimit: 50000,
    executionCount: 0,
    executionLimit: 2000,
  })

  useEffect(() => {
    const totalSpent = spells.reduce((sum, spell) => sum + spell.executions * spell.price, 0)
    const totalExecutions = spells.reduce((sum, spell) => sum + spell.executions, 0)

    setCurrentUsage((prev) => ({
      ...prev,
      monthlySpent: totalSpent,
      executionCount: totalExecutions,
    }))
  }, [spells])

  useEffect(() => {
    const generateTransactions = () => {
      const newTransactions: Transaction[] = []

      spells.forEach((spell) => {
        if (spell.executions > 0) {
          // 各Spellの実行に基づいて取引を生成
          for (let i = 0; i < Math.min(spell.executions, 5); i++) {
            newTransactions.push({
              id: `tx_${spell.id}_${i}`,
              date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
              description: `${spell.name}実行`,
              amount: spell.price,
              status: Math.random() > 0.1 ? "完了" : Math.random() > 0.5 ? "返金済み" : "処理中",
              spellName: spell.name,
              executionId: `run_${Date.now()}_${i}`,
            })
          }
        }
      })

      // 日付順にソート
      newTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      setTransactions(newTransactions.slice(0, 20)) // 最新20件
    }

    generateTransactions()
  }, [spells])

  const usagePercentage = (currentUsage.monthlySpent / currentUsage.monthlyLimit) * 100
  const executionPercentage = (currentUsage.executionCount / currentUsage.executionLimit) * 100

  const topSpells = spells
    .filter((spell) => spell.executions > 0)
    .map((spell) => ({
      name: spell.name,
      spent: spell.executions * spell.price,
      executions: spell.executions,
      percentage:
        currentUsage.monthlySpent > 0 ? ((spell.executions * spell.price) / currentUsage.monthlySpent) * 100 : 0,
    }))
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5)

  return (
    <SpellSidebar>
      <div className="space-y-6">
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-balance">課金・使用量管理</h1>
            <p className="text-muted-foreground text-pretty">
              使用量の監視、支払い方法の管理、取引履歴の確認ができます。
            </p>
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            請求書をダウンロード
          </Button>
        </div>

        {/* 使用量アラート */}
        {usagePercentage > 90 && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">月間使用量上限に近づいています</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    現在の使用量: ¥{currentUsage.monthlySpent.toLocaleString()} / ¥
                    {currentUsage.monthlyLimit.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 使用量概要 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今月の使用金額</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">¥{currentUsage.monthlySpent.toLocaleString()}</div>
              <div className="mt-2">
                <Progress value={usagePercentage} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  上限: ¥{currentUsage.monthlyLimit.toLocaleString()} ({usagePercentage.toFixed(1)}%)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">実行回数</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentUsage.executionCount.toLocaleString()}</div>
              <div className="mt-2">
                <Progress value={executionPercentage} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  上限: {currentUsage.executionLimit.toLocaleString()}回 ({executionPercentage.toFixed(1)}%)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均実行コスト</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ¥
                {currentUsage.executionCount > 0
                  ? Math.round(currentUsage.monthlySpent / currentUsage.executionCount)
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-600">リアルタイム</span> 更新中
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">残り予算</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ¥{(currentUsage.monthlyLimit - currentUsage.monthlySpent).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">今月残り</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="usage" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="usage">使用量詳細</TabsTrigger>
            <TabsTrigger value="transactions">取引履歴</TabsTrigger>
            <TabsTrigger value="settings">設定</TabsTrigger>
          </TabsList>

          <TabsContent value="usage" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Spell別使用量 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Spell別使用量（リアルタイム）
                  </CardTitle>
                  <CardDescription>今月最も使用されているSpell</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topSpells.length > 0 ? (
                      topSpells.map((spell, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{spell.name}</span>
                            <span>¥{spell.spent.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={spell.percentage} className="flex-1 h-2" />
                            <span className="text-xs text-muted-foreground w-12">{spell.percentage.toFixed(1)}%</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{spell.executions}回実行</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">まだSpellの実行がありません</p>
                        <p className="text-sm text-muted-foreground">Spellを実行すると、ここに使用量が表示されます</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 統計サマリー */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    プラットフォーム統計
                  </CardTitle>
                  <CardDescription>全体的な使用状況</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">アクティブSpell数</span>
                      <span className="font-medium">{spells.filter((s) => s.isActive).length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">総実行回数</span>
                      <span className="font-medium">{stats.totalExecutions.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">平均評価</span>
                      <span className="font-medium">{stats.averageRating.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">開発者数</span>
                      <span className="font-medium">{stats.activeDevelopers}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  取引履歴（リアルタイム更新）
                </CardTitle>
                <CardDescription>最近の支払いと返金の履歴</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {transactions.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>日付</TableHead>
                          <TableHead>説明</TableHead>
                          <TableHead>金額</TableHead>
                          <TableHead>ステータス</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.slice(0, 10).map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-mono text-sm">{transaction.date}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{transaction.description}</p>
                                <p className="text-sm text-muted-foreground">{transaction.spellName}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">¥{transaction.amount.toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  transaction.status === "完了"
                                    ? "default"
                                    : transaction.status === "返金済み"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {transaction.status === "完了" && <CheckCircle className="h-3 w-3 mr-1" />}
                                {transaction.status === "返金済み" && <TrendingDown className="h-3 w-3 mr-1" />}
                                {transaction.status === "処理中" && <Clock className="h-3 w-3 mr-1" />}
                                {transaction.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">取引履歴がありません</p>
                      <p className="text-sm text-muted-foreground">Spellを実行すると、取引が記録されます</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  使用量制限設定
                </CardTitle>
                <CardDescription>月間の使用量上限を設定して予期しない課金を防止</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">月間使用金額上限 (¥)</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded-md"
                      defaultValue={currentUsage.monthlyLimit}
                      placeholder="50000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">月間実行回数上限</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border rounded-md"
                      defaultValue={currentUsage.executionLimit}
                      placeholder="2000"
                    />
                  </div>
                </div>
                <Button>設定を保存</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  リアルタイム監視
                </CardTitle>
                <CardDescription>使用量のリアルタイム監視設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">リアルタイム更新</p>
                    <p className="text-sm text-muted-foreground">使用量を自動的に更新</p>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">使用量アラート</p>
                    <p className="text-sm text-muted-foreground">上限の80%に達したときに通知</p>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">即座通知</p>
                    <p className="text-sm text-muted-foreground">Spell実行時の即座通知</p>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SpellSidebar>
  )
}
