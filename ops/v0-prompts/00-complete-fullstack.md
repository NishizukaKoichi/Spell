# v0 Prompt: Complete Fullstack Spell Platform

## Overview

Create a **production-ready fullstack application** for Spell Platform - a WASM-first execution platform. Include both frontend UI and working backend API with real database integration.

---

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React hooks + TanStack Query (for API calls)

### Backend
- **API**: Next.js API Routes (App Router)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: NextAuth.js (GitHub OAuth provider)
- **Validation**: Zod schemas
- **Payments**: Stripe SDK (basic integration)

### Infrastructure (to configure after generation)
- **Hosting**: Vercel (frontend + API)
- **Database**: PlanetScale or Neon (PostgreSQL)
- **Cache**: Vercel KV (Redis)

---

## Database Schema (Prisma)

Create `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  githubId      String?   @unique

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relationships
  apiKeys       ApiKey[]
  casts         Cast[]
  spells        Spell[]   @relation("SpellAuthor")
  budget        Budget?

  @@map("users")
}

model Spell {
  id              String   @id @default(cuid())
  key             String   @unique // e.g. "com.acme.resize"
  name            String
  description     String
  longDescription String?  @db.Text
  version         String   @default("1.0.0")

  // Pricing
  priceModel      String   // "flat" | "metered" | "one_time"
  priceAmount     Float    // in cents
  priceCurrency   String   @default("USD")

  // Execution
  executionMode   String   // "workflow" | "service" | "clone"

  // Metadata
  tags            String[] // ["image", "media"]
  category        String?
  rating          Float    @default(0)
  totalCasts      Int      @default(0)

  // Schema
  inputSchema     Json?
  outputSchema    Json?

  // Author
  authorId        String
  author          User     @relation("SpellAuthor", fields: [authorId], references: [id])

  // Status
  status          String   @default("active") // "active" | "suspended" | "archived"

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relationships
  casts           Cast[]

  @@map("spells")
  @@index([authorId])
  @@index([status])
  @@index([executionMode])
}

model Cast {
  id              String   @id @default(cuid())

  // Spell info
  spellId         String
  spell           Spell    @relation(fields: [spellId], references: [id])

  // User info
  casterId        String
  caster          User     @relation(fields: [casterId], references: [id])

  // Execution
  status          String   @default("queued") // "queued" | "running" | "succeeded" | "failed"
  inputHash       String?
  startedAt       DateTime?
  finishedAt      DateTime?
  duration        Int?     // milliseconds

  // Cost
  costCents       Int      @default(0)

  // Artifacts
  artifactUrl     String?
  errorMessage    String?  @db.Text

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("casts")
  @@index([spellId])
  @@index([casterId])
  @@index([status])
  @@index([createdAt])
}

model Budget {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id])

  monthlyCap      Float    @default(100.00) // in dollars
  currentSpend    Float    @default(0)

  lastResetAt     DateTime @default(now())

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("budgets")
}

model ApiKey {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])

  name            String   // User-friendly name
  key             String   @unique // sk_live_...

  lastUsedAt      DateTime?
  status          String   @default("active") // "active" | "revoked"

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("api_keys")
  @@index([userId])
  @@index([key])
}
```

---

## API Routes (App Router)

### Auth Routes (NextAuth.js)

`app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    session: async ({ session, user }) => {
      if (session?.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

---

### Spell Routes

`app/api/spells/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// GET /api/spells - List spells with filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const tag = searchParams.get("tag");
  const mode = searchParams.get("mode");
  const search = searchParams.get("q");

  const spells = await prisma.spell.findMany({
    where: {
      status: "active",
      ...(tag && { tags: { has: tag } }),
      ...(mode && { executionMode: mode }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
    },
    orderBy: { totalCasts: "desc" },
    take: 20,
  });

  return NextResponse.json({ spells });
}

// POST /api/spells - Create new spell (authenticated)
const createSpellSchema = z.object({
  key: z.string().regex(/^[a-z0-9\-\.]+$/),
  name: z.string().min(3).max(100),
  description: z.string().max(500),
  longDescription: z.string().optional(),
  priceModel: z.enum(["flat", "metered", "one_time"]),
  priceAmount: z.number().min(0),
  executionMode: z.enum(["workflow", "service", "clone"]),
  tags: z.array(z.string()).max(10),
  inputSchema: z.any().optional(),
});

export async function POST(request: NextRequest) {
  // TODO: Add auth check
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const validated = createSpellSchema.parse(body);

  const spell = await prisma.spell.create({
    data: {
      ...validated,
      authorId: session.user.id,
    },
  });

  return NextResponse.json({ spell }, { status: 201 });
}
```

`app/api/spells/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const spell = await prisma.spell.findUnique({
    where: { id: params.id },
    include: {
      author: {
        select: { id: true, name: true, image: true },
      },
    },
  });

  if (!spell) {
    return NextResponse.json({ error: "Spell not found" }, { status: 404 });
  }

  return NextResponse.json({ spell });
}
```

---

### Cast Routes

`app/api/casts/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

// GET /api/casts - List user's casts
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const casts = await prisma.cast.findMany({
    where: { casterId: session.user.id },
    include: {
      spell: {
        select: { id: true, name: true, key: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ casts });
}

// POST /api/casts - Create new cast execution
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { spellId, input } = await request.json();

  // Check budget
  const budget = await prisma.budget.findUnique({
    where: { userId: session.user.id },
  });

  if (budget && budget.currentSpend >= budget.monthlyCap) {
    return NextResponse.json(
      { error: "Budget cap exceeded" },
      { status: 402 }
    );
  }

  // Get spell
  const spell = await prisma.spell.findUnique({
    where: { id: spellId },
  });

  if (!spell) {
    return NextResponse.json({ error: "Spell not found" }, { status: 404 });
  }

  // Create cast
  const cast = await prisma.cast.create({
    data: {
      spellId,
      casterId: session.user.id,
      costCents: Math.round(spell.priceAmount),
      status: "queued",
      inputHash: "placeholder", // TODO: hash input
    },
  });

  // TODO: Trigger actual execution (queue job)
  // For now, mark as succeeded after 1 second (mock)
  setTimeout(async () => {
    await prisma.cast.update({
      where: { id: cast.id },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        duration: 1250,
      },
    });
  }, 1000);

  // Update budget
  if (budget) {
    await prisma.budget.update({
      where: { userId: session.user.id },
      data: {
        currentSpend: { increment: spell.priceAmount / 100 },
      },
    });
  }

  return NextResponse.json({ cast }, { status: 201 });
}
```

---

### Budget Route

`app/api/budget/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let budget = await prisma.budget.findUnique({
    where: { userId: session.user.id },
  });

  // Create default budget if doesn't exist
  if (!budget) {
    budget = await prisma.budget.create({
      data: {
        userId: session.user.id,
        monthlyCap: 100.0,
        currentSpend: 0,
      },
    });
  }

  return NextResponse.json({ budget });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { monthlyCap } = await request.json();

  const budget = await prisma.budget.upsert({
    where: { userId: session.user.id },
    update: { monthlyCap },
    create: {
      userId: session.user.id,
      monthlyCap,
      currentSpend: 0,
    },
  });

  return NextResponse.json({ budget });
}
```

---

## Utility Files

`lib/prisma.ts`:
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

`lib/auth.ts`:
```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}
```

---

## Frontend Pages (with API integration)

### Landing Page (`app/page.tsx`)
- Same as before, but add "Sign In with GitHub" button
- Use NextAuth signIn()

### Catalog Page (`app/catalog/page.tsx`)
```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { SpellCard } from "@/components/spell-card";

export default function CatalogPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["spells"],
    queryFn: async () => {
      const res = await fetch("/api/spells");
      return res.json();
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Spell Catalog</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.spells.map((spell) => (
          <SpellCard key={spell.id} spell={spell} />
        ))}
      </div>
    </div>
  );
}
```

### Dashboard Page (`app/dashboard/page.tsx`)
```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

export default function DashboardPage() {
  const { data: session } = useSession();

  const { data: casts } = useQuery({
    queryKey: ["casts"],
    queryFn: async () => {
      const res = await fetch("/api/casts");
      return res.json();
    },
    enabled: !!session,
  });

  const { data: budget } = useQuery({
    queryKey: ["budget"],
    queryFn: async () => {
      const res = await fetch("/api/budget");
      return res.json();
    },
    enabled: !!session,
  });

  // Render dashboard with real data
}
```

---

## Environment Variables (`.env.example`)

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/spell"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Stripe (optional for MVP)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

## Setup Instructions

After v0 generates the code:

```bash
# 1. Install dependencies
pnpm install
pnpm add @prisma/client @next-auth/prisma-adapter next-auth @tanstack/react-query zod
pnpm add -D prisma

# 2. Initialize Prisma
npx prisma init

# 3. Push schema to database
npx prisma db push

# 4. Generate Prisma client
npx prisma generate

# 5. Seed database (optional)
npx prisma db seed

# 6. Run dev server
pnpm dev
```

---

## Deliverables

1. **All frontend pages** (same as before)
2. **API Routes**:
   - `/api/auth/[...nextauth]`
   - `/api/spells` (GET, POST)
   - `/api/spells/[id]` (GET)
   - `/api/casts` (GET, POST)
   - `/api/budget` (GET, PATCH)
3. **Prisma schema** and migrations
4. **Auth setup** (NextAuth.js)
5. **TanStack Query** integration
6. **Zod validation** schemas
7. **Environment variables** template

---

## Success Criteria

- ✅ Users can sign in with GitHub
- ✅ Authenticated users can browse spells (from DB)
- ✅ Authenticated users can "cast" a spell (creates DB record)
- ✅ Dashboard shows real execution history
- ✅ Budget tracking works
- ✅ All data persists in PostgreSQL
- ✅ API endpoints are type-safe (Zod validation)

---

## Notes

- This is a **production-grade fullstack app**
- Uses Next.js 15 Server Components + Client Components appropriately
- Database queries are optimized (includes, indexes)
- Auth is secure (NextAuth.js)
- Can deploy to Vercel + PlanetScale immediately

**Generate complete, deployable code!** 🚀
