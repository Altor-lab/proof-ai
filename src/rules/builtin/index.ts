/**
 * Built-in rule sets
 *
 * Proof ships with 10 rules across 3 categories:
 *
 * - **security** (3 rules): Hardcoded secrets, dangerous operations, SQL injection
 * - **ai-mistakes** (4 rules): Placeholders, incomplete code, mixed syntax, hallucinated imports
 * - **code-quality** (3 rules): Balanced brackets, unused imports, empty blocks
 */

import type { Rule } from "../../types.js";
import { securityRules } from "./security.js";
import { aiMistakeRules } from "./ai-mistakes.js";
import { codeQualityRules } from "./code-quality.js";

export { securityRules } from "./security.js";
export { aiMistakeRules } from "./ai-mistakes.js";
export { codeQualityRules } from "./code-quality.js";

/** All built-in rules combined. */
export const allBuiltinRules: Rule[] = [
  ...securityRules,
  ...aiMistakeRules,
  ...codeQualityRules,
];

/**
 * Resolve a rule set name to an array of rules.
 */
export function resolveRuleSet(name: "all" | "security" | "ai-mistakes" | "code-quality"): Rule[] {
  switch (name) {
    case "all":
      return allBuiltinRules;
    case "security":
      return securityRules;
    case "ai-mistakes":
      return aiMistakeRules;
    case "code-quality":
      return codeQualityRules;
  }
}
