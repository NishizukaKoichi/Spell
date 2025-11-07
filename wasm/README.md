# WASM Spells Directory

This directory contains compiled WebAssembly modules for Spell execution.

## Structure

Each spell should be compiled to a `.wasm` file with the following naming convention:

```
{spell-key}.wasm
```

## Required Exports

Each WASM module must export:

- `memory`: WebAssembly.Memory instance
- `run(inputPtr: i32, inputLen: i32) -> i32`: Main execution function
- `alloc(size: i32) -> i32`: Memory allocation
- `dealloc(ptr: i32, size: i32)`: Memory deallocation
- `result_ptr() -> i32`: Pointer to result data
- `result_len() -> i32`: Length of result data

## Example Spells

To create a sample spell, you can compile from:

- Rust (using wasm32-unknown-unknown target)
- AssemblyScript
- C/C++ (using Emscripten or wasm-clang)

## Sample Spell

A minimal "hello world" spell example in Rust:

```rust
#[no_mangle]
pub extern "C" fn alloc(size: usize) -> *mut u8 {
    // Memory allocation logic
}

#[no_mangle]
pub extern "C" fn dealloc(ptr: *mut u8, size: usize) {
    // Memory deallocation logic
}

#[no_mangle]
pub extern "C" fn run(input_ptr: *const u8, input_len: usize) -> usize {
    // Process input and return result pointer
}

#[no_mangle]
pub extern "C" fn result_ptr() -> *const u8 {
    // Return pointer to result
}

#[no_mangle]
pub extern "C" fn result_len() -> usize {
    // Return length of result
}
```

## Deployment

1. Compile your spell to WASM
2. Place the `.wasm` file in this directory
3. Register the spell via API with the same key name
4. The runtime will automatically load and execute the WASM module
