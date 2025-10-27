import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <h1 className="mb-8 text-6xl font-bold tracking-tight sm:text-8xl">Spell</h1>
        <p className="mb-12 text-xl text-muted-foreground">
          WASM-first execution platform
        </p>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link href="/catalog">
            <Button size="lg" className="w-full sm:w-auto">
              Catalog
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
