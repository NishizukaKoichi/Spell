// Structured Logging Infrastructure - TKT-015
// SPEC Reference: Section 18 (Logging), Section 19 (Observability)

import { getConfig } from '@/lib/config';

/**
 * Log levels in order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured log entry
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  minLevel: LogLevel;
  pretty: boolean;
  sampleRate: number; // 0.0 to 1.0 (1.0 = log everything)
}

/**
 * Log level priorities for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get logger configuration based on environment
 */
function getLoggerConfig(): LoggerConfig {
  try {
    const config = getConfig();

    // Development: pretty logs, debug level, no sampling
    if (config.isDevelopment) {
      return {
        minLevel: 'debug',
        pretty: true,
        sampleRate: 1.0,
      };
    }

    // Test: minimal logs, warn level, no sampling
    if (config.isTest) {
      return {
        minLevel: 'warn',
        pretty: false,
        sampleRate: 1.0,
      };
    }

    // Production: JSON logs, info level, sampling for high traffic
    return {
      minLevel: 'info',
      pretty: false,
      sampleRate: 1.0, // Can be adjusted based on traffic
    };
  } catch {
    // Fallback config if getConfig() fails (e.g., missing env vars in tests)
    const nodeEnv = process.env.NODE_ENV || 'development';

    if (nodeEnv === 'test') {
      return {
        minLevel: 'warn',
        pretty: false,
        sampleRate: 1.0,
      };
    }

    if (nodeEnv === 'production') {
      return {
        minLevel: 'info',
        pretty: false,
        sampleRate: 1.0,
      };
    }

    return {
      minLevel: 'debug',
      pretty: true,
      sampleRate: 1.0,
    };
  }
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry, pretty: boolean): string {
  if (pretty) {
    // Human-readable format for development
    const level = entry.level.toUpperCase().padEnd(5);
    const timestamp = new Date(entry.timestamp).toISOString();
    let output = `[${timestamp}] ${level} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
    }

    if (entry.error) {
      output += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        output += `\n${entry.error.stack}`;
      }
    }

    return output;
  }

  // JSON format for production
  return JSON.stringify(entry);
}

/**
 * Check if log should be sampled out
 */
function shouldSample(sampleRate: number): boolean {
  if (sampleRate >= 1.0) return true;
  return Math.random() < sampleRate;
}

/**
 * Core logging function
 */
function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: Error
): void {
  const config = getLoggerConfig();

  // Filter by log level
  if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[config.minLevel]) {
    return;
  }

  // Sample logs if configured
  if (!shouldSample(config.sampleRate)) {
    return;
  }

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context && { context }),
    ...(error && {
      error: {
        name: error.name,
        message: error.message,
        ...(error.stack && { stack: error.stack }),
      },
    }),
  };

  const formatted = formatLogEntry(entry, config.pretty);

  // Output to appropriate stream
  if (level === 'error') {
    console.error(formatted);
  } else if (level === 'warn') {
    console.warn(formatted);
  } else {
    // eslint-disable-next-line no-console
    console.log(formatted);
  }
}

/**
 * Logger instance with convenience methods
 */
export const logger = {
  /**
   * Log debug message (development only)
   */
  debug(message: string, context?: Record<string, unknown>): void {
    log('debug', message, context);
  },

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    log('info', message, context);
  },

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    log('warn', message, context);
  },

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    log('error', message, context, error);
  },

  /**
   * Create a child logger with persistent context
   */
  child(parentContext: Record<string, unknown>) {
    return {
      debug(message: string, context?: Record<string, unknown>): void {
        log('debug', message, { ...parentContext, ...context });
      },

      info(message: string, context?: Record<string, unknown>): void {
        log('info', message, { ...parentContext, ...context });
      },

      warn(message: string, context?: Record<string, unknown>): void {
        log('warn', message, { ...parentContext, ...context });
      },

      error(message: string, error?: Error, context?: Record<string, unknown>): void {
        log('error', message, { ...parentContext, ...context }, error);
      },
    };
  },
};

/**
 * Request logger - creates child logger with request context
 */
export function createRequestLogger(requestId: string, path: string, method: string) {
  return logger.child({
    requestId,
    path,
    method,
  });
}
