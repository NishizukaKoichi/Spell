"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Zap,
  Star,
  CheckCircle,
  XCircle,
  Target,
} from "lucide-react";

interface Stats {
  maker: {
    totalRevenue: number;
    totalCasts: number;
    totalSpells: number;
    topSpells: Array<{
      id: string;
      name: string;
      totalCasts: number;
      revenue: number;
      rating: number | null;
    }>;
    monthlyRevenue: Array<{ month: string; revenue: number }>;
  };
  caster: {
    totalSpending: number;
    totalCasts: number;
    completedCasts: number;
    failedCasts: number;
    successRate: string;
    topSpells: Array<{
      id: string;
      name: string;
      category: string | null;
      count: number;
      spending: number;
    }>;
    monthlySpending: Array<{ month: string; spending: number }>;
    spendingByCategory: Array<{ category: string; spending: number }>;
  };
}

const COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-white/60">Loading statistics...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!stats) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-white/60">Failed to load statistics</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
          <p className="text-white/60">
            View your spell marketplace statistics and insights
          </p>
        </div>

        <Tabs defaultValue="caster" className="space-y-6">
          <TabsList>
            <TabsTrigger value="caster">As Caster</TabsTrigger>
            <TabsTrigger value="maker">As Maker</TabsTrigger>
          </TabsList>

          {/* Caster Statistics */}
          <TabsContent value="caster" className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-white/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Spending
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-white/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${stats.caster.totalSpending.toFixed(2)}
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    Across {stats.caster.totalCasts} casts
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Casts
                  </CardTitle>
                  <Zap className="h-4 w-4 text-white/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.caster.totalCasts}
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    Spell executions
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Success Rate
                  </CardTitle>
                  <Target className="h-4 w-4 text-white/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.caster.successRate}%
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    <CheckCircle className="h-3 w-3 inline text-green-500" />{" "}
                    {stats.caster.completedCasts} completed{" "}
                    <XCircle className="h-3 w-3 inline text-red-500" />{" "}
                    {stats.caster.failedCasts} failed
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Avg Cost per Cast
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-white/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    $
                    {stats.caster.totalCasts > 0
                      ? (
                          stats.caster.totalSpending / stats.caster.totalCasts
                        ).toFixed(2)
                      : "0.00"}
                  </div>
                  <p className="text-xs text-white/60 mt-1">Per execution</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Spending Chart */}
              <Card className="border-white/10">
                <CardHeader>
                  <CardTitle>Monthly Spending</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.caster.monthlySpending.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={stats.caster.monthlySpending}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                        <XAxis dataKey="month" stroke="#ffffff60" />
                        <YAxis stroke="#ffffff60" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #ffffff20",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="spending"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-white/60">
                      No spending data yet
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Spending by Category */}
              <Card className="border-white/10">
                <CardHeader>
                  <CardTitle>Spending by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {stats.caster.spendingByCategory.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={stats.caster.spendingByCategory}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(props: any) => `${props.category}: $${props.spending.toFixed(2)}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="spending"
                        >
                          {stats.caster.spendingByCategory.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1a1a1a",
                            border: "1px solid #ffffff20",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-white/60">
                      No category data yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Spells */}
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle>Most Used Spells</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.caster.topSpells.length > 0 ? (
                  <div className="space-y-4">
                    {stats.caster.topSpells.map((spell, index) => (
                      <div
                        key={spell.id}
                        className="flex items-center justify-between p-4 bg-white text-black/5 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-white/40">
                            #{index + 1}
                          </div>
                          <div>
                            <p className="font-semibold">{spell.name}</p>
                            <p className="text-sm text-white/60">
                              {spell.category || "Uncategorized"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{spell.count} casts</p>
                          <p className="text-sm text-white/60">
                            ${spell.spending.toFixed(2)} spent
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-white/60">
                    No spells used yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maker Statistics */}
          <TabsContent value="maker" className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="border-white/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Revenue
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-white/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${stats.maker.totalRevenue.toFixed(2)}
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    From {stats.maker.totalCasts} casts
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Spells
                  </CardTitle>
                  <Star className="h-4 w-4 text-white/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.maker.totalSpells}
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    Published spells
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Usage
                  </CardTitle>
                  <Zap className="h-4 w-4 text-white/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.maker.totalCasts}
                  </div>
                  <p className="text-xs text-white/60 mt-1">
                    Times your spells were cast
                  </p>
                </CardContent>
              </Card>

              <Card className="border-white/10">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Avg Revenue per Spell
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-white/60" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    $
                    {stats.maker.totalSpells > 0
                      ? (
                          stats.maker.totalRevenue / stats.maker.totalSpells
                        ).toFixed(2)
                      : "0.00"}
                  </div>
                  <p className="text-xs text-white/60 mt-1">Per spell</p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Chart */}
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle>Monthly Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.maker.monthlyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.maker.monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                      <XAxis dataKey="month" stroke="#ffffff60" />
                      <YAxis stroke="#ffffff60" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1a1a1a",
                          border: "1px solid #ffffff20",
                        }}
                      />
                      <Bar dataKey="revenue" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-white/60">
                    No revenue data yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Performing Spells */}
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle>Top Performing Spells</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.maker.topSpells.length > 0 ? (
                  <div className="space-y-4">
                    {stats.maker.topSpells.map((spell, index) => (
                      <div
                        key={spell.id}
                        className="flex items-center justify-between p-4 bg-white text-black/5 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-white/40">
                            #{index + 1}
                          </div>
                          <div>
                            <p className="font-semibold">{spell.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {spell.rating && (
                                <div className="flex items-center gap-1 text-sm text-white/60">
                                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                  {spell.rating.toFixed(1)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{spell.totalCasts} casts</p>
                          <p className="text-sm text-white/60">
                            ${spell.revenue.toFixed(2)} revenue
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-white/60">
                    No spells published yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
