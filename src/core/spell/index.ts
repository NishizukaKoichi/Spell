import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface SpellExecutionContext {
  userId: string;
}

export interface SpellHandlerArgs {
  inputs: Record<string, unknown>;
  context: SpellExecutionContext;
}

export interface SpellHandlerResult {
  output: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export type SpellHandler = (args: SpellHandlerArgs) => Promise<SpellHandlerResult>;

export interface SpellDefinition {
  key: string;
  version: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  tags?: string[];
  category?: string;
  handler: SpellHandler;
}

export class SpellNotFoundError extends Error {
  constructor(spellKey: string) {
    super(`Spell not found: ${spellKey}`);
    this.name = 'SpellNotFoundError';
  }
}

const builtinSpellCatalog: SpellDefinition[] = [
  {
    key: 'builtin.echo',
    version: '1.0.0',
    name: 'Echo Spell',
    description: 'Echo back any payload with metadata and timestamps.',
    priceCents: 25,
    currency: 'USD',
    tags: ['builtin', 'utility'],
    category: 'builtin',
    handler: async ({ inputs, context }) => {
      const message = typeof inputs.message === 'string' ? inputs.message : 'Hello from Spell';
      return {
        output: {
          echoed: message,
          received_input: inputs,
          executed_at: new Date().toISOString(),
          user_id: context.userId,
        },
        metadata: {
          spell: 'builtin.echo',
        },
      };
    },
  },
];

const catalogMap = new Map(builtinSpellCatalog.map((spell) => [spell.key, spell]));

let ensurePromise: Promise<void> | null = null;
let systemUserPromise: Promise<string> | null = null;

async function ensureSystemUser(): Promise<string> {
  if (!systemUserPromise) {
    systemUserPromise = prisma.user
      .upsert({
        where: { email: 'system@spell.dev' },
        update: {},
        create: {
          email: 'system@spell.dev',
          name: 'Spell System',
          role: 'operator',
          status: 'active',
        },
      })
      .then((user) => user.id)
      .catch((error) => {
        systemUserPromise = null;
        throw error;
      });
  }

  return systemUserPromise;
}

export async function ensureBuiltinSpellRecords(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const systemUserId = await ensureSystemUser();
      await Promise.all(
        builtinSpellCatalog.map((spell) => {
          const executionConfig: Prisma.JsonObject = {
            runtime: 'builtin',
            handler: spell.key,
          };

          return prisma.spell.upsert({
            where: { key: spell.key },
            update: {
              name: spell.name,
              description: spell.description,
              longDescription: spell.description,
              version: spell.version,
              priceModel: 'flat',
              priceAmountCents: spell.priceCents,
              priceCurrency: spell.currency,
              executionMode: 'builtin',
              executionConfig,
              tags: spell.tags ?? ['builtin'],
              category: spell.category ?? 'builtin',
              status: 'active',
              publishedAt: new Date(),
            },
            create: {
              key: spell.key,
              name: spell.name,
              description: spell.description,
              longDescription: spell.description,
              version: spell.version,
              priceModel: 'flat',
              priceAmountCents: spell.priceCents,
              priceCurrency: spell.currency,
              executionMode: 'builtin',
              executionConfig,
              tags: spell.tags ?? ['builtin'],
              category: spell.category ?? 'builtin',
              authorId: systemUserId,
              status: 'active',
              visibility: 'public',
              publishedAt: new Date(),
            },
          });
        })
      );
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  return ensurePromise;
}

function normalizeInputs(inputs: unknown): Record<string, unknown> {
  if (inputs && typeof inputs === 'object' && !Array.isArray(inputs)) {
    return inputs as Record<string, unknown>;
  }
  return {};
}

export async function executeSpell(
  spellKey: string,
  rawInputs: unknown,
  context: SpellExecutionContext
): Promise<{ definition: SpellDefinition; result: SpellHandlerResult }> {
  const definition = catalogMap.get(spellKey);
  if (!definition) {
    throw new SpellNotFoundError(spellKey);
  }

  const inputs = normalizeInputs(rawInputs);
  const result = await definition.handler({ inputs, context });
  return { definition, result };
}

export function listBuiltinSpells(): SpellDefinition[] {
  return builtinSpellCatalog;
}
