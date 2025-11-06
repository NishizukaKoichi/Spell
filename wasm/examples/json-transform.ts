/**
 * JSON Transform WASM Spell (AssemblyScript)
 *
 * This example demonstrates:
 * - JSON data transformation
 * - String manipulation
 * - Data validation
 */

/**
 * Simple JSON parser for basic objects
 * Note: AssemblyScript doesn't have built-in JSON support,
 * so we implement basic parsing
 */
class SimpleJSON {
  /**
   * Extract a string value from JSON
   */
  static getString(json: string, key: string): string {
    const pattern = `"${key}"\\s*:\\s*"([^"]*)"`;
    const regex = new RegExp(pattern);
    const match = json.match(regex);
    return match && match.length > 1 ? match[1] : "";
  }

  /**
   * Extract a number value from JSON
   */
  static getNumber(json: string, key: string): f64 {
    const pattern = `"${key}"\\s*:\\s*([0-9.]+)`;
    const regex = new RegExp(pattern);
    const match = json.match(regex);
    return match && match.length > 1 ? parseFloat(match[1]) : 0;
  }

  /**
   * Create a JSON string from key-value pairs
   */
  static create(pairs: Map<string, string>): string {
    let result = "{";
    const keys = pairs.keys();
    let first = true;

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = pairs.get(key);

      if (!first) result += ",";
      result += `"${key}":"${value}"`;
      first = false;
    }

    result += "}";
    return result;
  }
}

/**
 * Main execution function
 * Transforms JSON data by applying various transformations
 */
export function execute(input: string): string {
  // Parse input JSON
  const name = SimpleJSON.getString(input, "name");
  const email = SimpleJSON.getString(input, "email");
  const age = SimpleJSON.getNumber(input, "age");

  // Transform data
  const result = new Map<string, string>();

  // Transform name to uppercase
  if (name.length > 0) {
    result.set("name_uppercase", name.toUpperCase());
    result.set("name_lowercase", name.toLowerCase());
    result.set("name_length", name.length.toString());
  }

  // Validate and transform email
  if (email.length > 0) {
    const emailValid = email.includes("@") && email.includes(".");
    result.set("email", email);
    result.set("email_valid", emailValid ? "true" : "false");

    // Extract domain
    const atIndex = email.indexOf("@");
    if (atIndex >= 0) {
      const domain = email.substring(atIndex + 1);
      result.set("email_domain", domain);
    }
  }

  // Transform age
  if (age > 0) {
    result.set("age", age.toString());
    result.set("is_adult", age >= 18 ? "true" : "false");
    result.set("birth_year_approx", (2024 - age).toString());
  }

  // Return transformed JSON
  return SimpleJSON.create(result);
}

/**
 * Filter JSON array (simplified)
 */
export function filterByAge(jsonArray: string, minAge: i32): string {
  // This is a simplified example
  // In production, you'd use a proper JSON library
  return `{"filtered":true,"minAge":${minAge}}`;
}

/**
 * Merge two JSON objects (simplified)
 */
export function merge(json1: string, json2: string): string {
  // Simplified merge - just concatenate
  return json1 + json2;
}

/**
 * Validate JSON structure
 */
export function validate(json: string): string {
  const hasOpenBrace = json.includes("{");
  const hasCloseBrace = json.includes("}");
  const valid = hasOpenBrace && hasCloseBrace;

  return `{"valid":${valid ? "true" : "false"}}`;
}
