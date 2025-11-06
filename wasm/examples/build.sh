#!/bin/bash

# Build script for WASM examples
# This script compiles all AssemblyScript examples to WASM

set -e

echo "Building WASM examples..."

# Create output directory if it doesn't exist
mkdir -p wasm/examples/build

# Build hello-world example
echo "Building hello-world.wasm..."
npx asc wasm/examples/hello-world.ts \
  -o wasm/examples/build/hello-world.wasm \
  --optimize \
  --exportRuntime \
  --runtime stub

# Build json-transform example
echo "Building json-transform.wasm..."
npx asc wasm/examples/json-transform.ts \
  -o wasm/examples/build/json-transform.wasm \
  --optimize \
  --exportRuntime \
  --runtime stub

# Convert WAT to WASM (if wat2wasm is available)
if command -v wat2wasm &> /dev/null; then
  echo "Building hello-world-wat.wasm from WAT..."
  wat2wasm wasm/examples/hello-world.wat \
    -o wasm/examples/build/hello-world-wat.wasm
else
  echo "wat2wasm not found, skipping WAT compilation"
  echo "Install wabt package to compile WAT files"
fi

echo "✓ Build complete!"
echo ""
echo "Built files:"
ls -lh wasm/examples/build/
echo ""
echo "To upload a WASM module:"
echo "  curl -X POST https://spell.run/api/spells/upload-wasm \\"
echo "    -H \"Authorization: Bearer YOUR_TOKEN\" \\"
echo "    -F \"spellId=YOUR_SPELL_ID\" \\"
echo "    -F \"version=1.0.0\" \\"
echo "    -F \"wasmFile=@wasm/examples/build/hello-world.wasm\""
