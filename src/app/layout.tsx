import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spell Platform',
  description: 'Headless spell execution API deployed on Vercel',
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
