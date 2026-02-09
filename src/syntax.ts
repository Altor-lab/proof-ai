/**
 * Local syntax validation
 *
 * Fast, offline syntax checks that run without Docker or any sandbox.
 * These are heuristic-based — they catch common problems but are not
 * a replacement for real execution. Think of them as a quick pre-flight
 * check that works everywhere.
 */

import type { Issue, Language } from "./types.js";

/**
 * Run basic syntax checks on code.
 *
 * This is intentionally conservative: it only flags things it's confident
 * about. False positives would erode trust, so when in doubt, it stays quiet.
 *
 * @returns An array of issues found. Empty array means no problems detected.
 */
export function checkSyntax(
  code: string,
  language: Language | "unknown",
): Issue[] {
  switch (language) {
    case "python":
      return checkPython(code);
    case "javascript":
    case "typescript":
      return checkJavaScriptOrTypeScript(code);
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Python
// ---------------------------------------------------------------------------

function checkPython(code: string): Issue[] {
  const issues: Issue[] = [];
  const lines = code.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNum = i + 1;

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Missing colon after block statement
    if (
      /^(if|elif|else|for|while|def|class|try|except|finally|with|async\s+(?:def|for|with))\b/.test(
        trimmed,
      )
    ) {
      // Only flag if the line doesn't end with : or \ (line continuation)
      // and doesn't contain a colon anywhere (could be one-liner like `if x: y`)
      if (!trimmed.endsWith(":") && !trimmed.endsWith("\\") && !trimmed.includes(":")) {
        issues.push({
          source: "syntax",
          severity: "error",
          message: `Missing colon after \`${trimmed.split(/\s/)[0]}\` statement`,
          line: lineNum,
          suggestion: `Add a colon at the end: \`${trimmed}:\``,
        });
      }
    }
  }

  // Check bracket balance
  issues.push(...checkBracketBalance(code, "python"));

  return issues;
}

// ---------------------------------------------------------------------------
// JavaScript / TypeScript
// ---------------------------------------------------------------------------

function checkJavaScriptOrTypeScript(code: string): Issue[] {
  const issues: Issue[] = [];

  // Check bracket balance
  issues.push(...checkBracketBalance(code, "javascript"));

  return issues;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Check that brackets, parentheses, and braces are balanced.
 *
 * Skips characters inside string literals and comments to avoid
 * false positives. This is a best-effort heuristic, not a parser.
 */
function checkBracketBalance(code: string, language: string): Issue[] {
  const issues: Issue[] = [];

  // Strip string literals and comments to avoid false positives
  const stripped = stripStringsAndComments(code, language);

  const pairs: Array<[string, string, string]> = [
    ["(", ")", "parentheses"],
    ["[", "]", "brackets"],
    ["{", "}", "braces"],
  ];

  for (const [open, close, name] of pairs) {
    const openCount = countChar(stripped, open);
    const closeCount = countChar(stripped, close);

    if (openCount !== closeCount) {
      issues.push({
        source: "syntax",
        severity: "error",
        message: `Unbalanced ${name}: ${openCount} opening \`${open}\` vs ${closeCount} closing \`${close}\``,
        suggestion: openCount > closeCount
          ? `Add ${openCount - closeCount} closing \`${close}\``
          : `Remove ${closeCount - openCount} extra closing \`${close}\` or add opening \`${open}\``,
      });
    }
  }

  return issues;
}

/**
 * Remove string literals and comments from code so bracket counting
 * doesn't get confused by brackets inside strings.
 */
function stripStringsAndComments(code: string, language: string): string {
  let result = "";
  let i = 0;

  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];

    // Python / JS single-line comments
    if (
      (ch === "#" && language === "python") ||
      (ch === "/" && next === "/" && language !== "python")
    ) {
      // Skip to end of line
      while (i < code.length && code[i] !== "\n") i++;
      continue;
    }

    // JS block comments
    if (ch === "/" && next === "*" && language !== "python") {
      i += 2;
      while (i < code.length - 1 && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    // Python triple-quoted strings
    if (language === "python" && (code.slice(i, i + 3) === '"""' || code.slice(i, i + 3) === "'''")) {
      const quote = code.slice(i, i + 3);
      i += 3;
      while (i < code.length - 2 && code.slice(i, i + 3) !== quote) i++;
      i += 3;
      continue;
    }

    // String literals (single or double quote)
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === "\\") i++; // Skip escaped characters
        i++;
      }
      i++; // Skip closing quote
      continue;
    }

    // Template literals (JS/TS)
    if (ch === "`" && language !== "python") {
      i++;
      while (i < code.length && code[i] !== "`") {
        if (code[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

function countChar(str: string, char: string): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char) count++;
  }
  return count;
}
