# Spell Platform

**WASM-first execution platform for creator-to-consumer workflows**

[![CI](https://github.com/NishizukaKoichi/Spell/actions/workflows/ci.yml/badge.svg)](https://github.com/NishizukaKoichi/Spell/actions/workflows/ci.yml)

## Overview

Spell Platform enables creators to package workflows and automation scripts as "Spells" and distribute them via API. Built on WebAssembly for security and performance, with integrated payment processing and supply chain verification.

### Key Features

- 🔐 **Secure Execution**: WASM sandboxing with resource limits
- 💰 **Built-in Monetization**: Pay-per-use, subscriptions, and one-time purchases
- 📦 **Supply Chain Security**: SBOM + Sigstore signatures
- 🚀 **Multiple Execution Modes**: GitHub Actions, serverless, or buy-and-own
- 🌐 **API-First**: RESTful API with MCP integration
- ⚡ **Low Latency**: Edge deployment with <100ms p99

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run full build pipeline
./ops/runbook.sh all local
```

Visit `http://localhost:3000` to see the platform.

## Documentation

- [Setup Instructions](.artifacts/setup-instructions.md) - Complete setup guide
- [Operations Runbook](ops/runbook.sh) - Automated build, test, and deploy
- [Atlas Tasks](ops/atlas-tasks.md) - Manual UI operations
- [Architecture Spec](docs/SPEC.md) - Detailed technical specification

## Project Structure

```
Spell/
├── .artifacts/          # Build outputs and metadata
├── .github/workflows/   # CI/CD pipelines
├── ops/                 # Operational automation
├── src/
│   ├── app/             # Next.js pages and API routes
│   ├── components/      # React components
│   ├── lib/             # Core utilities
│   └── types/           # TypeScript definitions
└── README.md
```

## Development

### Requirements

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Git

### Commands

```bash
pnpm dev         # Start development server
pnpm build       # Build for production
pnpm lint        # Run ESLint
pnpm typecheck   # Run TypeScript compiler
pnpm format      # Format code with Prettier
```

### Operational Runbook

```bash
./ops/runbook.sh all local      # Full pipeline (local)
./ops/runbook.sh build          # Build only
./ops/runbook.sh test           # Tests only
./ops/runbook.sh sbom           # Generate SBOM
./ops/runbook.sh sign           # Sign artifacts
```

## Deployment

### Frontend (Vercel)

```bash
vercel --prod
```

### API Server (Fly.io or Cloudflare Workers)

See [deployment guide](docs/deployment.md) for details.

## Architecture

### Execution Modes

1. **Workflow**: Trigger GitHub Actions in external repositories
2. **Service**: Run in managed WASM runtime
3. **Clone**: One-time purchase, user owns the template

### Technology Stack

- **Frontend**: Next.js 16 + React 19 + Tailwind CSS
- **API**: Rust (Actix-web) + Cloudflare Workers
- **Runtime**: wasmer/wasmtime for WASM execution
- **Database**: PostgreSQL (Neon)
- **Storage**: Cloudflare R2
- **Messaging**: NATS JetStream
- **Auth**: GitHub OAuth + WebAuthn (Passkeys)
- **Payments**: Stripe

## Security

- ✅ WASM sandboxing with resource limits
- ✅ SBOM generation (SPDX/CycloneDX)
- ✅ Sigstore signatures (keyless signing)
- ✅ Vulnerability scanning (Grype)
- ✅ Supply chain verification
- ✅ Audit logging

## Compliance

- ✅ GDPR (EU)
- ✅ CCPA (California)
- ⏳ SOC 2 Type II (planned)
- ⏳ ISO 27001 (planned)

## Monitoring

- OpenTelemetry for distributed tracing
- Prometheus metrics
- Grafana dashboards
- PagerDuty for alerting

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## License

Proprietary - See LICENSE file for details

## Links

- [Website](https://spell.dev) (TBD)
- [Documentation](https://docs.spell.dev) (TBD)
- [API Reference](https://api.spell.dev/docs) (TBD)
- [GitHub](https://github.com/NishizukaKoichi/Spell)

## Support

- Issues: [GitHub Issues](https://github.com/NishizukaKoichi/Spell/issues)
- Email: support@spell.dev (TBD)

---

**Status**: 🚧 Under active development - Not production-ready

**Version**: 0.1.0

**Last Updated**: 2025-01-26
