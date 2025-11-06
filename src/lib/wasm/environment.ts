import { WASI } from '@wasmer/wasi';
import { WasmResourceLimits, DEFAULT_RESOURCE_LIMITS } from './runtime';

/**
 * WASM execution environment configuration
 */
export interface WasmEnvironmentConfig {
  args?: string[];
  env?: Record<string, string>;
  preopens?: Record<string, string>;
  limits?: Partial<WasmResourceLimits>;
  allowNetwork?: boolean;
  allowFileSystem?: boolean;
}

/**
 * Sandboxed execution environment for WASM
 */
export class WasmEnvironment {
  private wasi: WASI;
  private config: WasmEnvironmentConfig;
  private limits: WasmResourceLimits;

  constructor(config: WasmEnvironmentConfig = {}) {
    this.config = config;
    this.limits = { ...DEFAULT_RESOURCE_LIMITS, ...config.limits };

    // Create WASI instance with sandboxed configuration
    this.wasi = new WASI({
      args: config.args || [],
      env: this.sanitizeEnvironment(config.env || {}),
      preopens: this.configurePreopens(config),
    });
  }

  /**
   * Get WASI import object
   */
  getWasiImport(): Record<string, unknown> {
    return this.wasi.wasiImport;
  }

  /**
   * Start WASI instance
   */
  start(instance: WebAssembly.Instance): void {
    this.wasi.start(instance);
  }

  /**
   * Get resource limits
   */
  getLimits(): WasmResourceLimits {
    return { ...this.limits };
  }

  /**
   * Sanitize environment variables (remove sensitive data)
   */
  private sanitizeEnvironment(env: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const blockedKeys = [
      'DATABASE_URL',
      'SECRET',
      'KEY',
      'TOKEN',
      'PASSWORD',
      'API_KEY',
      'PRIVATE',
      'AWS_',
      'STRIPE_',
      'GITHUB_',
    ];

    for (const [key, value] of Object.entries(env)) {
      // Block sensitive environment variables
      const isBlocked = blockedKeys.some((blocked) =>
        key.toUpperCase().includes(blocked.toUpperCase())
      );

      if (!isBlocked) {
        sanitized[key] = value;
      } else {
        console.warn(`Blocked sensitive environment variable: ${key}`);
      }
    }

    return sanitized;
  }

  /**
   * Configure filesystem preopens (sandboxed directories)
   */
  private configurePreopens(config: WasmEnvironmentConfig): Record<string, string> {
    if (!config.allowFileSystem) {
      // No filesystem access by default
      return {};
    }

    // Only allow access to safe directories
    const preopens: Record<string, string> = {
      '/tmp': '/tmp',
      ...config.preopens,
    };

    return preopens;
  }
}

/**
 * Create a sandboxed WASM environment
 */
export function createWasmEnvironment(config: WasmEnvironmentConfig = {}): WasmEnvironment {
  return new WasmEnvironment(config);
}

/**
 * Standard I/O capture for WASM execution
 */
export class WasmStdIO {
  private stdout: string[] = [];
  private stderr: string[] = [];
  private stdin: string;

  constructor(stdin = '') {
    this.stdin = stdin;
  }

  /**
   * Write to stdout
   */
  writeStdout(data: string): void {
    this.stdout.push(data);
  }

  /**
   * Write to stderr
   */
  writeStderr(data: string): void {
    this.stderr.push(data);
  }

  /**
   * Read from stdin
   */
  readStdin(): string {
    return this.stdin;
  }

  /**
   * Get all stdout output
   */
  getStdout(): string {
    return this.stdout.join('');
  }

  /**
   * Get all stderr output
   */
  getStderr(): string {
    return this.stderr.join('');
  }

  /**
   * Clear all buffers
   */
  clear(): void {
    this.stdout = [];
    this.stderr = [];
  }

  /**
   * Get all output as object
   */
  getAll(): { stdout: string; stderr: string } {
    return {
      stdout: this.getStdout(),
      stderr: this.getStderr(),
    };
  }
}

/**
 * Memory tracker for WASM execution
 */
export class WasmMemoryTracker {
  private memory: WebAssembly.Memory;
  private peakUsageMb = 0;

  constructor(memory: WebAssembly.Memory) {
    this.memory = memory;
  }

  /**
   * Get current memory usage in MB
   */
  getCurrentUsageMb(): number {
    return this.memory.buffer.byteLength / (1024 * 1024);
  }

  /**
   * Update peak usage
   */
  updatePeakUsage(): void {
    const current = this.getCurrentUsageMb();
    if (current > this.peakUsageMb) {
      this.peakUsageMb = current;
    }
  }

  /**
   * Get peak memory usage in MB
   */
  getPeakUsageMb(): number {
    return this.peakUsageMb;
  }

  /**
   * Check if memory limit is exceeded
   */
  isLimitExceeded(limitMb: number): boolean {
    return this.getCurrentUsageMb() > limitMb;
  }

  /**
   * Get memory statistics
   */
  getStats(): {
    currentMb: number;
    peakMb: number;
    bufferBytes: number;
  } {
    return {
      currentMb: this.getCurrentUsageMb(),
      peakMb: this.peakUsageMb,
      bufferBytes: this.memory.buffer.byteLength,
    };
  }
}

/**
 * Network access control for WASM
 */
export class WasmNetworkControl {
  private allowedHosts: Set<string>;
  private allowNetwork: boolean;

  constructor(config: { allowNetwork?: boolean; allowedHosts?: string[] } = {}) {
    this.allowNetwork = config.allowNetwork || false;
    this.allowedHosts = new Set(config.allowedHosts || []);
  }

  /**
   * Check if host is allowed
   */
  isHostAllowed(host: string): boolean {
    if (!this.allowNetwork) {
      return false;
    }

    if (this.allowedHosts.size === 0) {
      // If no specific hosts defined, allow all when network is enabled
      return true;
    }

    return this.allowedHosts.has(host);
  }

  /**
   * Add allowed host
   */
  addAllowedHost(host: string): void {
    this.allowedHosts.add(host);
  }

  /**
   * Remove allowed host
   */
  removeAllowedHost(host: string): void {
    this.allowedHosts.delete(host);
  }

  /**
   * Get all allowed hosts
   */
  getAllowedHosts(): string[] {
    return Array.from(this.allowedHosts);
  }
}

/**
 * Create a secure, sandboxed WASM environment with full isolation
 */
export function createSecureEnvironment(config: WasmEnvironmentConfig = {}): {
  environment: WasmEnvironment;
  stdio: WasmStdIO;
  networkControl: WasmNetworkControl;
} {
  // Force secure defaults
  const secureConfig: WasmEnvironmentConfig = {
    ...config,
    allowFileSystem: false, // Disable filesystem by default
    allowNetwork: false, // Disable network by default
    env: config.env || {},
    preopens: {}, // No filesystem access
  };

  const environment = new WasmEnvironment(secureConfig);
  const stdio = new WasmStdIO();
  const networkControl = new WasmNetworkControl({
    allowNetwork: config.allowNetwork,
  });

  return {
    environment,
    stdio,
    networkControl,
  };
}

/**
 * Validate resource limits
 */
export function validateResourceLimits(limits: Partial<WasmResourceLimits>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (limits.maxMemoryMB !== undefined) {
    if (limits.maxMemoryMB < 1 || limits.maxMemoryMB > 4096) {
      errors.push('maxMemoryMB must be between 1 and 4096');
    }
  }

  if (limits.maxExecutionTimeMs !== undefined) {
    if (limits.maxExecutionTimeMs < 100 || limits.maxExecutionTimeMs > 600000) {
      errors.push('maxExecutionTimeMs must be between 100 and 600000 (10 minutes)');
    }
  }

  if (limits.maxOutputSizeBytes !== undefined) {
    if (limits.maxOutputSizeBytes < 1024 || limits.maxOutputSizeBytes > 1024 * 1024 * 1024) {
      errors.push('maxOutputSizeBytes must be between 1KB and 1GB');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
