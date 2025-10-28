"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Receipt,
  TrendingUp,
  Download,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  spellName: string;
  spellCategory: string | null;
  makerName: string;
  amount: number;
  status: string;
}

interface MonthlyData {
  month: string;
  totalAmount: number;
  transactionCount: number;
  transactions: Transaction[];
}

interface PaymentData {
  summary: {
    totalSpent: number;
    totalTransactions: number;
    averageTransaction: number;
  };
  monthlyData: MonthlyData[];
  recentTransactions: Transaction[];
}

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-yellow-500" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="text-green-500 border-green-500/20">
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="text-red-500 border-red-500/20">
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-yellow-500 border-yellow-500/20">
          {status}
        </Badge>
      );
  }
}

export default function PaymentsPage() {
  const [data, setData] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPayments() {
      try {
        const response = await fetch("/api/payments");
        if (response.ok) {
          const paymentData = await response.json();
          setData(paymentData);
        }
      } catch (error) {
        console.error("Failed to fetch payments:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPayments();
  }, []);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-white/60">Loading payment history...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-white/60">Failed to load payment history</div>
        </div>
      </DashboardLayout>
    );
  }

  const downloadInvoice = (monthData: MonthlyData) => {
    // Generate a simple text invoice
    const invoiceText = `
SPELL MARKETPLACE INVOICE
${monthData.month}

Summary:
Total Amount: $${monthData.totalAmount.toFixed(2)}
Transaction Count: ${monthData.transactionCount}

Transactions:
${monthData.transactions
  .map(
    (t) =>
      `${new Date(t.date).toLocaleDateString()} - ${t.spellName} - $${t.amount.toFixed(2)} - ${t.status}`
  )
  .join("\n")}

Generated: ${new Date().toLocaleString()}
`;

    const blob = new Blob([invoiceText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${monthData.month.replace(" ", "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Payment History</h1>
          <p className="text-white/60">
            View your transaction history and download invoices
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-white/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${data.summary.totalSpent.toFixed(2)}
              </div>
              <p className="text-xs text-white/60 mt-1">All time</p>
            </CardContent>
          </Card>

          <Card className="border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Transactions
              </CardTitle>
              <Receipt className="h-4 w-4 text-white/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.summary.totalTransactions}
              </div>
              <p className="text-xs text-white/60 mt-1">Completed casts</p>
            </CardContent>
          </Card>

          <Card className="border-white/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Average Transaction
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-white/60" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${data.summary.averageTransaction.toFixed(2)}
              </div>
              <p className="text-xs text-white/60 mt-1">Per cast</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recentTransactions.length > 0 ? (
              <div className="space-y-4">
                {data.recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(transaction.status)}
                      <div>
                        <p className="font-semibold">{transaction.spellName}</p>
                        <div className="flex items-center gap-2 text-sm text-white/60">
                          <Calendar className="h-3 w-3" />
                          {new Date(transaction.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          <span>•</span>
                          <span>by {transaction.makerName}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {getStatusBadge(transaction.status)}
                      <p className="text-lg font-semibold">
                        ${transaction.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-white/60">
                No transactions yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Invoices */}
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle>Monthly Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyData.length > 0 ? (
              <div className="space-y-4">
                {data.monthlyData.map((monthData) => (
                  <div key={monthData.month} className="border border-white/10 rounded-lg">
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() =>
                        setExpandedMonth(
                          expandedMonth === monthData.month ? null : monthData.month
                        )
                      }
                    >
                      <div className="flex items-center gap-4">
                        <Calendar className="h-5 w-5 text-purple-500" />
                        <div>
                          <p className="font-semibold">{monthData.month}</p>
                          <p className="text-sm text-white/60">
                            {monthData.transactionCount} transactions
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-xl font-semibold">
                          ${monthData.totalAmount.toFixed(2)}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadInvoice(monthData);
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>

                    {expandedMonth === monthData.month && (
                      <div className="p-4 border-t border-white/10 bg-white/5">
                        <div className="space-y-3">
                          {monthData.transactions.map((transaction) => (
                            <div
                              key={transaction.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <div className="flex items-center gap-3">
                                {getStatusIcon(transaction.status)}
                                <span className="text-white/60">
                                  {new Date(transaction.date).toLocaleDateString()}
                                </span>
                                <span>{transaction.spellName}</span>
                              </div>
                              <span className="font-mono">
                                ${transaction.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-white/60">
                No invoices available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
