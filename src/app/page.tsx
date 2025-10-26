import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowRight,
  Zap,
  Shield,
  DollarSign,
  Globe,
  BarChart3,
  Lock,
  GitBranch,
  Package,
  Rocket,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/20 pt-20 pb-16 sm:pt-32 sm:pb-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-8 flex justify-center gap-2">
              <Badge variant="secondary" className="text-xs">
                99.99% Uptime
              </Badge>
              <Badge variant="secondary" className="text-xs">
                &lt;100ms Latency
              </Badge>
              <Badge variant="secondary" className="text-xs">
                GDPR Compliant
              </Badge>
            </div>

            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl">
              Turn Your Code Into{' '}
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Revenue
              </span>
            </h1>

            <p className="mb-8 text-lg text-muted-foreground sm:text-xl">
              Package workflows as WASM Spells. Execute via API. Get paid automatically.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" asChild>
                <Link href="/catalog">
                  Browse Catalog <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/docs">View Documentation</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* For Makers */}
            <Card className="border-2">
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Package className="h-6 w-6 text-blue-600" />
                  <CardTitle className="text-2xl">For Makers</CardTitle>
                </div>
                <CardDescription>Monetize Your Tools Instantly</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                    <span>Compile to WASM, deploy in minutes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <DollarSign className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                    <span>Pay-per-use, subscriptions, or one-time sales</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Rocket className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                    <span>Zero infrastructure management</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <BarChart3 className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                    <span>Built-in billing & analytics</span>
                  </li>
                </ul>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/makers">Start Selling</Link>
                </Button>
              </CardContent>
            </Card>

            {/* For Casters */}
            <Card className="border-2">
              <CardHeader>
                <div className="mb-2 flex items-center gap-2">
                  <Zap className="h-6 w-6 text-purple-600" />
                  <CardTitle className="text-2xl">For Casters</CardTitle>
                </div>
                <CardDescription>Execute Anything via API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <Globe className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                    <span>One API endpoint for all functions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <DollarSign className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                    <span>Pay only for what you use</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Zap className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                    <span>Sub-second execution (WASM)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
                    <span>Budget controls & usage limits</span>
                  </li>
                </ul>
                <Button className="w-full" asChild>
                  <Link href="/catalog">Browse Spells</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/30 py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">How It Works</h2>
            <p className="text-lg text-muted-foreground">Three simple steps to get started</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="relative">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white">
                <Package className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">1. Create or Discover</h3>
              <p className="text-muted-foreground">
                Package your code as a Spell (WASM) or find the perfect Spell in our catalog.
              </p>
            </div>

            <div className="relative">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-white">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">2. Execute</h3>
              <p className="text-muted-foreground">
                Users cast your Spell via API, or make an API call with your input.
              </p>
            </div>

            <div className="relative">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white">
                <DollarSign className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">3. Get Paid / Get Results</h3>
              <p className="text-muted-foreground">
                Automatic payments & revenue split, or receive artifacts & results instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Key Features</h2>
            <p className="text-lg text-muted-foreground">
              Enterprise-grade platform built for scale
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <Lock className="mb-2 h-8 w-8 text-blue-600" />
                <CardTitle>Secure Execution</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  WASM sandboxing with resource limits and supply chain verification (SBOM +
                  Sigstore)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <DollarSign className="mb-2 h-8 w-8 text-green-600" />
                <CardTitle>Built-in Monetization</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Stripe integration with automatic tax handling. Pay-per-use, subscriptions, or
                  buy-once.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="mb-2 h-8 w-8 text-yellow-600" />
                <CardTitle>Low Latency</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Edge deployment with &lt;100ms p99 latency and sub-second cold starts.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Globe className="mb-2 h-8 w-8 text-purple-600" />
                <CardTitle>API-First</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  RESTful API with MCP integration. Works with any language or platform.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="mb-2 h-8 w-8 text-orange-600" />
                <CardTitle>Observability</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Real-time execution logs and usage analytics with billing dashboard.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="mb-2 h-8 w-8 text-red-600" />
                <CardTitle>Enterprise Ready</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  GDPR/CCPA compliant with SOC 2 roadmap and complete audit trails.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Execution Modes */}
      <section className="bg-muted/30 py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Execution Modes</h2>
            <p className="text-lg text-muted-foreground">Choose the right mode for your use case</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <GitBranch className="mb-2 h-8 w-8 text-blue-600" />
                <CardTitle>Workflow Mode</CardTitle>
                <CardDescription>Trigger GitHub Actions</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Perfect for CI/CD integrations. Execute workflows in external repositories.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Zap className="mb-2 h-8 w-8 text-purple-600" />
                <CardTitle>Service Mode</CardTitle>
                <CardDescription>Managed WASM runtime</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Low latency, high throughput execution for real-time applications.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Package className="mb-2 h-8 w-8 text-green-600" />
                <CardTitle>Clone Mode</CardTitle>
                <CardDescription>Buy once, own forever</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Template generation to your GitHub. Complete ownership and control.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-8 text-center text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span>Supply Chain Verified</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              <span>Open Source</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>99.99% SLA</span>
            </div>
            <Separator orientation="vertical" className="h-4" />
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span>SOC 2 (In Progress)</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="bg-muted/30 py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Simple, Transparent Pricing</h2>
          <p className="mb-6 text-lg text-muted-foreground">
            Pay-per-execution starting at $0.01
          </p>
          <p className="mb-8 text-muted-foreground">No monthly fees, no hidden costs</p>
          <Button size="lg" variant="outline" asChild>
            <Link href="/pricing">See Full Pricing</Link>
          </Button>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-center text-white sm:p-12">
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Ready to Build or Cast?</h2>
            <p className="mb-8 text-lg opacity-90">
              Join thousands of developers building the future of workflows
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button size="lg" variant="secondary" asChild>
                <Link href="/makers">Start Building Spells</Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10" asChild>
                <Link href="/catalog">Explore Catalog</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="mb-4 font-semibold">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/catalog" className="hover:text-foreground">
                    Catalog
                  </Link>
                </li>
                <li>
                  <Link href="/docs" className="hover:text-foreground">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/api" className="hover:text-foreground">
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-foreground">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-semibold">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/about" className="hover:text-foreground">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="hover:text-foreground">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:text-foreground">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-foreground">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-semibold">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/privacy" className="hover:text-foreground">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/security" className="hover:text-foreground">
                    Security
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-semibold">Social</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a
                    href="https://github.com/NishizukaKoichi/Spell"
                    className="hover:text-foreground"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a href="https://twitter.com/spell" className="hover:text-foreground">
                    Twitter
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <Separator className="my-8" />

          <div className="text-center text-sm text-muted-foreground">
            © 2025 Spell Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
