/**
 * Rule definition helper
 *
 * Provides a type-safe way to define custom verification rules.
 */

import type { Rule } from "../types.js";

/**
 * Define a custom verification rule.
 *
 * @example
 * ```ts
 * const noEval = defineRule({
 *   id: "custom/no-eval",
 *   name: "No eval()",
 *   languages: ["python"],
 *   pattern: /\beval\s*\(/,
 *   message: "eval() is dangerous and can execute arbitrary code",
 *   severity: "error",
 *   suggestion: "Use ast.literal_eval() for safe parsing",
 * });
 * ```
 */
export function defineRule(rule: Rule): Rule {
  // Validate required fields
  if (!rule.id) throw new Error("Rule must have an id");
  if (!rule.name) throw new Error("Rule must have a name");
  if (!rule.message) throw new Error("Rule must have a message");
  if (!rule.severity) throw new Error("Rule must have a severity");
  if (!rule.pattern && !rule.check) {
    throw new Error("Rule must have either a pattern or a check function");
  }

  return Object.freeze(rule);
}
