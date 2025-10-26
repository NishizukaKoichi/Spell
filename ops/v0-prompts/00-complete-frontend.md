# v0 Prompt: Complete Spell Platform Frontend

## Overview

Create a **complete, working frontend** for Spell Platform - a WASM-first execution platform. Generate all pages with mock data so the entire UI is navigable and demonstrable.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: React hooks (useState, useEffect)
- **Mock Data**: Include in `src/lib/mock-data.ts`

---

## Pages to Create

### 1. Landing Page (`/`)

**Purpose**: Convert visitors to users (Makers or Casters)

**Sections**:
- **Hero**
  - Headline: "Turn Your Code Into Revenue"
  - Subheadline: "Package workflows as WASM Spells. Execute via API. Get paid automatically."
  - CTAs: "Get Started" → `/catalog`, "View Docs" → `/docs`
  - Badges: 99.99% Uptime | <100ms Latency | GDPR Compliant

- **Value Prop (2 columns)**
  - **For Makers**: Monetize tools, zero infrastructure, pay-per-use/subscriptions
  - **For Casters**: One API endpoint, budget controls, instant results

- **How It Works (3 steps)**
  1. Create or Discover (📦)
  2. Execute (⚡)
  3. Get Paid / Get Results (💰)

- **Key Features (6-item grid)**
  - 🔐 Secure Execution (WASM sandboxing)
  - 💸 Built-in Monetization (Stripe)
  - ⚡ Low Latency (<100ms)
  - 🌐 API-First (RESTful + MCP)
  - 📊 Observability (logs, analytics)
  - 🛡️ Enterprise Ready (GDPR/CCPA)

- **Execution Modes (3 cards)**
  - Workflow Mode: GitHub Actions
  - Service Mode: WASM runtime
  - Clone Mode: Buy once, own forever

- **Trust Signals**: Supply Chain Verified | Open Source | 99.99% SLA | SOC 2 (In Progress)

- **Final CTA**: "Ready to Build or Cast?" → Two buttons

---

### 2. Catalog Page (`/catalog`)

**Purpose**: Browse and discover Spells

**Features**:
- **Search bar** (placeholder: "Search spells...")
- **Filters** (sidebar or top bar):
  - Tags: `image`, `text`, `data`, `automation`
  - Price: Free, <$0.10, <$1.00, >$1.00
  - Execution Mode: Workflow, Service, Clone
- **Spell Cards Grid** (responsive: 1 col mobile, 2 col tablet, 3 col desktop):
  - Spell name
  - Short description (1-2 lines)
  - Author (avatar + name)
  - Price (e.g., "$0.05/cast" or "Free" or "$9.99 one-time")
  - Tags (badges)
  - "View Details" button → `/spells/[id]`
- **Pagination** (mock: 20 spells, 5 per page)

**Mock Data** (6-8 spells):
```typescript
{
  id: "com.acme.resize",
  name: "Image Resizer Pro",
  description: "Fast image resizing with WebP support",
  author: { name: "Acme Corp", avatar: "🏢" },
  price: { model: "flat", amount: 0.05, currency: "USD" },
  tags: ["image", "media"],
  executionMode: "service",
  rating: 4.8,
  totalCasts: 12543
}
```

---

### 3. Spell Detail Page (`/spells/[id]`)

**Purpose**: Show full Spell info and enable casting

**Sections**:
- **Header**
  - Spell name (large)
  - Author (avatar + name)
  - Rating (stars) + total casts
  - Tags (badges)

- **Pricing**
  - Display pricing model (flat/metered/one-time)
  - Example: "$0.05 per cast" or "$9.99 one-time purchase"

- **Description**
  - Full markdown-style description
  - "What it does", "Use cases"

- **Execution Mode**
  - Badge: Workflow / Service / Clone
  - Explanation of mode

- **Input Schema** (collapsible)
  - Show JSON schema or form preview
  - Example:
    ```json
    {
      "width": 800,
      "height": 600,
      "format": "webp"
    }
    ```

- **Cast This Spell** (call-to-action)
  - Button: "Cast Now" → Opens modal or goes to `/cast/[id]`
  - For clone mode: "Buy Template ($9.99)"

- **Reviews/Ratings** (placeholder)
  - Mock 2-3 reviews with stars, user name, comment

- **Back to Catalog** link

**Mock Data**: Use dynamic route `[id]` and match from mock-data.ts

---

### 4. Dashboard Page (`/dashboard`)

**Purpose**: User's execution history and usage stats

**Sections**:
- **Overview Cards** (4 cards in row):
  - Total Casts: 127
  - Total Spent: $23.45
  - Active Spells: 8
  - Budget Remaining: $76.55 / $100

- **Usage Chart**
  - Line chart (mock with recharts or simple SVG)
  - Last 7 days: casts per day

- **Recent Casts Table**
  - Columns: Spell Name | Status | Time | Cost | Actions
  - Rows (mock 10 casts):
    - Status: ✅ Succeeded, ⏳ Running, ❌ Failed
    - Time: "2 hours ago", "1 day ago"
    - Cost: "$0.05", "$0.12"
    - Actions: "View Logs", "Download Artifact"

- **Quick Actions**
  - Button: "Browse Catalog"
  - Button: "Manage Budget"

**Mock Data**:
```typescript
{
  castId: "cast_abc123",
  spellId: "com.acme.resize",
  spellName: "Image Resizer Pro",
  status: "succeeded",
  timestamp: "2025-01-26T10:30:00Z",
  cost: 0.05,
  duration: 1250 // ms
}
```

---

### 5. Settings Page (`/settings`)

**Purpose**: Manage account, budget, API keys

**Tabs**:
- **Profile**
  - Name, Email (read-only for now)
  - Avatar (placeholder)

- **Budget**
  - Current monthly cap: $100
  - Usage this month: $23.45
  - Slider or input to adjust cap
  - "Save Changes" button

- **API Keys**
  - Table: Key Name | Created | Last Used | Actions
  - "Create New Key" button
  - Mock 1-2 keys with "Revoke" button

- **Billing**
  - Payment method (card ending in 4242)
  - "Update Payment Method" button
  - Billing history table (mock 3 invoices)

**Mock Data**: Static for now

---

## Shared Components

### Navigation Header

**Desktop**:
- Logo (left): "Spell Platform" or emoji ✨
- Links: Home | Catalog | Dashboard | Docs
- Right: User menu (avatar + dropdown)
  - "Settings"
  - "Sign Out"

**Mobile**:
- Hamburger menu
- Same links, vertical stack

### Footer

- **Columns**:
  - Product: Catalog, Docs, API Reference, Pricing
  - Company: About, Blog, Careers, Contact
  - Legal: Privacy, Terms, Security
  - Social: GitHub, Twitter

- **Copyright**: © 2025 Spell Platform

---

## Mock Data Structure (`src/lib/mock-data.ts`)

```typescript
export const mockSpells: Spell[] = [
  {
    id: "com.acme.resize",
    name: "Image Resizer Pro",
    description: "Fast image resizing with WebP, JPEG, PNG support. Optimized for web.",
    longDescription: "Resize images efficiently with support for multiple formats...",
    author: { id: "acme", name: "Acme Corp", avatar: "🏢" },
    price: { model: "flat", amount: 0.05, currency: "USD" },
    tags: ["image", "media", "webp"],
    executionMode: "service",
    rating: 4.8,
    totalCasts: 12543,
    inputSchema: { /* JSON schema */ },
    reviews: [
      { user: "alice", rating: 5, comment: "Super fast!" },
      { user: "bob", rating: 4, comment: "Works great" }
    ]
  },
  // 5-7 more spells with variety
];

export const mockCasts: Cast[] = [
  {
    castId: "cast_abc123",
    spellId: "com.acme.resize",
    spellName: "Image Resizer Pro",
    status: "succeeded",
    timestamp: "2025-01-26T10:30:00Z",
    cost: 0.05,
    duration: 1250
  },
  // 9 more casts
];

export const mockUser = {
  id: "user_123",
  name: "John Doe",
  email: "john@example.com",
  avatar: "👤",
  budget: { cap: 100, used: 23.45 }
};
```

---

## Styling Guidelines

- **Colors**: Use Tailwind's `slate`, `blue`, `purple` for tech feel
- **Dark Mode**: Add `dark:` variants for all sections
- **Responsive**: Mobile-first, breakpoints at `md:` and `lg:`
- **Typography**: Clear hierarchy (text-4xl → text-xl → text-base)
- **Spacing**: Consistent (p-4, p-6, p-8, gap-4, gap-6)
- **Buttons**:
  - Primary: `bg-blue-600 hover:bg-blue-700 text-white`
  - Secondary: `border border-gray-300 hover:bg-gray-50`

---

## Interactivity

- **Search**: Filter mockSpells by name/description (client-side)
- **Filters**: Filter by tags, price range, execution mode
- **Pagination**: Show 5 spells per page, prev/next buttons
- **Tabs**: Settings page tabs (Profile, Budget, API Keys, Billing)
- **Modal**: "Cast Spell" button opens modal with input form (mock submit)
- **Toast**: On "Copy API Key", show toast: "Copied to clipboard"

---

## Next.js API Routes (Optional, Mock)

If you want to simulate API calls:

`/app/api/spells/route.ts`:
```typescript
export async function GET() {
  return Response.json(mockSpells);
}
```

`/app/api/casts/route.ts`:
```typescript
export async function GET() {
  return Response.json(mockCasts);
}
```

For now, just import mock data directly in pages.

---

## Deliverables

1. **All page files**:
   - `src/app/page.tsx` (Landing)
   - `src/app/catalog/page.tsx`
   - `src/app/spells/[id]/page.tsx`
   - `src/app/dashboard/page.tsx`
   - `src/app/settings/page.tsx`

2. **Shared components**:
   - `src/components/navigation.tsx`
   - `src/components/footer.tsx`
   - `src/components/spell-card.tsx`
   - `src/components/cast-table.tsx`

3. **Mock data**:
   - `src/lib/mock-data.ts`

4. **Types**:
   - `src/types/spell.ts`
   - `src/types/cast.ts`
   - `src/types/user.ts`

5. **Updated layout**:
   - `src/app/layout.tsx` (include Navigation)

---

## Success Criteria

- ✅ All pages render without errors
- ✅ Navigation works between all pages
- ✅ Mock data displays correctly
- ✅ Search and filters work (client-side)
- ✅ Responsive on mobile, tablet, desktop
- ✅ Dark mode toggle works (if implemented)
- ✅ Can click through entire user journey:
  - Land → Browse Catalog → View Spell → Go to Dashboard → Check Settings

---

## Notes

- This is a **full working prototype** with mock data
- No real API calls yet (that comes in Phase 2 with Rust backend)
- Focus on UX/UI polish and consistency
- Make it feel premium and trustworthy (enterprise-grade design)

**Generate beautiful, production-ready code!** 🚀
