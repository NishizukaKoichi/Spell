import { WASI } from '@wasmer/wasi';
import crypto from 'crypto';

/**
 * Resource limits for WASM execution
 */
export interface WasmResourceLimits {
  maxMemoryMB: number;
  maxExecutionTimeMs: number;
  maxOutputSizeBytes: number;
}

/**
 * Default resource limits
 */
export const DEFAULT_RESOURCE_LIMITS: WasmResourceLimits = {
  maxMemoryMB: 512,
  maxExecutionTimeMs: 300000, // 5 minutes
  maxOutputSizeBytes: 100 * 1024 * 1024, // 100MB
};

/**
 * WASM execution result
 */
export interface WasmExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
  memoryUsedMb: number;
  exitCode?: number;
}

/**
 * WASM execution options
 */
export interface WasmExecutionOptions {
  input?: unknown;
  env?: Record<string, string>;
  limits?: Partial<WasmResourceLimits>;
  timeout?: number;
}

/**
 * WASM runtime error
 */
export class WasmRuntimeError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'WasmRuntimeError';
  }
}

/**
 * Load and compile a WASM module from binary data
 */
export async function loadWasmModule(wasmBinary: Buffer | Uint8Array): Promise<WebAssembly.Module> {
  try {
    const startTime = Date.now();
    const module = await WebAssembly.compile(wasmBinary);
    const compileTime = Date.now() - startTime;
    console.log(`WASM module compiled in ${compileTime}ms`);
    return module;
  } catch (error) {
    throw new WasmRuntimeError(
      'Failed to compile WASM module',
      'WASM_COMPILE_ERROR',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Validate WASM module binary
 */
export function validateWasmModule(wasmBinary: Buffer | Uint8Array): boolean {
  // Check WASM magic number: 0x00 0x61 0x73 0x6D (null a s m)
  if (wasmBinary.length < 4) {
    return false;
  }
  return (
    wasmBinary[0] === 0x00 &&
    wasmBinary[1] === 0x61 &&
    wasmBinary[2] === 0x73 &&
    wasmBinary[3] === 0x6d
  );
}

/**
 * Calculate SHA-256 hash of WASM module
 */
export function calculateWasmHash(wasmBinary: Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(wasmBinary).digest('hex');
}

/**
 * Execute a WASM module with given inputs
 */
export async function executeWasm(
  wasmModule: WebAssembly.Module,
  options: WasmExecutionOptions = {}
): Promise<WasmExecutionResult> {
  const startTime = Date.now();
  const limits = { ...DEFAULT_RESOURCE_LIMITS, ...options.limits };
  const timeout = options.timeout || limits.maxExecutionTimeMs;

  let executionTimer: NodeJS.Timeout | null = null;
  let timedOut = false;

  try {
    // Create WASI instance for system interface
    const wasi = new WASI({
      args: [],
      env: options.env || {},
      preopens: {
        '/tmp': '/tmp',
      },
    });

    // Memory limit enforcement
    const memory = new WebAssembly.Memory({
      initial: 256, // 16MB (256 * 64KB pages)
      maximum: Math.floor((limits.maxMemoryMB * 1024) / 64), // Convert MB to pages
    });

    // Create import object with WASI and custom functions
    const importObject: WebAssembly.Imports = {
      wasi_snapshot_preview1: wasi.wasiImport,
      env: {
        memory,
      },
    };

    // Instantiate the module
    const instance = await WebAssembly.instantiate(wasmModule, importObject);

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      executionTimer = setTimeout(() => {
        timedOut = true;
        reject(
          new WasmRuntimeError('Execution timeout exceeded', 'WASM_TIMEOUT', {
            timeoutMs: timeout,
          })
        );
      }, timeout);
    });

    // Execute the WASM module
    let output: unknown;
    let exitCode = 0;

    try {
      // Try to find and call the main export function
      const wasmInstance = instance.instance as WebAssembly.Instance & {
        exports: {
          _start?: () => void;
          main?: () => number;
          execute?: (input: number) => number;
          memory?: WebAssembly.Memory;
        };
      };

      // Initialize WASI
      if (wasmInstance.exports._start) {
        await Promise.race([
          Promise.resolve(wasi.start(instance.instance)),
          timeoutPromise,
        ]);
      } else if (wasmInstance.exports.main) {
        exitCode = await Promise.race([
          Promise.resolve(wasmInstance.exports.main()),
          timeoutPromise,
        ]);
      } else if (wasmInstance.exports.execute) {
        // Custom execute function - pass input as pointer
        const result = await Promise.race([
          Promise.resolve(wasmInstance.exports.execute(0)),
          timeoutPromise,
        ]);
        output = result;
      } else {
        throw new WasmRuntimeError(
          'No suitable entry point found in WASM module',
          'WASM_NO_ENTRY_POINT',
          { exports: Object.keys(wasmInstance.exports) }
        );
      }
    } catch (error) {
      if (timedOut) {
        throw error;
      }
      throw new WasmRuntimeError(
        'WASM execution failed',
        'WASM_EXECUTION_ERROR',
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      if (executionTimer) {
        clearTimeout(executionTimer);
      }
    }

    // Calculate execution metrics
    const executionTimeMs = Date.now() - startTime;
    const memoryUsedMb = memory.buffer.byteLength / (1024 * 1024);

    return {
      success: exitCode === 0,
      output,
      executionTimeMs,
      memoryUsedMb,
      exitCode,
    };
  } catch (error) {
    if (executionTimer) {
      clearTimeout(executionTimer);
    }

    const executionTimeMs = Date.now() - startTime;

    if (error instanceof WasmRuntimeError) {
      return {
        success: false,
        error: error.message,
        executionTimeMs,
        memoryUsedMb: 0,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown execution error',
      executionTimeMs,
      memoryUsedMb: 0,
    };
  }
}

/**
 * Handle WASM runtime errors with detailed logging
 */
export function handleWasmError(error: unknown): {
  message: string;
  code: string;
  details?: unknown;
} {
  if (error instanceof WasmRuntimeError) {
    console.error(`WASM Runtime Error [${error.code}]:`, error.message, error.details);
    return {
      message: error.message,
      code: error.code,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    console.error('WASM Error:', error.message, error.stack);
    return {
      message: error.message,
      code: 'WASM_UNKNOWN_ERROR',
    };
  }

  console.error('Unknown WASM Error:', error);
  return {
    message: 'An unknown error occurred during WASM execution',
    code: 'WASM_UNKNOWN_ERROR',
    details: error,
  };
}

/**
 * Check if a WASM module has required exports
 */
export function checkWasmExports(
  module: WebAssembly.Module,
  requiredExports: string[]
): { valid: boolean; missing: string[] } {
  const exports = WebAssembly.Module.exports(module);
  const exportNames = exports.map((e) => e.name);
  const missing = requiredExports.filter((name) => !exportNames.includes(name));

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Get WASM module metadata
 */
export function getWasmModuleInfo(module: WebAssembly.Module): {
  imports: WebAssembly.ModuleImportDescriptor[];
  exports: WebAssembly.ModuleExportDescriptor[];
  customSections: string[];
} {
  return {
    imports: WebAssembly.Module.imports(module),
    exports: WebAssembly.Module.exports(module),
    customSections: WebAssembly.Module.customSections(module, 'name').map(() => 'name'),
  };
}
