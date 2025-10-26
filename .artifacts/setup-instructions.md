# Spell Platform - Setup Instructions

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Git

### Local Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/NishizukaKoichi/Spell.git
cd Spell

# 2. Install dependencies
pnpm install

# 3. Create .env.local file
cp .env.example .env.local

# 4. Start development server
pnpm dev
```

Visit `http://localhost:3000` to see the application.

## Environment Variables

Create a `.env.local` file in the root directory:

```bash
# API Configuration
NEXT_PUBLIC_API_BASE=http://localhost:3001

# GitHub OAuth (for authentication)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Stripe (for payments)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=
```

## Production Deployment

### Vercel (Recommended for Frontend)

1. Install Vercel CLI:
   ```bash
   pnpm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel --prod
   ```

3. Set environment variables in Vercel dashboard

### Manual Deployment

```bash
# Build for production
pnpm build

# Start production server
pnpm start
```

## Development Workflow

### Running Tests

```bash
# Lint
pnpm lint

# Type check
pnpm typecheck

# Format check
pnpm format:check

# Format fix
pnpm format
```

### Building

```bash
# Development build
pnpm build

# Production build (with optimizations)
NODE_ENV=production pnpm build
```

## Operational Commands

The project includes a comprehensive runbook for automated operations:

```bash
# Run all operations (build, test, SBOM, sign)
./ops/runbook.sh all local

# Individual operations
./ops/runbook.sh build
./ops/runbook.sh test
./ops/runbook.sh sbom
./ops/runbook.sh sign
```

## Project Structure

```
Spell/
├── .artifacts/          # Build artifacts and metadata
├── .github/
│   └── workflows/       # CI/CD pipelines
├── ops/                 # Operational scripts
│   ├── runbook.sh       # Main automation script
│   ├── run.json         # Environment configurations
│   └── atlas-tasks.md   # Manual UI tasks
├── src/
│   ├── app/             # Next.js app directory
│   ├── components/      # React components
│   ├── lib/             # Utility functions
│   └── types/           # TypeScript types
├── package.json
└── tsconfig.json
```

## Security Setup

### GitHub App (Required for workflow execution)

See detailed instructions in `/ops/atlas-tasks.md`

Key steps:
1. Create GitHub App at https://github.com/settings/apps/new
2. Set minimal permissions (Metadata, Contents, Actions - read-only)
3. Generate and securely store private key

### Stripe (Required for payments)

1. Create Stripe account
2. Get API keys from dashboard
3. Set up webhook endpoint
4. Configure products and prices

## Advanced Setup

### SBOM Generation

Install optional tools for enhanced security:

```bash
# Install syft (SBOM generation)
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin

# Install grype (vulnerability scanning)
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin

# Install cosign (artifact signing)
brew install cosign  # macOS
# or see https://docs.sigstore.dev/cosign/installation/
```

### Monitoring and Observability

1. Set up Grafana Cloud account
2. Configure OTLP endpoint
3. Add environment variables:
   ```bash
   OTLP_ENDPOINT=https://otlp.grafana.net
   OTLP_API_KEY=your_api_key
   ```

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
rm -rf .next node_modules
pnpm install
pnpm build
```

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 pnpm dev
```

### Type Errors

```bash
# Regenerate Next.js types
rm -rf .next
pnpm dev
# Stop after types are generated
```

## Getting Help

- Documentation: `/docs`
- Issues: https://github.com/NishizukaKoichi/Spell/issues
- Operational runbook: `./ops/runbook.sh help`

## Next Steps

1. ✅ Complete local setup
2. ⬜ Set up GitHub App (see `/ops/atlas-tasks.md`)
3. ⬜ Configure Stripe (see `/ops/atlas-tasks.md`)
4. ⬜ Deploy to staging
5. ⬜ Set up monitoring
6. ⬜ Deploy to production
