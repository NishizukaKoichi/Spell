import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spell Platform',
  description: 'WASM-first execution platform for creator-to-consumer workflows',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
