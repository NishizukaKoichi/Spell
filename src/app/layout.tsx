import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'Spell Platform',
  description: 'WASM-first execution platform for creator-to-consumer workflows',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
