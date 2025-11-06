#!/bin/bash
# Spell Platform - Environment Setup Script

echo "🔧 Spell Platform Environment Setup"
echo "===================================="
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists"
    read -p "Do you want to overwrite it? (y/N): " confirm
    if [ "$confirm" != "y" ]; then
        echo "Setup cancelled"
        exit 0
    fi
fi

# Copy example
cp .env.example .env

echo ""
echo "📝 Please configure the following:"
echo ""
echo "1. NEXTAUTH_SECRET - Generate with: openssl rand -base64 32"
echo "2. GitHub App credentials (for workflow execution)"
echo "3. Stripe API keys (for payments)"
echo ""
echo "✓ .env file created from template"
echo ""
echo "Next steps:"
echo "  1. Edit .env and fill in required values"
echo "  2. Run: pnpm prisma migrate deploy"
echo "  3. Run: pnpm db:seed"
echo "  4. Run: pnpm dev"
