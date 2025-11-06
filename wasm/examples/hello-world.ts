/**
 * Hello World WASM Spell (AssemblyScript)
 *
 * This is a simple example that demonstrates:
 * - Reading string input
 * - Processing text
 * - Returning string output
 */

/**
 * Main execution function
 * Takes a string input and returns a greeting
 */
export function execute(input: string): string {
  // Parse input as JSON if it looks like JSON
  let name = "World";

  if (input.startsWith("{") || input.startsWith("[")) {
    try {
      // Simple JSON parsing for { "name": "value" }
      const nameMatch = input.match(/"name"\s*:\s*"([^"]+)"/);
      if (nameMatch && nameMatch.length > 1) {
        name = nameMatch[1];
      }
    } catch (e) {
      // If JSON parsing fails, use the input as-is
      name = input || "World";
    }
  } else if (input.length > 0) {
    name = input;
  }

  return `Hello, ${name}! Welcome to WASM-powered spells.`;
}

/**
 * Alternative entry point for simple number processing
 */
export function add(a: i32, b: i32): i32 {
  return a + b;
}

/**
 * Text transformation example
 */
export function uppercase(text: string): string {
  return text.toUpperCase();
}

/**
 * Text transformation example
 */
export function lowercase(text: string): string {
  return text.toLowerCase();
}

/**
 * Word count example
 */
export function wordCount(text: string): i32 {
  if (text.length === 0) return 0;

  let count = 0;
  let inWord = false;

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (char === " " || char === "\n" || char === "\t") {
      inWord = false;
    } else if (!inWord) {
      inWord = true;
      count++;
    }
  }

  return count;
}
