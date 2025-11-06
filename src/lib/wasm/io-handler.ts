/**
 * Input/Output handler for WASM module communication
 * Handles serialization and deserialization of data between JavaScript and WASM
 */

/**
 * Supported data types for WASM I/O
 */
export type WasmDataType = 'json' | 'text' | 'binary' | 'number' | 'boolean';

/**
 * WASM input/output data
 */
export interface WasmData {
  type: WasmDataType;
  value: unknown;
}

/**
 * Serialization options
 */
export interface SerializationOptions {
  maxSize?: number;
  encoding?: BufferEncoding;
}

/**
 * Default serialization options
 */
const DEFAULT_OPTIONS: SerializationOptions = {
  maxSize: 100 * 1024 * 1024, // 100MB
  encoding: 'utf8',
};

/**
 * Serialize input data for WASM consumption
 */
export function serializeInput(input: unknown, options: SerializationOptions = {}): Buffer {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    let buffer: Buffer;

    // Detect data type and serialize accordingly
    if (input === null || input === undefined) {
      buffer = Buffer.from('null');
    } else if (typeof input === 'string') {
      buffer = Buffer.from(input, opts.encoding);
    } else if (typeof input === 'number') {
      buffer = Buffer.from(input.toString());
    } else if (typeof input === 'boolean') {
      buffer = Buffer.from(input.toString());
    } else if (Buffer.isBuffer(input)) {
      buffer = input;
    } else if (input instanceof Uint8Array) {
      buffer = Buffer.from(input);
    } else if (ArrayBuffer.isView(input)) {
      buffer = Buffer.from(input.buffer);
    } else {
      // Serialize as JSON for objects and arrays
      const json = JSON.stringify(input);
      buffer = Buffer.from(json, opts.encoding);
    }

    // Check size limit
    if (opts.maxSize && buffer.length > opts.maxSize) {
      throw new Error(
        `Input size (${buffer.length} bytes) exceeds maximum allowed size (${opts.maxSize} bytes)`
      );
    }

    return buffer;
  } catch (error) {
    throw new Error(
      `Failed to serialize input: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Deserialize output data from WASM
 */
export function deserializeOutput(
  buffer: Buffer | Uint8Array,
  type: WasmDataType = 'json',
  options: SerializationOptions = {}
): unknown {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    // Check size limit
    if (opts.maxSize && data.length > opts.maxSize) {
      throw new Error(
        `Output size (${data.length} bytes) exceeds maximum allowed size (${opts.maxSize} bytes)`
      );
    }

    switch (type) {
      case 'json':
        return JSON.parse(data.toString(opts.encoding));

      case 'text':
        return data.toString(opts.encoding);

      case 'binary':
        return data;

      case 'number':
        const numStr = data.toString(opts.encoding);
        const num = Number(numStr);
        if (isNaN(num)) {
          throw new Error(`Invalid number: ${numStr}`);
        }
        return num;

      case 'boolean':
        const boolStr = data.toString(opts.encoding).toLowerCase();
        if (boolStr === 'true' || boolStr === '1') return true;
        if (boolStr === 'false' || boolStr === '0') return false;
        throw new Error(`Invalid boolean: ${boolStr}`);

      default:
        throw new Error(`Unsupported output type: ${type}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to deserialize output: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Auto-detect data type from input
 */
export function detectDataType(input: unknown): WasmDataType {
  if (typeof input === 'string') return 'text';
  if (typeof input === 'number') return 'number';
  if (typeof input === 'boolean') return 'boolean';
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) return 'binary';
  return 'json'; // Default for objects and arrays
}

/**
 * Validate input against schema
 */
export function validateInput(input: unknown, schema?: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // If no schema provided, consider valid
  if (!schema) {
    return { valid: true, errors: [] };
  }

  try {
    // Basic schema validation
    if (schema.type === 'object' && typeof input !== 'object') {
      errors.push(`Expected object, got ${typeof input}`);
    } else if (schema.type === 'string' && typeof input !== 'string') {
      errors.push(`Expected string, got ${typeof input}`);
    } else if (schema.type === 'number' && typeof input !== 'number') {
      errors.push(`Expected number, got ${typeof input}`);
    } else if (schema.type === 'boolean' && typeof input !== 'boolean') {
      errors.push(`Expected boolean, got ${typeof input}`);
    } else if (schema.type === 'array' && !Array.isArray(input)) {
      errors.push(`Expected array, got ${typeof input}`);
    }

    // Check required properties for objects
    if (
      schema.type === 'object' &&
      schema.properties &&
      typeof input === 'object' &&
      input !== null
    ) {
      const properties = schema.properties as Record<string, unknown>;
      const required = (schema.required as string[]) || [];

      for (const key of required) {
        if (!(key in (input as Record<string, unknown>))) {
          errors.push(`Missing required property: ${key}`);
        }
      }
    }
  } catch (error) {
    errors.push(`Schema validation error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create WASM memory view for data transfer
 */
export function createMemoryView(
  memory: WebAssembly.Memory,
  ptr: number,
  length: number
): Uint8Array {
  return new Uint8Array(memory.buffer, ptr, length);
}

/**
 * Write data to WASM memory
 */
export function writeToMemory(memory: WebAssembly.Memory, ptr: number, data: Buffer): void {
  const view = new Uint8Array(memory.buffer);
  view.set(data, ptr);
}

/**
 * Read data from WASM memory
 */
export function readFromMemory(memory: WebAssembly.Memory, ptr: number, length: number): Buffer {
  const view = new Uint8Array(memory.buffer, ptr, length);
  return Buffer.from(view);
}

/**
 * Stream handler for large data processing
 */
export class WasmStreamHandler {
  private chunks: Buffer[] = [];
  private totalSize = 0;
  private maxSize: number;

  constructor(maxSize = 100 * 1024 * 1024) {
    this.maxSize = maxSize;
  }

  /**
   * Add chunk to stream
   */
  addChunk(chunk: Buffer): void {
    if (this.totalSize + chunk.length > this.maxSize) {
      throw new Error(`Stream size exceeds maximum allowed size (${this.maxSize} bytes)`);
    }

    this.chunks.push(chunk);
    this.totalSize += chunk.length;
  }

  /**
   * Get all chunks concatenated
   */
  getBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }

  /**
   * Get total size
   */
  getSize(): number {
    return this.totalSize;
  }

  /**
   * Clear stream
   */
  clear(): void {
    this.chunks = [];
    this.totalSize = 0;
  }
}

/**
 * Format output for API response
 */
export function formatOutput(
  output: unknown,
  format: 'json' | 'text' | 'base64' = 'json'
): string | unknown {
  switch (format) {
    case 'json':
      return output;

    case 'text':
      if (typeof output === 'string') return output;
      if (Buffer.isBuffer(output)) return output.toString('utf8');
      return JSON.stringify(output);

    case 'base64':
      if (Buffer.isBuffer(output)) return output.toString('base64');
      if (typeof output === 'string') return Buffer.from(output).toString('base64');
      return Buffer.from(JSON.stringify(output)).toString('base64');

    default:
      return output;
  }
}

/**
 * Parse input from API request
 */
export function parseInput(
  input: unknown,
  contentType?: string
): { data: unknown; type: WasmDataType } {
  if (!input) {
    return { data: null, type: 'json' };
  }

  // Detect type from content-type header
  if (contentType) {
    if (contentType.includes('application/json')) {
      return { data: input, type: 'json' };
    } else if (contentType.includes('text/')) {
      return { data: input, type: 'text' };
    } else if (contentType.includes('application/octet-stream')) {
      return { data: input, type: 'binary' };
    }
  }

  // Auto-detect from data
  const type = detectDataType(input);
  return { data: input, type };
}

/**
 * Convert WASM pointer and length to JavaScript value
 */
export function pointerToValue(
  memory: WebAssembly.Memory,
  ptr: number,
  len: number,
  type: WasmDataType = 'json'
): unknown {
  const buffer = readFromMemory(memory, ptr, len);
  return deserializeOutput(buffer, type);
}

/**
 * Convert JavaScript value to WASM pointer and length
 */
export function valueToPointer(
  memory: WebAssembly.Memory,
  value: unknown,
  allocFn: (size: number) => number
): { ptr: number; len: number } {
  const buffer = serializeInput(value);
  const len = buffer.length;
  const ptr = allocFn(len);
  writeToMemory(memory, ptr, buffer);
  return { ptr, len };
}
