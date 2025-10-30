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
        url: '/logo.png',
        width: 402,
        height: 402,
        alt: 'Spell Platform Logo',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Spell Platform',
    description: 'WASM-first execution platform for creator-to-consumer workflows',
    images: ['/logo.png'],
  },
  icons: {
    icon: [
      { url: '/icon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon.ico', type: 'image/x-icon' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
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
