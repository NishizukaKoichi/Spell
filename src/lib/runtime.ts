import 'server-only';

import path from 'node:path';
import { promises as fs } from 'node:fs';

import { publish as publishToNats } from './nats';

const wasmInstanceCache = new Map<
  string,
  Promise<{
    instance: WebAssembly.Instance;
    exports: SpellWasmExports;
  }>
>();

const decoder = new TextDecoder();
const encoder = new TextEncoder();

interface SpellWasmExports {
  memory: WebAssembly.Memory;
  run?: (inputPtr: number, inputLen: number) => number;
  alloc?: (size: number) => number;
  dealloc?: (ptr: number, size: number) => void;
  result_ptr?: () => number;
  result_len?: () => number;
}

interface WasmExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

function getWasmRoot(): string {
  return process.env.SPELL_WASM_ROOT || path.join(process.cwd(), 'wasm');
}

async function loadWasmModule(templateId: string): Promise<{
  instance: WebAssembly.Instance;
  exports: SpellWasmExports;
}> {
  const cacheKey = templateId;

  if (!wasmInstanceCache.has(cacheKey)) {
    wasmInstanceCache.set(
      cacheKey,
      (async () => {
        const wasmRoot = getWasmRoot();
        const wasmPath = path.join(wasmRoot, `${templateId}.wasm`);

        let moduleBuffer: Buffer;
        try {
          moduleBuffer = await fs.readFile(wasmPath);
        } catch {
          throw new Error(`Wasm template not found at ${wasmPath}`);
        }

        const wasmModule = await WebAssembly.compile(new Uint8Array(moduleBuffer));
        const instance = await WebAssembly.instantiate(wasmModule, {});
        const exports = instance.exports as unknown as SpellWasmExports;

        if (!exports.memory) {
          throw new Error(`Wasm template ${templateId} does not export memory`);
        }

        if (typeof exports.run !== 'function') {
          throw new Error(`Wasm template ${templateId} must export a run(ptr, len) function`);
        }

        return {
          instance,
          exports,
        };
      })()
    );
  }

  return wasmInstanceCache.get(cacheKey)!;
}

function writeInput(exports: SpellWasmExports, payload: Record<string, unknown>) {
  const inputBuffer = encoder.encode(JSON.stringify(payload ?? {}));

  if (typeof exports.alloc !== 'function') {
    throw new Error('Wasm template must export alloc(size: number)');
  }

  const ptr = exports.alloc(inputBuffer.length);
  const memoryView = new Uint8Array(exports.memory.buffer, ptr, inputBuffer.length);
  memoryView.set(inputBuffer);
  return { ptr, length: inputBuffer.length } as const;
}

function readOutput(exports: SpellWasmExports, ptr: number): { value: unknown; length: number } {
  if (typeof exports.result_len !== 'function') {
    return { value: null, length: 0 };
  }

  const length = exports.result_len();
  if (length <= 0) {
    return { value: null, length: 0 };
  }

  const memoryView = new Uint8Array(exports.memory.buffer, ptr, length);
  const json = decoder.decode(memoryView);
  try {
    return { value: JSON.parse(json), length };
  } catch {
    return { value: json, length };
  }
}

/**
 * Execute a Wasm template with given inputs
 * @param templateId - The Wasm template identifier (e.g. spell key)
 * @param inputs - Input data for the template
 */
export async function runWasmTemplate(
  templateId: string,
  inputs: Record<string, unknown>
): Promise<WasmExecutionResult> {
  try {
    const { exports } = await loadWasmModule(templateId);
    const { ptr, length } = writeInput(exports, inputs);

    const outputPtr = exports.run!(ptr, length);
    const { value: output, length: outputLength } = readOutput(exports, outputPtr);

    if (typeof exports.dealloc === 'function') {
      exports.dealloc(ptr, length);
      if (outputLength > 0) {
        exports.dealloc(outputPtr, outputLength);
      }
    }

    return {
      success: true,
      output: output ?? { message: 'Wasm execution finished with no output' },
    };
  } catch (error) {
    console.error('[Runtime] Wasm execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Wasm execution error',
    };
  }
}

export const NATS = {
  async publish(subject: string, data: unknown): Promise<void> {
    if (typeof data === 'string') {
      await publishToNats(subject, data);
      return;
    }

    if (data && typeof data === 'object') {
      await publishToNats(subject, data as Record<string, unknown>);
      return;
    }

    await publishToNats(subject, { value: data });
  },
};
