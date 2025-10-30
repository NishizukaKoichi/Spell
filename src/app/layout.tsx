import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: {
    default: 'Spell Platform',
    template: '%s | Spell Platform',
  },
  description: 'WASM-first execution platform for creator-to-consumer workflows',
  applicationName: 'Spell Platform',
  authors: [{ name: 'Spell Platform' }],
  generator: 'Next.js',
  keywords: ['spell', 'wasm', 'webassembly', 'automation', 'workflow', 'api'],
  referrer: 'origin-when-cross-origin',
  creator: 'Spell Platform',
  publisher: 'Spell Platform',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://magicspell.io'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Spell Platform',
    description: 'WASM-first execution platform for creator-to-consumer workflows',
    url: 'https://magicspell.io',
    siteName: 'Spell Platform',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/logo.svg',
        width: 512,
        height: 512,
        alt: 'Spell Platform Logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Spell Platform',
    description: 'WASM-first execution platform for creator-to-consumer workflows',
    images: ['/logo.svg'],
  },
  icons: {
    icon: [
      { url: '/logo.svg', type: 'image/svg+xml' },
      { url: '/icon', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
