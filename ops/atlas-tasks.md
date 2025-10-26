# Atlas Tasks - UI Operations

This document defines UI operations that cannot be automated via API and require Atlas (browser automation).

## Task Priority
- **P0**: Critical for initial setup
- **P1**: Required for production
- **P2**: Nice to have
- **P3**: Optional

---

## GitHub App Setup (P0)

**Goal**: Create and configure GitHub App for Spell Platform

**Prerequisites**:
- GitHub organization or personal account
- Admin access

**Steps**:
1. Navigate to `https://github.com/settings/apps/new` (personal) or `https://github.com/organizations/{org}/settings/apps/new` (org)
2. Fill in basic information:
   - **GitHub App name**: `Spell Platform`
   - **Homepage URL**: `https://spell.dev` (or your domain)
   - **Webhook URL**: `https://api.spell.dev/webhooks/github`
   - **Webhook secret**: Generate and store securely
3. Set permissions (minimum required):
   - Repository permissions:
     - Metadata: Read-only
     - Contents: Read-only
     - Actions: Read-only
   - Organization permissions:
     - Members: Read-only (optional)
4. Subscribe to events:
   - `workflow_run`
   - `repository_dispatch`
5. Click "Create GitHub App"
6. Generate private key and store securely
7. Note the App ID and Client ID

**Success Criteria**:
- App created with correct permissions
- Private key downloaded
- App ID and Client ID recorded

**Locators** (for Playwright automation if needed):
```typescript
{
  appNameInput: 'input[name="manifest[name]"]',
  homepageUrlInput: 'input[name="manifest[url]"]',
  webhookUrlInput: 'input[name="manifest[hook_attributes][url]"]',
  createButton: 'button:has-text("Create GitHub App")',
  generateKeyButton: 'button:has-text("Generate a private key")'
}
```

---

## Stripe Account Setup (P0)

**Goal**: Configure Stripe for payment processing

**Prerequisites**:
- Stripe account (test and live mode)
- Business verification completed (for live mode)

**Steps**:
1. Navigate to `https://dashboard.stripe.com/apikeys`
2. Copy **Publishable key** and **Secret key** for test mode
3. Navigate to `https://dashboard.stripe.com/webhooks`
4. Click "Add endpoint"
   - **Endpoint URL**: `https://api.spell.dev/webhooks/stripe`
   - **Events to send**:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `invoice.paid`
     - `charge.refunded`
5. Copy webhook signing secret
6. Enable Stripe Tax (if applicable):
   - Navigate to `https://dashboard.stripe.com/settings/tax`
   - Enable automatic tax calculation

**Success Criteria**:
- API keys copied
- Webhook configured with correct events
- Signing secret recorded

---

## Vercel Project Setup (P1)

**Goal**: Deploy frontend to Vercel

**Prerequisites**:
- Vercel account
- GitHub repository connected

**Steps**:
1. Navigate to `https://vercel.com/new`
2. Import repository: `github.com/{username}/Spell`
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (or specify if monorepo)
   - **Build Command**: `pnpm build`
   - **Output Directory**: `.next`
4. Add environment variables:
   - `NEXT_PUBLIC_API_BASE`
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SECRET_KEY`
5. Deploy

**Success Criteria**:
- Project deployed successfully
- Environment variables set
- Custom domain configured (if applicable)

---

## Cloudflare Workers Setup (P1)

**Goal**: Deploy edge functions and configure R2/KV

**Prerequisites**:
- Cloudflare account
- Domain configured

**Steps**:
1. Navigate to `https://dash.cloudflare.com/`
2. Create R2 bucket:
   - Go to R2 Object Storage
   - Click "Create bucket"
   - Name: `spell-artifacts`
3. Create KV namespace:
   - Go to Workers & Pages > KV
   - Click "Create namespace"
   - Name: `spell-kv`
4. Get API token:
   - Go to Profile > API Tokens
   - Create token with Workers permissions
5. Note Account ID from URL

**Success Criteria**:
- R2 bucket created
- KV namespace created
- API token generated
- Account ID recorded

---

## PlanetScale Database Setup (P1)

**Goal**: Set up production database

**Prerequisites**:
- PlanetScale account

**Steps**:
1. Navigate to `https://app.planetscale.com/`
2. Click "Create database"
   - **Name**: `spell-platform`
   - **Region**: Choose closest to users
   - **Plan**: Hobby (for dev) or Scaler (for prod)
3. Create branches:
   - `main` (production)
   - `development`
4. Get connection strings:
   - Click on branch > "Connect"
   - Select "Node.js" or "Prisma"
   - Copy connection string
5. Enable automatic migrations (optional)

**Success Criteria**:
- Database created
- Branches set up
- Connection strings saved securely

---

## Grafana Cloud Setup (P2)

**Goal**: Configure observability stack

**Prerequisites**:
- Grafana Cloud account

**Steps**:
1. Navigate to `https://grafana.com/`
2. Create stack:
   - Choose region
   - Note stack URL
3. Set up data sources:
   - Go to Configuration > Data Sources
   - Add Tempo for traces
   - Add Prometheus for metrics
4. Get API keys:
   - Go to Security > API keys
   - Create key with appropriate permissions
5. Note OTLP endpoint

**Success Criteria**:
- Stack created
- Data sources configured
- API keys generated
- OTLP endpoint recorded

---

## Notes

- All secrets should be stored in a secure secret manager (e.g., 1Password, GitHub Secrets)
- Atlas tasks should only be run when API alternatives are not available
- Document any deviations or issues in `.artifacts/local/atlas-execution.log`
- Use Playwright with role-based selectors whenever possible for maintainability

---

## Automation Guidelines

When automating these tasks with Atlas/Playwright:

1. **Prefer test IDs**: Look for `data-testid`, `data-test`, or similar attributes
2. **Use role selectors**: `role=button[name="Create"]` is better than `button.primary`
3. **Wait for network**: Use `page.waitForResponse()` for API calls
4. **Handle errors gracefully**: Take screenshots on failure
5. **Verify completion**: Don't just click - verify the result
6. **Respect rate limits**: Add appropriate delays
7. **Use incognito mode**: Avoid state pollution between runs

