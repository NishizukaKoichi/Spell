'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mockCasts, mockBudget, mockUsageData } from '@/lib/mock-data'
import {
  Zap,
  DollarSign,
  Package,
  TrendingUp,
  Download,
  FileText,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function DashboardPage() {
  const stats = useMemo(() => {
    const totalCasts = mockCasts.length
    const totalSpent = mockCasts.reduce((sum, cast) => sum + cast.cost, 0) / 100
    const activeSpells = new Set(mockCasts.map((cast) => cast.spellId)).size
    const budgetRemaining = mockBudget.cap - mockBudget.used

    return {
      totalCasts,
      totalSpent: totalSpent.toFixed(2),
      activeSpells,
      budgetRemaining: budgetRemaining.toFixed(2),
    }
  }, [])

  const getStatusBadge = (status: string) => {
    return <Badge variant="outline">{status}</Badge>
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-8">
          <h1 className="mb-2 text-4xl font-bold">Dashboard</h1>
          <p className="text-lg text-muted-foreground">
            Monitor your spell casts and usage
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Casts
              </CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalCasts}</div>
              <p className="mt-1 text-xs text-muted-foreground">Lifetime executions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Spent
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${stats.totalSpent}</div>
              <p className="mt-1 text-xs text-muted-foreground">This month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Spells
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.activeSpells}</div>
              <p className="mt-1 text-xs text-muted-foreground">In use</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Budget Remaining
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${stats.budgetRemaining}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                of ${mockBudget.cap.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Usage Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Usage This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockUsageData.map((data) => (
                <div key={data.day} className="flex items-center gap-4">
                  <div className="w-12 text-sm font-medium text-muted-foreground">
                    {data.day}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span>{data.casts} casts</span>
                      <span className="font-medium">${data.cost.toFixed(2)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-foreground transition-all"
                        style={{ width: `${(data.casts / 20) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Casts Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Casts</CardTitle>
              <Link href="/catalog">
                <Button variant="outline" size="sm">
                  Browse Catalog
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                      Spell Name
                    </th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="pb-3 text-left text-sm font-medium text-muted-foreground">
                      Time
                    </th>
                    <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                      Duration
                    </th>
                    <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                      Cost
                    </th>
                    <th className="pb-3 text-right text-sm font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mockCasts.map((cast) => (
                    <tr key={cast.castId} className="border-b last:border-b-0">
                      <td className="py-4">
                        <Link
                          href={`/spells/${cast.spellId}`}
                          className="font-medium hover:underline"
                        >
                          {cast.spellName}
                        </Link>
                      </td>
                      <td className="py-4">
                        {getStatusBadge(cast.status)}
                      </td>
                      <td className="py-4 text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(cast.timestamp), { addSuffix: true })}
                      </td>
                      <td className="py-4 text-right text-sm text-muted-foreground">
                        {cast.duration ? `${cast.duration}ms` : '-'}
                      </td>
                      <td className="py-4 text-right font-medium">
                        ${(cast.cost / 100).toFixed(2)}
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <FileText className="h-4 w-4" />
                          </Button>
                          {cast.status === 'succeeded' && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
