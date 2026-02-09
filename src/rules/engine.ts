/**
 * Rule matching engine
 *
 * Runs a set of rules against code and returns any issues found.
 * Rules can use regex patterns, custom check functions, or both.
 */

import type { Rule, Issue, Language } from "../types.js";

/**
 * Run all applicable rules against a piece of code.
 *
 * @param code - The code to check.
 * @param language - The language of the code.
 * @param rules - The rules to apply.
 * @returns Issues found by the rules.
 */
export function runRules(
  code: string,
  language: Language | "unknown",
  rules: Rule[],
): Issue[] {
  const issues: Issue[] = [];

  for (const rule of rules) {
    // Skip rules that don't apply to this language
    if (rule.languages && language !== "unknown" && !rule.languages.includes(language)) {
      continue;
    }

    // Pattern-based matching
    if (rule.pattern) {
      const matches = findPatternMatches(code, rule.pattern);
      for (const match of matches) {
        issues.push({
          source: "rule",
          severity: rule.severity,
          message: rule.message,
          ruleId: rule.id,
          line: match.line,
          suggestion: rule.suggestion,
        });
      }
    }

    // Custom check function
    if (rule.check) {
      const matches = rule.check(code, language);
      for (const match of matches) {
        issues.push({
          source: "rule",
          severity: rule.severity,
          message: match.message ?? rule.message,
          ruleId: rule.id,
          line: match.line,
          suggestion: match.suggestion ?? rule.suggestion,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PatternMatch {
  line: number;
  text: string;
}

/**
 * Find all matches of a pattern in code and return their line numbers.
 */
function findPatternMatches(code: string, pattern: RegExp): PatternMatch[] {
  const matches: PatternMatch[] = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (pattern.test(line)) {
      matches.push({ line: i + 1, text: line.trim() });
    }

    // Reset regex lastIndex for non-global regexes tested per-line
    pattern.lastIndex = 0;
  }

  return matches;
}
