import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Download, CheckCircle, XCircle, Clock, DollarSign, Activity, Receipt } from "lucide-react"

export default function AuditPage() {
  const executionLogs = [
    {
      id: "exec_001",
      spellName: "AI画像生成API",
      status: "success",
      timestamp: "2024-12-08 14:30:25",
      duration: "2.3s",
      cost: "¥50",
      artifacts: ["image_001.png", "metadata.json"],
    },
    {
      id: "exec_002",
      spellName: "PDF生成ツール",
      status: "success",
      timestamp: "2024-12-08 12:15:10",
      duration: "1.8s",
      cost: "¥30",
      artifacts: ["document.pdf"],
    },
    {
      id: "exec_003",
      spellName: "データ分析エンジン",
      status: "failed",
      timestamp: "2024-12-08 10:45:33",
      duration: "0.5s",
      cost: "¥0",
      artifacts: [],
      error: "Invalid input format",
    },
    {
      id: "exec_004",
      spellName: "メール送信API",
      status: "running",
      timestamp: "2024-12-08 15:22:18",
      duration: "実行中...",
      cost: "¥15",
      artifacts: [],
    },
  ]

  const billingHistory = [
    {
      id: "bill_001",
      date: "2024-12-01",
      amount: "¥2,450",
      spells: 23,
      status: "paid",
      invoice: "INV-2024-12-001",
    },
    {
      id: "bill_002",
      date: "2024-11-01",
      amount: "¥1,890",
      spells: 18,
      status: "paid",
      invoice: "INV-2024-11-001",
    },
    {
      id: "bill_003",
      date: "2024-10-01",
      amount: "¥3,120",
      spells: 31,
      status: "paid",
      invoice: "INV-2024-10-001",
    },
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "running":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">成功</Badge>
      case "failed":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">失敗</Badge>
      case "running":
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">実行中</Badge>
      default:
        return <Badge variant="outline">不明</Badge>
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-background min-h-screen">
      {/* モバイル用ヘッダー */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-md z-10 px-4 py-4 border-b border-border md:hidden">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Audit</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">詠唱ログと課金履歴</p>
      </div>

      {/* デスクトップ用ヘッダー */}
      <div className="hidden md:block px-6 py-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Audit</h1>
        </div>
        <p className="text-muted-foreground">詠唱ログ・成果物・課金履歴の監査</p>
      </div>

      <div className="px-4 md:px-6 pb-6">
        <Tabs defaultValue="logs" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              実行ログ
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              課金履歴
            </TabsTrigger>
          </TabsList>

          {/* 実行ログタブ */}
          <TabsContent value="logs" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">詠唱ログ</h2>
              <Badge variant="outline">{executionLogs.length}件</Badge>
            </div>

            <div className="space-y-3">
              {executionLogs.map((log) => (
                <Card key={log.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(log.status)}
                      <div>
                        <h3 className="font-semibold text-sm">{log.spellName}</h3>
                        <p className="text-xs text-muted-foreground">ID: {log.id}</p>
                        <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                      </div>
                    </div>
                    {getStatusBadge(log.status)}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">実行時間</span>
                      <p className="font-medium">{log.duration}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">コスト</span>
                      <p className="font-medium text-primary">{log.cost}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">成果物</span>
                      <p className="font-medium">{log.artifacts.length}個</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ステータス</span>
                      <p className="font-medium">{log.status}</p>
                    </div>
                  </div>

                  {log.error && (
                    <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs">
                      <span className="text-red-500 font-medium">エラー: </span>
                      <span className="text-red-400">{log.error}</span>
                    </div>
                  )}

                  {log.artifacts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {log.artifacts.map((artifact, i) => (
                        <Button key={i} variant="outline" size="sm" className="text-xs bg-transparent">
                          <Download className="h-3 w-3 mr-1" />
                          {artifact}
                        </Button>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 課金履歴タブ */}
          <TabsContent value="billing" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">課金履歴</h2>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                全て出力
              </Button>
            </div>

            <div className="space-y-3">
              {billingHistory.map((bill) => (
                <Card key={bill.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{bill.date}</h3>
                        <p className="text-xs text-muted-foreground">請求書: {bill.invoice}</p>
                      </div>
                    </div>
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/20">支払済み</Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">金額</span>
                      <p className="font-semibold text-lg text-primary">{bill.amount}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">実行回数</span>
                      <p className="font-medium">{bill.spells}回</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">平均コスト</span>
                      <p className="font-medium">
                        ¥{Math.round(Number.parseInt(bill.amount.replace(/[¥,]/g, "")) / bill.spells)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                      <Download className="h-4 w-4 mr-1" />
                      領収書DL
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 bg-transparent">
                      詳細を見る
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
