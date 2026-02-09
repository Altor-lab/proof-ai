/**
 * Code quality rules
 *
 * Catch common quality issues in generated code: unbalanced brackets,
 * unused imports, and empty blocks.
 */

import type { Rule, RuleMatch } from "../../types.js";

export const balancedBrackets: Rule = {
  id: "code-quality/balanced-brackets",
  name: "Balanced brackets",
  message: "Unbalanced brackets, parentheses, or braces",
  severity: "error",
  check(code) {
    const matches: RuleMatch[] = [];

    // Strip strings and comments to avoid false positives
    const stripped = stripLiterals(code);

    const pairs: Array<[string, string, string]> = [
      ["(", ")", "parentheses"],
      ["[", "]", "brackets"],
      ["{", "}", "braces"],
    ];

    for (const [open, close, name] of pairs) {
      let count = 0;
      for (const ch of stripped) {
        if (ch === open) count++;
        if (ch === close) count--;
      }

      if (count !== 0) {
        matches.push({
          message: count > 0
            ? `${count} unclosed ${name} — missing \`${close}\``
            : `${Math.abs(count)} extra closing ${name} — unexpected \`${close}\``,
        });
      }
    }

    return matches;
  },
};

export const noUnusedImports: Rule = {
  id: "code-quality/no-unused-imports",
  name: "No unused imports",
  message: "Imported name does not appear to be used in the code",
  severity: "warning",
  check(code, language) {
    const matches: RuleMatch[] = [];

    if (language === "python") {
      const lines = code.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Match: from X import Y, Z
        const fromImport = line.match(/^from\s+\S+\s+import\s+(.+)$/);
        if (fromImport) {
          const names = fromImport[1]
            .split(",")
            .map((n) => n.trim().split(/\s+as\s+/).pop()!.trim())
            .filter((n) => n && !n.startsWith("("));

          for (const name of names) {
            if (!isUsedElsewhere(code, name, i)) {
              matches.push({
                line: i + 1,
                message: `Imported \`${name}\` is not used`,
              });
            }
          }
        }

        // Match: import X
        const simpleImport = line.match(/^import\s+(\w+)(?:\s+as\s+(\w+))?$/);
        if (simpleImport) {
          const name = simpleImport[2] ?? simpleImport[1];
          if (!isUsedElsewhere(code, name, i)) {
            matches.push({
              line: i + 1,
              message: `Imported \`${name}\` is not used`,
            });
          }
        }
      }
    }

    // JS/TS import checking
    if (language === "javascript" || language === "typescript") {
      const lines = code.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Match: import { X, Y } from "..."
        const namedImport = line.match(/import\s+\{([^}]+)\}\s+from/);
        if (namedImport) {
          const names = namedImport[1]
            .split(",")
            .map((n) => n.trim().split(/\s+as\s+/).pop()!.trim())
            .filter(Boolean);

          for (const name of names) {
            if (!isUsedElsewhere(code, name, i)) {
              matches.push({
                line: i + 1,
                message: `Imported \`${name}\` is not used`,
              });
            }
          }
        }

        // Match: import X from "..."
        const defaultImport = line.match(/import\s+(\w+)\s+from/);
        if (defaultImport && !line.includes("{")) {
          const name = defaultImport[1];
          if (name !== "type" && !isUsedElsewhere(code, name, i)) {
            matches.push({
              line: i + 1,
              message: `Imported \`${name}\` is not used`,
            });
          }
        }
      }
    }

    return matches;
  },
};

export const noEmptyBlocks: Rule = {
  id: "code-quality/no-empty-blocks",
  name: "No empty blocks",
  message: "Empty code block that likely needs an implementation",
  severity: "info",
  check(code, language) {
    const matches: RuleMatch[] = [];
    const lines = code.split("\n");

    if (language === "python") {
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();

        // `pass` after a function/class definition
        if (trimmed === "pass" && i > 0) {
          const prevTrimmed = lines[i - 1].trim();
          if (/^(?:def|class)\s/.test(prevTrimmed)) {
            matches.push({
              line: i + 1,
              message: `Empty \`${prevTrimmed.split(/[\s(]/)[0]}\` body — only contains \`pass\``,
              suggestion: "Add implementation or remove if not needed",
            });
          }
        }
      }
    }

    if (language === "javascript" || language === "typescript") {
      // Empty function bodies: { }
      const emptyBody = /\)\s*\{\s*\}/g;
      let match;
      while ((match = emptyBody.exec(code)) !== null) {
        const lineNum = code.slice(0, match.index).split("\n").length;
        matches.push({
          line: lineNum,
          message: "Empty function body",
          suggestion: "Add implementation or a TODO comment",
        });
      }

      // Empty catch blocks: catch (e) { }
      const emptyCatch = /catch\s*\([^)]*\)\s*\{\s*\}/g;
      let catchMatch;
      while ((catchMatch = emptyCatch.exec(code)) !== null) {
        const lineNum = code.slice(0, catchMatch.index).split("\n").length;
        matches.push({
          line: lineNum,
          message: "Empty `catch` block swallows errors silently",
          suggestion: "Log the error or re-throw it",
        });
      }
    }

    return matches;
  },
};

/** All code quality rules. */
export const codeQualityRules: Rule[] = [
  balancedBrackets,
  noUnusedImports,
  noEmptyBlocks,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a name is used anywhere in the code other than the import line.
 */
function isUsedElsewhere(code: string, name: string, importLineIndex: number): boolean {
  const lines = code.split("\n");
  const regex = new RegExp(`\\b${escapeRegex(name)}\\b`);

  for (let i = 0; i < lines.length; i++) {
    if (i === importLineIndex) continue;
    if (regex.test(lines[i])) return true;
  }

  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip string literals to avoid false positives in bracket counting.
 */
function stripLiterals(code: string): string {
  // Remove string literals (single, double, template)
  return code
    .replace(/"""[\s\S]*?"""/g, "")     // Python triple-double
    .replace(/'''[\s\S]*?'''/g, "")     // Python triple-single
    .replace(/`[\s\S]*?`/g, "")         // JS template literals
    .replace(/"(?:[^"\\]|\\.)*"/g, "")  // Double-quoted strings
    .replace(/'(?:[^'\\]|\\.)*'/g, "")  // Single-quoted strings
    .replace(/#.*/g, "")               // Python comments
    .replace(/\/\/.*/g, "")            // JS single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, ""); // JS block comments
}
