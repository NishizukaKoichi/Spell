# WASM Runtime Documentation

## Overview

The Spell platform is WASM-first, offering WebAssembly as the primary execution engine for spells with GitHub Actions as a fallback. This document provides comprehensive guidance on creating, deploying, and managing WASM-powered spells.

## Table of Contents

1. [Why WASM?](#why-wasm)
2. [Getting Started](#getting-started)
3. [Creating WASM Spells](#creating-wasm-spells)
4. [Execution Engines](#execution-engines)
5. [Resource Limits](#resource-limits)
6. [Cost Calculation](#cost-calculation)
7. [Security & Sandboxing](#security--sandboxing)
8. [API Reference](#api-reference)
9. [Examples](#examples)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)

## Why WASM?

WebAssembly offers several advantages for spell execution:

- **Performance**: Near-native execution speed
- **Portability**: Run anywhere (cloud, edge, local)
- **Security**: Sandboxed execution environment
- **Cost-Effective**: More efficient than GitHub Actions for many workloads
- **Fast Startup**: No container cold starts
- **Deterministic**: Predictable execution behavior

## Getting Started

### Prerequisites

- Node.js 20+ (for building examples)
- AssemblyScript, Rust, or another WASM-compatible language
- Spell platform account

### Quick Start

1. **Write your spell** (AssemblyScript example):

```typescript
// my-spell.ts
export function execute(input: string): string {
  return `Processed: ${input}`;
}
```

2. **Compile to WASM**:

```bash
npx asc my-spell.ts -o my-spell.wasm --optimize
```

3. **Upload to platform**:

```bash
curl -X POST https://spell.run/api/spells/upload-wasm \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "spellId=YOUR_SPELL_ID" \
  -F "version=1.0.0" \
  -F "wasmFile=@my-spell.wasm"
```

4. **Execute**:

```bash
curl -X POST https://spell.run/api/v1/cast \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Idempotency-Key: unique-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "spell_key": "your-spell-key",
    "input": "Hello WASM!"
  }'
```

## Creating WASM Spells

### Supported Languages

#### AssemblyScript (Recommended for JavaScript developers)

```typescript
export function execute(input: string): string {
  // Parse JSON input
  const data = JSON.parse(input);

  // Process data
  const result = {
    message: `Hello, ${data.name}`,
    timestamp: Date.now()
  };

  // Return JSON output
  return JSON.stringify(result);
}
```

Build:
```bash
npx asc spell.ts -o spell.wasm --optimize --runtime stub
```

#### Rust

```rust
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

#[no_mangle]
pub extern "C" fn execute(input_ptr: *const c_char) -> *mut c_char {
    unsafe {
        let input = CStr::from_ptr(input_ptr).to_str().unwrap();
        let output = process_input(input);
        CString::new(output).unwrap().into_raw()
    }
}

fn process_input(input: &str) -> String {
    format!("Processed: {}", input)
}
```

Build:
```bash
cargo build --target wasm32-wasi --release
```

#### Go (TinyGo)

```go
package main

import "C"
import "unsafe"

//export execute
func execute(inputPtr *C.char) *C.char {
    input := C.GoString(inputPtr)
    output := processInput(input)
    return C.CString(output)
}

func processInput(input string) string {
    return "Processed: " + input
}

func main() {}
```

Build:
```bash
tinygo build -o spell.wasm -target wasi spell.go
```

### Entry Points

Your WASM module can export one of these functions:

1. **`execute(input: pointer) -> pointer`**: Custom function for data processing
2. **`main() -> i32`**: Standard WASI entry point (return 0 for success)
3. **`_start()`**: WASI initialization function

## Execution Engines

The platform supports three execution engines:

### 1. WASM (Recommended)

- Fastest execution
- Lowest cost
- Best for: Data processing, transformations, computations

### 2. GitHub Actions

- Traditional workflow execution
- Best for: Complex deployments, multi-step processes

### 3. Hybrid

- Attempts WASM first
- Falls back to GitHub Actions on failure
- Best for: Transitioning from GitHub Actions to WASM

### Setting Execution Engine

Via API:
```typescript
await prisma.spell.update({
  where: { id: spellId },
  data: { executionEngine: 'wasm' } // or 'github_actions' or 'hybrid'
});
```

Via UI:
1. Go to spell settings
2. Select "Execution Engine"
3. Choose WASM, GitHub Actions, or Hybrid
4. Save changes

## Resource Limits

### Default Limits

```typescript
{
  maxMemoryMB: 512,           // Maximum memory usage
  maxExecutionTimeMs: 300000, // 5 minutes
  maxOutputSizeBytes: 104857600 // 100MB
}
```

### Custom Limits

Set per-spell limits:

```typescript
await prisma.spell.update({
  where: { id: spellId },
  data: {
    resourceLimits: {
      maxMemoryMB: 256,
      maxExecutionTimeMs: 60000, // 1 minute
      maxOutputSizeBytes: 10485760 // 10MB
    }
  }
});
```

### Limit Enforcement

The runtime enforces limits through:

- Memory: WebAssembly memory pages (hard limit)
- Time: Execution timeout (kills execution)
- Output: Size check before returning (rejects large outputs)

## Cost Calculation

### WASM Pricing

```
Time Cost = (execution_time_seconds) × $0.001
Memory Cost = (memory_used_mb) × $0.0001
Total Cost = Time Cost + Memory Cost
Minimum Cost = $0.01 (1 cent)
```

### Examples

| Execution Time | Memory Used | Time Cost | Memory Cost | Total Cost |
|---------------|-------------|-----------|-------------|------------|
| 100ms         | 50MB        | $0.00001  | $0.005      | $0.01      |
| 1s            | 100MB       | $0.001    | $0.01       | $0.02      |
| 10s           | 256MB       | $0.01     | $0.0256     | $0.04      |
| 60s           | 512MB       | $0.06     | $0.0512     | $0.12      |

### GitHub Actions Pricing

```
Cost = ceil(duration_minutes) × $0.008
Minimum Cost = $0.05 (5 cents)
```

### Cost Comparison

For typical data processing:
- **WASM**: ~$0.01 - $0.05 per execution
- **GitHub Actions**: ~$0.05 - $0.20 per execution

**Savings**: WASM can be 4-10x cheaper than GitHub Actions

## Security & Sandboxing

### Sandbox Features

1. **No File System Access** (by default)
   - `/tmp` can be enabled if needed
   - No access to host filesystem

2. **No Network Access** (by default)
   - Can be enabled with allowlist

3. **Memory Isolation**
   - Each execution gets its own memory space
   - Memory limits enforced

4. **Execution Timeout**
   - Prevents infinite loops
   - Configurable per spell

### Environment Variables

Sensitive variables are automatically filtered:

```typescript
// Blocked patterns
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
```

Only safe environment variables are passed to WASM.

### Module Validation

All WASM modules are validated:

1. **Magic Number Check**: Verifies valid WASM binary
2. **Hash Verification**: SHA-256 hash stored and verified
3. **Size Limit**: Max 50MB per module
4. **Compilation Check**: Module must compile successfully

## API Reference

### Upload WASM Module

```http
POST /api/spells/upload-wasm
Authorization: Bearer <session_token>
Content-Type: multipart/form-data

Form Data:
- spellId: string (required)
- version: string (required)
- wasmFile: file (required, max 50MB)
```

Response:
```json
{
  "moduleId": "wasm_abc123",
  "spellId": "spell_xyz789",
  "version": "1.0.0",
  "hash": "sha256_hash_here",
  "size": 12345,
  "message": "WASM module uploaded successfully"
}
```

### List WASM Modules

```http
GET /api/spells/upload-wasm?spellId=<spell_id>
Authorization: Bearer <session_token>
```

Response:
```json
{
  "spellId": "spell_xyz789",
  "modules": [
    {
      "id": "wasm_abc123",
      "version": "1.0.0",
      "hash": "sha256...",
      "size": 12345,
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

### Delete WASM Module

```http
DELETE /api/spells/upload-wasm?moduleId=<module_id>
Authorization: Bearer <session_token>
```

### Execute Spell

```http
POST /api/v1/cast
Authorization: Bearer <api_key>
Idempotency-Key: unique-key-123
Content-Type: application/json

{
  "spell_key": "my-spell",
  "input": {
    "data": "to process"
  }
}
```

Response:
```json
{
  "cast_id": "cast_123",
  "spell_key": "my-spell",
  "spell_name": "My Spell",
  "status": "completed",
  "cost_cents": 2,
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Examples

See `/wasm/examples/` for complete examples:

- `hello-world.ts` - Basic text processing
- `json-transform.ts` - JSON data transformation
- `hello-world.wat` - Minimal WAT example

## Best Practices

### 1. Module Design

- **Keep modules small**: Smaller modules compile and load faster
- **Single responsibility**: Each module should do one thing well
- **Stateless**: Don't rely on persistent state between executions
- **Idempotent**: Same input should always produce same output

### 2. Input Validation

```typescript
export function execute(input: string): string {
  // Validate input
  if (!input || input.length === 0) {
    throw new Error('Input is required');
  }

  if (input.length > 1000000) {
    throw new Error('Input too large');
  }

  // Process
  return processInput(input);
}
```

### 3. Error Handling

```typescript
export function execute(input: string): string {
  try {
    const data = JSON.parse(input);
    return JSON.stringify(processData(data));
  } catch (error) {
    return JSON.stringify({
      error: true,
      message: error.message
    });
  }
}
```

### 4. Performance Optimization

- **Use integers over floats**: Integer math is faster
- **Minimize allocations**: Reuse buffers when possible
- **Avoid string operations**: String manipulation is expensive
- **Profile your code**: Use execution metrics to identify bottlenecks

### 5. Versioning

- Use semantic versioning (1.0.0, 1.1.0, 2.0.0)
- Keep old versions for rollback
- Test new versions before switching

### 6. Testing

```typescript
import { loadWasmModuleFromSource } from '@/lib/wasm/module-loader';
import { executeWasm } from '@/lib/wasm/runtime';

test('spell processes data correctly', async () => {
  const module = await loadWasmModuleFromSource({
    type: 'filesystem',
    path: './my-spell.wasm'
  });

  const result = await executeWasm(module.module, {
    input: '{"name":"Alice"}'
  });

  expect(result.success).toBe(true);
  expect(result.output).toContain('Alice');
});
```

## Troubleshooting

### Module Won't Upload

**Error**: "Invalid WASM binary: missing magic number"

**Solution**: Ensure you're uploading a compiled .wasm file, not source code

**Verify**:
```bash
hexdump -C my-spell.wasm | head -1
# Should start with: 00 61 73 6d (WASM magic number)
```

### Execution Timeout

**Error**: "Execution timeout exceeded"

**Solutions**:
1. Optimize your code to run faster
2. Increase timeout in resource limits
3. Break work into smaller chunks

### Memory Limit Exceeded

**Error**: "Memory usage exceeded limit"

**Solutions**:
1. Reduce memory allocations
2. Process data in chunks
3. Increase memory limit in resource limits

### Module Not Found

**Error**: "WASM module not found for spell"

**Solution**: Upload a WASM module for the spell

**Verify**:
```bash
curl -X GET "https://spell.run/api/spells/upload-wasm?spellId=YOUR_SPELL_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Compilation Errors

**Error**: Various compilation errors

**Solution**: Check your build command and ensure all dependencies are installed

**For AssemblyScript**:
```bash
npx asc spell.ts --validate
```

**For Rust**:
```bash
cargo check --target wasm32-wasi
```

## Monitoring & Metrics

### Execution Metrics

All WASM executions are tracked:

```typescript
interface WasmExecution {
  id: string;
  castId: string;
  spellId: string;
  executionTimeMs: number;
  memoryUsedMb: number;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
}
```

### Performance Trends

View performance trends:

```typescript
import { getPerformanceTrends } from '@/lib/wasm/metrics';

const trends = await getPerformanceTrends(spellId, 30); // Last 30 days
```

### Comparing Engines

```typescript
import { getExecutionEngineStats } from '@/lib/execution/router';

const stats = await getExecutionEngineStats(startDate, endDate);

console.log('WASM:', stats.wasm);
console.log('GitHub Actions:', stats.githubActions);
```

## Support

- **Documentation**: This file and `/wasm/examples/README.md`
- **Examples**: `/wasm/examples/`
- **Tests**: `/tests/lib/wasm/`
- **GitHub Issues**: Report bugs and request features
- **Discord**: Community support and discussions

## Roadmap

Future enhancements:

- [ ] Component Model support
- [ ] WASM threads (multi-threading)
- [ ] Streaming I/O
- [ ] GPU acceleration via WebGPU
- [ ] Custom WASM runtimes (user-provided)
- [ ] WASM module marketplace
- [ ] Built-in profiling tools
- [ ] Visual debugger

## Changelog

### v1.0.0 (2024-01-01)

- Initial WASM runtime implementation
- AssemblyScript, Rust, and Go support
- Resource limits and sandboxing
- Cost calculation
- Metrics and monitoring
- Example modules
- Comprehensive documentation
