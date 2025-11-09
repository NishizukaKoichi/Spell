// Configuration Management - TKT-020
// SPEC Reference: Section 2 (Environment), Section 3 (Configuration)

/**
 * Environment types
 */
export type Environment = 'development' | 'test' | 'staging' | 'production';

/**
 * Application configuration interface
 */
export interface AppConfig {
  // Environment
  env: Environment;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;

  // API
  apiBase: string;
  port: number;

  // Authentication
  nextAuthUrl: string;
  authSecret: string;

  // GitHub App
  github: {
    appId: string;
    privateKey: string;
    installationId: string;
    repository: string;
    workflowFile: string;
    workflowRef: string;
    webhookSecret: string;
    clientId?: string;
    clientSecret?: string;
  };

  // Stripe
  stripe: {
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
  };

  // Redis (Upstash)
  redis: {
    url?: string;
    token?: string;
    enabled: boolean;
  };

  // Database
  database: {
    url: string;
  };

  // Optional: Analytics
  vercelAnalyticsId?: string;

  // Optional: Monitoring
  otlp?: {
    endpoint: string;
    apiKey: string;
  };
}

/**
 * Get required environment variable
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get optional environment variable
 */
function getOptionalEnv(key: string): string | undefined {
  return process.env[key] || undefined;
}

/**
 * Parse environment type
 */
function parseEnvironment(): Environment {
  const env = process.env.NODE_ENV;
  if (env === 'production') return 'production';
  if (env === 'test') return 'test';
  // Check for staging via custom env var since NODE_ENV is typically development/production/test
  if (process.env.APP_ENV === 'staging') return 'staging';
  return 'development';
}

/**
 * Load and validate configuration
 */
function loadConfig(): AppConfig {
  const env = parseEnvironment();

  // Database URL is always required
  const databaseUrl = getRequiredEnv('DATABASE_URL');

  // Auth configuration (required)
  const nextAuthUrl = getRequiredEnv('NEXTAUTH_URL');
  const authSecret = getRequiredEnv('AUTH_SECRET');

  // GitHub App configuration (required)
  const github = {
    appId: getRequiredEnv('GITHUB_APP_ID'),
    privateKey: getRequiredEnv('GITHUB_APP_PRIVATE_KEY'),
    installationId: getRequiredEnv('GITHUB_APP_INSTALLATION_ID'),
    repository: getRequiredEnv('GITHUB_REPOSITORY'),
    workflowFile: getRequiredEnv('GITHUB_WORKFLOW_FILE'),
    workflowRef: getRequiredEnv('GITHUB_WORKFLOW_REF'),
    webhookSecret: getRequiredEnv('GITHUB_WEBHOOK_SECRET'),
    clientId: getOptionalEnv('GITHUB_CLIENT_ID'),
    clientSecret: getOptionalEnv('GITHUB_CLIENT_SECRET'),
  };

  // Stripe configuration (required)
  const stripe = {
    publishableKey: getRequiredEnv('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'),
    secretKey: getRequiredEnv('STRIPE_SECRET_KEY'),
    webhookSecret: getRequiredEnv('STRIPE_WEBHOOK_SECRET'),
  };

  // Redis configuration (optional - falls back to in-memory)
  const redis = {
    url: getOptionalEnv('UPSTASH_REDIS_URL'),
    token: getOptionalEnv('UPSTASH_REDIS_TOKEN'),
    enabled: !!(getOptionalEnv('UPSTASH_REDIS_URL') && getOptionalEnv('UPSTASH_REDIS_TOKEN')),
  };

  // Optional configurations
  const vercelAnalyticsId = getOptionalEnv('NEXT_PUBLIC_VERCEL_ANALYTICS_ID');
  const otlpEndpoint = getOptionalEnv('OTLP_ENDPOINT');
  const otlpApiKey = getOptionalEnv('OTLP_API_KEY');

  return {
    env,
    isDevelopment: env === 'development',
    isProduction: env === 'production',
    isTest: env === 'test',

    apiBase: getOptionalEnv('NEXT_PUBLIC_API_BASE') || 'http://localhost:3001',
    port: parseInt(getOptionalEnv('PORT') || '3000', 10),

    nextAuthUrl,
    authSecret,

    github,
    stripe,
    redis,

    database: {
      url: databaseUrl,
    },

    vercelAnalyticsId,
    ...(otlpEndpoint &&
      otlpApiKey && {
        otlp: {
          endpoint: otlpEndpoint,
          apiKey: otlpApiKey,
        },
      }),
  };
}

/**
 * Global configuration instance
 * Loaded once at startup and cached
 */
let configInstance: AppConfig | null = null;

/**
 * Get application configuration
 * Validates and caches configuration on first access
 */
export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}

/**
 * Validate configuration without throwing
 * Returns validation errors if any
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    getConfig();
    return { valid: true, errors: [] };
  } catch (error) {
    if (error instanceof Error) {
      errors.push(error.message);
    } else {
      errors.push('Unknown configuration error');
    }
    return { valid: false, errors };
  }
}
