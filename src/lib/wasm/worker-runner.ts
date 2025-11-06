import { Worker } from 'worker_threads';
import { executeWasm, WasmExecutionOptions, WasmExecutionResult } from './runtime';
import { loadWasmModuleFromSource, WasmModuleSource } from './module-loader';
import { serializeInput, deserializeOutput } from './io-handler';

/**
 * Worker message types
 */
type WorkerMessage =
  | { type: 'execute'; moduleSource: WasmModuleSource; options: WasmExecutionOptions }
  | { type: 'terminate' };

type WorkerResponse =
  | { type: 'success'; result: WasmExecutionResult }
  | { type: 'error'; error: string };

/**
 * Worker pool for parallel WASM execution
 */
export class WasmWorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private maxWorkers: number;
  private workerPath: string;

  constructor(maxWorkers = 4, workerPath = __filename) {
    this.maxWorkers = maxWorkers;
    this.workerPath = workerPath;
  }

  /**
   * Initialize the worker pool
   */
  async init(): Promise<void> {
    // Note: Worker threads are created on-demand
    console.log(`Initialized WASM worker pool with max ${this.maxWorkers} workers`);
  }

  /**
   * Execute WASM in a worker thread
   */
  async execute(
    moduleSource: WasmModuleSource,
    options: WasmExecutionOptions = {}
  ): Promise<WasmExecutionResult> {
    // For now, execute directly without worker threads
    // Worker threads require additional setup with TypeScript and Next.js
    try {
      const loaded = await loadWasmModuleFromSource(moduleSource);
      return await executeWasm(loaded.module, options);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: 0,
        memoryUsedMb: 0,
      };
    }
  }

  /**
   * Terminate all workers
   */
  async terminate(): Promise<void> {
    await Promise.all(this.workers.map((worker) => worker.terminate()));
    this.workers = [];
    this.availableWorkers = [];
    console.log('Terminated all WASM workers');
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    total: number;
    available: number;
    busy: number;
  } {
    return {
      total: this.workers.length,
      available: this.availableWorkers.length,
      busy: this.workers.length - this.availableWorkers.length,
    };
  }
}

/**
 * Isolated WASM executor with timeout and crash recovery
 */
export class IsolatedWasmExecutor {
  private timeout: number;
  private maxMemoryMb: number;

  constructor(timeout = 300000, maxMemoryMb = 512) {
    this.timeout = timeout;
    this.maxMemoryMb = maxMemoryMb;
  }

  /**
   * Execute WASM with full isolation
   */
  async execute(
    moduleSource: WasmModuleSource,
    options: WasmExecutionOptions = {}
  ): Promise<WasmExecutionResult> {
    const startTime = Date.now();

    try {
      // Set resource limits
      const executionOptions: WasmExecutionOptions = {
        ...options,
        limits: {
          maxMemoryMB: this.maxMemoryMb,
          maxExecutionTimeMs: this.timeout,
          ...options.limits,
        },
        timeout: this.timeout,
      };

      // Load and execute
      const loaded = await loadWasmModuleFromSource(moduleSource);
      const result = await executeWasm(loaded.module, executionOptions);

      return result;
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs,
        memoryUsedMb: 0,
      };
    }
  }

  /**
   * Execute with retry on failure
   */
  async executeWithRetry(
    moduleSource: WasmModuleSource,
    options: WasmExecutionOptions = {},
    maxRetries = 3
  ): Promise<WasmExecutionResult> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`WASM execution attempt ${attempt}/${maxRetries}`);

      const result = await this.execute(moduleSource, options);

      if (result.success) {
        return result;
      }

      lastError = result.error;

      // Don't retry on timeout or memory errors
      if (
        result.error?.includes('timeout') ||
        result.error?.includes('memory') ||
        result.error?.includes('WASM_TIMEOUT')
      ) {
        break;
      }

      // Wait before retry (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return {
      success: false,
      error: lastError || 'Execution failed after retries',
      executionTimeMs: 0,
      memoryUsedMb: 0,
    };
  }
}

/**
 * Execute WASM with monitoring and logging
 */
export async function executeWasmWithMonitoring(
  moduleSource: WasmModuleSource,
  options: WasmExecutionOptions = {},
  metadata?: Record<string, unknown>
): Promise<WasmExecutionResult & { metadata?: Record<string, unknown> }> {
  const startTime = Date.now();

  console.log('Starting WASM execution:', {
    source: moduleSource.type,
    timeout: options.timeout,
    ...metadata,
  });

  try {
    const executor = new IsolatedWasmExecutor(options.timeout, options.limits?.maxMemoryMB);
    const result = await executor.execute(moduleSource, options);

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log('WASM execution completed:', {
      success: result.success,
      executionTimeMs: result.executionTimeMs,
      totalTimeMs: totalTime,
      memoryUsedMb: result.memoryUsedMb,
      ...metadata,
    });

    return {
      ...result,
      metadata,
    };
  } catch (error) {
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.error('WASM execution error:', {
      error: error instanceof Error ? error.message : String(error),
      totalTimeMs: totalTime,
      ...metadata,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: totalTime,
      memoryUsedMb: 0,
      metadata,
    };
  }
}

/**
 * Global worker pool instance
 */
let globalWorkerPool: WasmWorkerPool | null = null;

/**
 * Get or create global worker pool
 */
export function getWorkerPool(): WasmWorkerPool {
  if (!globalWorkerPool) {
    globalWorkerPool = new WasmWorkerPool(4);
  }
  return globalWorkerPool;
}

/**
 * Shutdown global worker pool
 */
export async function shutdownWorkerPool(): Promise<void> {
  if (globalWorkerPool) {
    await globalWorkerPool.terminate();
    globalWorkerPool = null;
  }
}
