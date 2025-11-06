import { prisma } from '@/lib/prisma';
import { loadWasmModule, validateWasmModule, calculateWasmHash } from './runtime';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * WASM module source types
 */
export type WasmModuleSource =
  | { type: 'filesystem'; path: string }
  | { type: 'database'; spellId: string; version?: string }
  | { type: 'url'; url: string }
  | { type: 'buffer'; buffer: Buffer };

/**
 * Loaded WASM module with metadata
 */
export interface LoadedWasmModule {
  module: WebAssembly.Module;
  binary: Buffer;
  hash: string;
  size: number;
  version?: string;
}

/**
 * Module cache for compiled WASM modules
 */
const moduleCache = new Map<string, { module: WebAssembly.Module; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Load WASM module from various sources
 */
export async function loadWasmModuleFromSource(
  source: WasmModuleSource
): Promise<LoadedWasmModule> {
  let wasmBinary: Buffer;
  let version: string | undefined;

  switch (source.type) {
    case 'filesystem':
      wasmBinary = await loadFromFilesystem(source.path);
      break;

    case 'database':
      const dbResult = await loadFromDatabase(source.spellId, source.version);
      wasmBinary = dbResult.binary;
      version = dbResult.version;
      break;

    case 'url':
      wasmBinary = await loadFromUrl(source.url);
      break;

    case 'buffer':
      wasmBinary = source.buffer;
      break;

    default:
      throw new Error('Invalid WASM module source type');
  }

  // Validate WASM binary
  if (!validateWasmModule(wasmBinary)) {
    throw new Error('Invalid WASM binary: missing magic number');
  }

  // Calculate hash
  const hash = calculateWasmHash(wasmBinary);

  // Check cache
  const cachedModule = getCachedModule(hash);
  if (cachedModule) {
    console.log(`Using cached WASM module: ${hash}`);
    return {
      module: cachedModule,
      binary: wasmBinary,
      hash,
      size: wasmBinary.length,
      version,
    };
  }

  // Compile module
  const module = await loadWasmModule(wasmBinary);

  // Cache the compiled module
  cacheModule(hash, module);

  return {
    module,
    binary: wasmBinary,
    hash,
    size: wasmBinary.length,
    version,
  };
}

/**
 * Load WASM module from filesystem
 */
async function loadFromFilesystem(filePath: string): Promise<Buffer> {
  try {
    const resolvedPath = path.resolve(filePath);
    const binary = await fs.readFile(resolvedPath);
    console.log(`Loaded WASM module from filesystem: ${resolvedPath} (${binary.length} bytes)`);
    return binary;
  } catch (error) {
    throw new Error(
      `Failed to load WASM module from filesystem: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load WASM module from database
 */
async function loadFromDatabase(
  spellId: string,
  version?: string
): Promise<{ binary: Buffer; version: string }> {
  try {
    let wasmModule;

    if (version) {
      // Load specific version
      wasmModule = await prisma.wasmModule.findFirst({
        where: {
          spellId,
          version,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      // Load latest version
      wasmModule = await prisma.wasmModule.findFirst({
        where: {
          spellId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    if (!wasmModule) {
      throw new Error(
        `WASM module not found for spell ${spellId}${version ? ` version ${version}` : ''}`
      );
    }

    console.log(
      `Loaded WASM module from database: spell=${spellId}, version=${wasmModule.version} (${wasmModule.size} bytes)`
    );

    return {
      binary: Buffer.from(wasmModule.wasmBinary),
      version: wasmModule.version,
    };
  } catch (error) {
    throw new Error(
      `Failed to load WASM module from database: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Load WASM module from URL
 */
async function loadFromUrl(url: string): Promise<Buffer> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const binary = Buffer.from(arrayBuffer);

    console.log(`Loaded WASM module from URL: ${url} (${binary.length} bytes)`);

    return binary;
  } catch (error) {
    throw new Error(
      `Failed to load WASM module from URL: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Store WASM module in database
 */
export async function storeWasmModule(
  spellId: string,
  version: string,
  wasmBinary: Buffer,
  metadata?: Record<string, unknown>
): Promise<{ id: string; hash: string }> {
  // Validate binary
  if (!validateWasmModule(wasmBinary)) {
    throw new Error('Invalid WASM binary');
  }

  // Calculate hash
  const hash = calculateWasmHash(wasmBinary);
  const size = wasmBinary.length;

  // Check if module with same hash already exists
  const existing = await prisma.wasmModule.findFirst({
    where: {
      spellId,
      hash,
    },
  });

  if (existing) {
    console.log(`WASM module already exists with hash: ${hash}`);
    return { id: existing.id, hash };
  }

  // Store in database
  const wasmModule = await prisma.wasmModule.create({
    data: {
      spellId,
      version,
      wasmBinary,
      hash,
      size,
      metadata: metadata || null,
    },
  });

  console.log(`Stored WASM module: id=${wasmModule.id}, hash=${hash}, size=${size}`);

  return { id: wasmModule.id, hash };
}

/**
 * Verify WASM module hash
 */
export async function verifyWasmModuleHash(spellId: string, expectedHash: string): Promise<boolean> {
  try {
    const wasmModule = await prisma.wasmModule.findFirst({
      where: {
        spellId,
        hash: expectedHash,
      },
    });

    if (!wasmModule) {
      return false;
    }

    // Recalculate hash to verify
    const actualHash = calculateWasmHash(wasmModule.wasmBinary);
    return actualHash === expectedHash;
  } catch (error) {
    console.error('Failed to verify WASM module hash:', error);
    return false;
  }
}

/**
 * Get cached compiled module
 */
function getCachedModule(hash: string): WebAssembly.Module | null {
  const cached = moduleCache.get(hash);

  if (!cached) {
    return null;
  }

  // Check if cache entry is still valid
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    moduleCache.delete(hash);
    return null;
  }

  return cached.module;
}

/**
 * Cache compiled module
 */
function cacheModule(hash: string, module: WebAssembly.Module): void {
  moduleCache.set(hash, {
    module,
    timestamp: Date.now(),
  });

  console.log(`Cached WASM module: ${hash} (cache size: ${moduleCache.size})`);

  // Clean up old cache entries
  cleanupCache();
}

/**
 * Clean up expired cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [hash, entry] of moduleCache.entries()) {
    const age = now - entry.timestamp;
    if (age > CACHE_TTL_MS) {
      moduleCache.delete(hash);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} expired WASM module cache entries`);
  }
}

/**
 * Clear module cache
 */
export function clearModuleCache(): void {
  const size = moduleCache.size;
  moduleCache.clear();
  console.log(`Cleared WASM module cache (${size} entries)`);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  entries: Array<{ hash: string; age: number }>;
} {
  const now = Date.now();
  const entries = Array.from(moduleCache.entries()).map(([hash, entry]) => ({
    hash,
    age: now - entry.timestamp,
  }));

  return {
    size: moduleCache.size,
    entries,
  };
}

/**
 * List all WASM modules for a spell
 */
export async function listSpellWasmModules(spellId: string): Promise<
  Array<{
    id: string;
    version: string;
    hash: string;
    size: number;
    createdAt: Date;
  }>
> {
  const modules = await prisma.wasmModule.findMany({
    where: {
      spellId,
    },
    select: {
      id: true,
      version: true,
      hash: true,
      size: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return modules;
}

/**
 * Delete old WASM module versions (keep latest N versions)
 */
export async function pruneOldWasmModules(spellId: string, keepLatest = 5): Promise<number> {
  const modules = await prisma.wasmModule.findMany({
    where: {
      spellId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
    },
  });

  if (modules.length <= keepLatest) {
    return 0;
  }

  const toDelete = modules.slice(keepLatest);
  const deleteIds = toDelete.map((m) => m.id);

  const result = await prisma.wasmModule.deleteMany({
    where: {
      id: {
        in: deleteIds,
      },
    },
  });

  console.log(`Pruned ${result.count} old WASM modules for spell ${spellId}`);

  return result.count;
}
