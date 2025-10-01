import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Spell Platform",
  description: "ワンタップで詠唱。コードを呪文に変えるCtoCマーケットプレイス",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className="dark">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} bg-slate-900 text-white antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}