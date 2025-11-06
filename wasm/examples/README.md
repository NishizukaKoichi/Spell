# WASM Example Spells

This directory contains example WebAssembly modules that demonstrate various capabilities of the Spell platform's WASM runtime.

## Examples

### 1. Hello World (`hello-world.ts`)

A simple example that demonstrates:
- Reading string input
- Basic text processing
- String manipulation functions (uppercase, lowercase, word count)
- Returning string output

**Functions:**
- `execute(input: string): string` - Main entry point, returns greeting
- `add(a: i32, b: i32): i32` - Simple arithmetic
- `uppercase(text: string): string` - Convert to uppercase
- `lowercase(text: string): string` - Convert to lowercase
- `wordCount(text: string): i32` - Count words in text

**Usage:**
```bash
Input: "Alice"
Output: "Hello, Alice! Welcome to WASM-powered spells."

Input: {"name": "Bob"}
Output: "Hello, Bob! Welcome to WASM-powered spells."
```

### 2. JSON Transform (`json-transform.ts`)

Demonstrates JSON data transformation:
- Parsing JSON input
- Transforming data fields
- Data validation
- Creating JSON output

**Functions:**
- `execute(input: string): string` - Transform JSON data
- `filterByAge(jsonArray: string, minAge: i32): string` - Filter by age
- `merge(json1: string, json2: string): string` - Merge objects
- `validate(json: string): string` - Validate JSON structure

**Usage:**
```bash
Input: {"name": "Alice", "email": "alice@example.com", "age": 25}
Output: {
  "name_uppercase": "ALICE",
  "name_lowercase": "alice",
  "name_length": "5",
  "email": "alice@example.com",
  "email_valid": "true",
  "email_domain": "example.com",
  "age": "25",
  "is_adult": "true",
  "birth_year_approx": "1999"
}
```

### 3. Hello World (WAT) (`hello-world.wat`)

A minimal WebAssembly Text format example showing:
- Basic WASM module structure
- Memory import from host
- Simple function exports
- Return codes

## Building Examples

### Prerequisites

```bash
# Install AssemblyScript (already installed)
pnpm add -D assemblyscript

# Initialize AssemblyScript config (if needed)
npx asinit .
```

### Build Commands

```bash
# Build hello-world example
npx asc wasm/examples/hello-world.ts -o wasm/examples/hello-world.wasm --optimize

# Build json-transform example
npx asc wasm/examples/json-transform.ts -o wasm/examples/json-transform.wasm --optimize

# Build WAT to WASM
npx wat2wasm wasm/examples/hello-world.wat -o wasm/examples/hello-world-wat.wasm
```

### Build Script

A convenience script is provided to build all examples:

```bash
pnpm run build:wasm
```

## Testing Locally

You can test WASM modules locally before uploading:

```typescript
import { loadWasmModuleFromSource } from '@/lib/wasm/module-loader';
import { executeWasm } from '@/lib/wasm/runtime';
import { readFileSync } from 'fs';

// Load WASM module
const wasmBinary = readFileSync('wasm/examples/hello-world.wasm');
const loaded = await loadWasmModuleFromSource({
  type: 'buffer',
  buffer: wasmBinary,
});

// Execute
const result = await executeWasm(loaded.module, {
  input: 'Alice',
});

console.log(result);
```

## Uploading to Platform

### Via API

```bash
curl -X POST https://spell.run/api/spells/upload-wasm \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -F "spellId=YOUR_SPELL_ID" \
  -F "version=1.0.0" \
  -F "wasmFile=@wasm/examples/hello-world.wasm"
```

### Via UI

1. Go to your spell's settings page
2. Navigate to "WASM Module" section
3. Upload the compiled .wasm file
4. Set the execution engine to "wasm" or "hybrid"
5. Save changes

## Writing Your Own WASM Spells

### AssemblyScript (Recommended)

AssemblyScript is TypeScript-like language that compiles to WASM:

```typescript
// my-spell.ts
export function execute(input: string): string {
  // Your logic here
  return `Processed: ${input}`;
}
```

Build:
```bash
npx asc my-spell.ts -o my-spell.wasm --optimize
```

### Rust

```rust
#[no_mangle]
pub extern "C" fn execute(input_ptr: *const u8, input_len: usize) -> *mut u8 {
    // Your logic here
}
```

Build:
```bash
cargo build --target wasm32-unknown-unknown --release
```

### Go (TinyGo)

```go
//export execute
func execute(inputPtr *byte, inputLen int) *byte {
    // Your logic here
}
```

Build:
```bash
tinygo build -o spell.wasm -target wasi spell.go
```

## Resource Limits

Default limits for WASM execution:
- **Memory:** 512MB maximum
- **Execution Time:** 5 minutes (300 seconds) maximum
- **Output Size:** 100MB maximum

These can be configured per spell in the spell settings.

## Best Practices

1. **Keep modules small** - Smaller WASM modules compile and load faster
2. **Validate inputs** - Always validate and sanitize user inputs
3. **Handle errors gracefully** - Return meaningful error messages
4. **Use efficient algorithms** - WASM is fast, but efficiency still matters
5. **Test thoroughly** - Test with various inputs before deploying
6. **Version your modules** - Use semantic versioning for WASM modules
7. **Document functions** - Add comments explaining what each function does

## Performance Tips

1. **Minimize memory allocations** - Pre-allocate buffers when possible
2. **Use integer math** - Integers are faster than floating-point
3. **Avoid string operations** - String manipulation is expensive in WASM
4. **Cache compiled modules** - The platform caches modules automatically
5. **Profile your code** - Use execution metrics to identify bottlenecks

## Security

WASM modules run in a sandboxed environment with:
- No file system access (except /tmp if explicitly allowed)
- No network access (unless explicitly allowed)
- Limited memory (enforced by resource limits)
- Execution timeout (prevents infinite loops)
- Input validation (enforced by the runtime)

## Cost Calculation

WASM execution costs are based on:
- **Time:** $0.001 per second (0.1 cents per second)
- **Memory:** $0.0001 per MB (0.01 cents per MB)
- **Minimum:** 1 cent per execution

Example:
- Execution time: 100ms = 0.1 seconds
- Memory used: 50MB
- Cost: (0.1 * 0.1) + (50 * 0.01) = 0.01 + 0.5 = 0.51 cents → 1 cent (minimum)

## Support

For questions or issues:
- Documentation: `/docs/WASM_RUNTIME.md`
- GitHub Issues: https://github.com/your-org/spell/issues
- Discord: https://discord.gg/spell
