# v0 Prompt: Spell Platform Landing Page

## Context

You are creating the landing page for **Spell Platform** - a WASM-first execution platform that enables creators to package workflows and automation scripts as "Spells" and distribute them via API with built-in monetization.

## Design Requirements

### Brand Identity
- **Name**: Spell Platform
- **Tagline**: "WASM-first execution platform for creator-to-consumer workflows"
- **Tone**: Professional, modern, technical but accessible
- **Color Scheme**: Use Tailwind's default palette with a tech-forward feel (consider slate, blue, purple gradients)

### Target Audience
- **Makers**: Developers who want to monetize their tools/scripts
- **Casters**: Developers/businesses who want to execute diverse functions via API
- **Enterprise**: Companies looking for secure, compliant execution platforms

## Page Sections (In Order)

### 1. Hero Section
- **Headline**: "Turn Your Code Into Revenue"
- **Subheadline**: "Package workflows as WASM Spells. Execute via API. Get paid automatically."
- **Primary CTA**: "Get Started" (button, links to /signup or /catalog)
- **Secondary CTA**: "View Catalog" (button, links to /catalog)
- **Visual**: Consider a code snippet showing a simple API call or a visual representation of WASM execution
- **Key metrics badge**: "99.99% Uptime" | "Sub-100ms Latency" | "GDPR Compliant"

### 2. Value Proposition (Two Columns)

**For Makers (Left Column)**
- Icon: 🛠️ or similar
- **Headline**: "Monetize Your Tools Instantly"
- **Benefits** (bullet points):
  - "Compile to WASM, deploy in minutes"
  - "Pay-per-use, subscriptions, or one-time sales"
  - "Zero infrastructure management"
  - "Built-in billing & analytics"
- **CTA**: "Start Selling" (link to /makers/start)

**For Casters (Right Column)**
- Icon: ⚡ or similar
- **Headline**: "Execute Anything via API"
- **Benefits** (bullet points):
  - "One API endpoint for all functions"
  - "Pay only for what you use"
  - "Sub-second execution (WASM)"
  - "Budget controls & usage limits"
- **CTA**: "Browse Spells" (link to /catalog)

### 3. How It Works (3 Steps)

Use a horizontal or vertical timeline layout:

**Step 1: Create or Discover**
- **For Makers**: "Package your code as a Spell (WASM)"
- **For Casters**: "Find the perfect Spell in our catalog"
- Icon: 📦

**Step 2: Execute**
- **For Makers**: "Users cast your Spell via API"
- **For Casters**: "Make an API call with your input"
- Icon: ⚡ or 🎯

**Step 3: Get Paid / Get Results**
- **For Makers**: "Automatic payments & revenue split"
- **For Casters**: "Receive artifacts & results instantly"
- Icon: 💰 or ✅

### 4. Key Features (Grid Layout, 3 columns x 2 rows)

1. **🔐 Secure Execution**
   - "WASM sandboxing with resource limits"
   - "Supply chain verification (SBOM + Sigstore)"

2. **💸 Built-in Monetization**
   - "Stripe integration, automatic tax handling"
   - "Pay-per-use, subscriptions, or buy-once"

3. **⚡ Low Latency**
   - "Edge deployment, <100ms p99"
   - "Sub-second cold starts"

4. **🌐 API-First**
   - "RESTful API + MCP integration"
   - "Works with any language/platform"

5. **📊 Observability**
   - "Real-time execution logs"
   - "Usage analytics & billing dashboard"

6. **🛡️ Enterprise Ready**
   - "GDPR/CCPA compliant"
   - "SOC 2 roadmap, audit trails"

### 5. Execution Modes (3 Cards)

Explain the three execution modes:

**Workflow Mode**
- "Trigger GitHub Actions in external repos"
- "Perfect for CI/CD integrations"
- Icon: 🔄

**Service Mode**
- "Run in managed WASM runtime"
- "Low latency, high throughput"
- Icon: ⚡

**Clone Mode**
- "Buy once, own forever"
- "Template generation to your GitHub"
- Icon: 📋

### 6. Trust Signals

Display in a horizontal bar or grid:
- "Supply Chain Verified" (with Sigstore logo or icon)
- "Open Source" (with GitHub icon)
- "99.99% Uptime SLA"
- "SOC 2 Type II (In Progress)"
- "SBOM Included"

### 7. Pricing Preview (Simple)

Just a teaser, not full pricing:
- "Pay-per-execution starting at $0.01"
- "No monthly fees, no hidden costs"
- **CTA**: "See Full Pricing" (link to /pricing)

### 8. CTA Section (Final)

- **Headline**: "Ready to Build or Cast?"
- **Two CTAs**:
  - "Start Building Spells" (primary button)
  - "Explore Catalog" (secondary button)

### 9. Footer

- **Links**:
  - Documentation
  - API Reference
  - GitHub
  - Support
- **Legal**: Privacy Policy, Terms of Service
- **Social**: GitHub, Twitter (X)
- **Copyright**: © 2025 Spell Platform

## Technical Requirements

### Framework
- Next.js 15 with App Router
- TypeScript
- Tailwind CSS (already configured)
- Use `src/app/page.tsx` and `src/app/layout.tsx`

### Components
- Keep components inline in `page.tsx` for now (we'll extract later)
- Use semantic HTML (`<section>`, `<article>`, `<nav>`)
- Ensure mobile-responsive (mobile-first design)

### Styling
- Use Tailwind utility classes
- Dark mode support (use `dark:` classes)
- Smooth scroll behavior
- Proper contrast ratios (WCAG AA)

### Accessibility
- All interactive elements keyboard-accessible
- Alt text for images
- Proper heading hierarchy (h1 → h2 → h3)
- ARIA labels where appropriate

### Performance
- No external images (use emoji or Tailwind's built-in features for now)
- Lazy load below-the-fold content if needed
- Optimized fonts (use Next.js font optimization)

## Links to Use (Placeholder Routes)

- `/catalog` - Spell catalog (not yet created)
- `/makers/start` - Maker onboarding (not yet created)
- `/pricing` - Pricing page (not yet created)
- `/docs` - Documentation (external or future)
- `/api/auth/signin` - Sign in (future)

For now, these can be `<a>` tags with `href="#"` or use Next.js `<Link>` to placeholder routes.

## Code Structure Example

```typescript
// src/app/page.tsx
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ValueProposition />
      <HowItWorks />
      <KeyFeatures />
      <ExecutionModes />
      <TrustSignals />
      <PricingPreview />
      <FinalCTA />
    </>
  );
}

// Each section as a component (inline for now)
function HeroSection() {
  return (
    <section className="...">
      {/* Hero content */}
    </section>
  );
}
```

## Output

Please generate:
1. Complete `src/app/page.tsx` with all sections
2. Update `src/app/layout.tsx` if needed (add fonts, metadata)
3. Any additional CSS in `src/app/globals.css` if needed

Make it beautiful, modern, and conversion-focused! 🚀
