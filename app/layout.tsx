import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { AppStoreTabBar } from "@/components/app-store-tab-bar"
import "./globals.css"

export const metadata: Metadata = {
  title: "Spell Platform - 呪文実行・販売プラットフォーム",
  description: "GitHub認証とStripe課金を基盤とした開発者向け呪文実行・販売プラットフォーム",
  generator: "v0.app",
}

// Force dynamic rendering to avoid build-time prerender of client pages
export const dynamic = "force-dynamic"
export const revalidate = 0

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} bg-background text-foreground`}>
        <div className="flex flex-col h-screen">
          <main className="flex-1 overflow-auto pb-20">
            <Suspense fallback={null}>{children}</Suspense>
          </main>
        </div>

        <AppStoreTabBar />
        <Analytics />
      </body>
    </html>
  )
}
