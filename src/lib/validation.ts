import { z } from 'zod';

// Spell creation validation
export const createSpellSchema = z.object({
  name: z.string().min(3).max(100),
  key: z
    .string()
    .min(3)
    .max(50)
    .regex(
      /^[a-z0-9-_]+$/i,
      'Key must contain only alphanumeric characters, hyphens, and underscores'
    ),
  description: z.string().min(10).max(500),
  longDescription: z.string().max(5000).optional(),
  category: z.string().optional(),
  priceModel: z.enum(['one_time', 'metered']),
  priceAmount: z.number().min(0).max(1000000),
  executionMode: z.enum(['workflow', 'api', 'lambda']),
  tags: z.array(z.string()).max(10).optional(),
  webhookUrl: z.string().url().optional().or(z.literal('')),
  inputSchema: z.any().optional(),
  outputSchema: z.any().optional(),
});

// Spell update validation
export const updateSpellSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().min(10).max(500).optional(),
  longDescription: z.string().max(5000).optional().nullable(),
  category: z.string().optional().nullable(),
  priceModel: z.enum(['one_time', 'metered']).optional(),
  priceAmount: z.number().min(0).max(1000000).optional(),
  tags: z.array(z.string()).max(10).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
  webhookUrl: z.string().url().optional().nullable().or(z.literal('')),
  inputSchema: z.any().optional().nullable(),
  outputSchema: z.any().optional().nullable(),
});

// Cast creation validation (API)
export const createCastSchema = z.object({
  spell_key: z.string().min(1),
  input: z.any().optional(),
});

// Review creation validation
export const createReviewSchema = z.object({
  castId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// Budget update validation
export const updateBudgetSchema = z.object({
  monthlyCap: z.number().min(0).max(1000000),
});

// API key creation validation
export const createApiKeySchema = z.object({
  name: z.string().min(3).max(100),
});

// Cast status update validation (internal)
export const updateCastStatusSchema = z.object({
  status: z.enum(['queued', 'running', 'succeeded', 'failed']),
  finishedAt: z.string().datetime().optional(),
  duration: z.number().int().min(0).optional(),
  artifactUrl: z.string().url().optional(),
  errorMessage: z.string().max(1000).optional(),
});

// Helper function to validate request body
export function validateRequest<T>(
  schema: z.Schema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Invalid request data'] };
  }
}
