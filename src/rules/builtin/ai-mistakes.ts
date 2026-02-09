/**
 * AI mistake rules
 *
 * Catch common mistakes that LLMs make when generating code.
 * These are patterns that work fine in training data but break
 * in production: placeholder values, incomplete snippets,
 * hallucinated imports, and mixed-language syntax.
 */

import type { Rule, RuleMatch } from "../../types.js";

export const noPlaceholderValues: Rule = {
  id: "ai-mistakes/no-placeholder-values",
  name: "No placeholder values",
  message: "Placeholder value that should be replaced with a real value",
  severity: "error",
  suggestion: "Replace placeholder with actual value or use an environment variable",
  check(code) {
    const matches: RuleMatch[] = [];
    const lines = code.split("\n");

    const patterns: Array<{ regex: RegExp; description: string }> = [
      { regex: /YOUR_API_KEY/i, description: "YOUR_API_KEY placeholder" },
      { regex: /YOUR[_-]?TOKEN/i, description: "YOUR_TOKEN placeholder" },
      { regex: /YOUR[_-]?SECRET/i, description: "YOUR_SECRET placeholder" },
      { regex: /<your[_-][^>]+>/i, description: "Template placeholder (e.g., <your-api-key>)" },
      { regex: /REPLACE[_-]?ME/i, description: "REPLACE_ME placeholder" },
      { regex: /INSERT[_-].*[_-]HERE/i, description: "INSERT_*_HERE placeholder" },
      { regex: /xxx+/i, description: "xxx placeholder" },
      { regex: /\bTODO\b/, description: "TODO marker" },
      { regex: /\bFIXME\b/, description: "FIXME marker" },
      { regex: /your[_-].*[_-]here/i, description: "your-*-here placeholder" },
      { regex: /example\.com(?!\/)/i, description: "example.com placeholder URL" },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comments — placeholders in comments are fine
      if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("*")) {
        continue;
      }

      for (const { regex, description } of patterns) {
        if (regex.test(line)) {
          matches.push({
            line: i + 1,
            message: `Placeholder value found: ${description}`,
          });
          break; // One match per line
        }
      }
    }

    return matches;
  },
};

export const noIncompleteCode: Rule = {
  id: "ai-mistakes/no-incomplete-code",
  name: "No incomplete code",
  message: "Code appears to be truncated or incomplete",
  severity: "warning",
  suggestion: "Ensure the code is complete and includes all necessary logic",
  check(code) {
    const matches: RuleMatch[] = [];
    const lines = code.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // "# rest of code" or "# ... more code" patterns
      if (/^#\s*(?:rest of|remaining|more|continue|your|add)\s/i.test(trimmed)) {
        matches.push({
          line: i + 1,
          message: `Incomplete code marker: "${trimmed}"`,
        });
      }

      // "// ... (rest of implementation)" patterns
      if (/^\/\/\s*(?:\.{3}|rest of|remaining|more|continue)/i.test(trimmed)) {
        matches.push({
          line: i + 1,
          message: `Incomplete code marker: "${trimmed}"`,
        });
      }

      // Standalone "..." on a line (not inside a string or spread operator)
      if (/^\.\.\.\s*$/.test(trimmed) && i > 0 && !lines[i - 1].trim().endsWith(",")) {
        matches.push({
          line: i + 1,
          message: "Standalone `...` suggests truncated code",
        });
      }

      // "pass" as the only statement in a function/class (Python)
      if (trimmed === "pass" && i > 0) {
        const prevLine = lines[i - 1].trim();
        if (/^(?:def|class|if|for|while|try|except)\b/.test(prevLine)) {
          matches.push({
            line: i + 1,
            message: "Empty block with only `pass` — likely a placeholder",
            suggestion: "Implement the function body or remove it if not needed",
          });
        }
      }
    }

    return matches;
  },
};

export const noMixedSyntax: Rule = {
  id: "ai-mistakes/no-mixed-syntax",
  name: "No mixed language syntax",
  message: "Code contains syntax from a different programming language",
  severity: "warning",
  suggestion: "Verify the code matches the specified language",
  check(code, language) {
    const matches: RuleMatch[] = [];
    const lines = code.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

      // Python-in-JavaScript: `def `, `elif `, `print(` without import
      if ((language === "javascript" || language === "typescript")) {
        if (/^def\s+\w+\s*\(/.test(trimmed)) {
          matches.push({ line: i + 1, message: "Python `def` syntax in JavaScript/TypeScript file" });
        }
        if (/^elif\s/.test(trimmed)) {
          matches.push({ line: i + 1, message: "Python `elif` in JavaScript/TypeScript — use `else if`" });
        }
        if (/\bself\.\w+/.test(trimmed) && !/['"`].*self\./.test(trimmed)) {
          matches.push({ line: i + 1, message: "Python `self.` reference in JavaScript/TypeScript — use `this.`" });
        }
      }

      // JavaScript-in-Python: `const `, `let `, `=>`, `console.log`
      if (language === "python") {
        if (/^(?:const|let|var)\s+/.test(trimmed)) {
          matches.push({ line: i + 1, message: "JavaScript variable declaration in Python file" });
        }
        if (/=>\s*\{/.test(trimmed)) {
          matches.push({ line: i + 1, message: "JavaScript arrow function `=>` in Python file" });
        }
        if (/\bconsole\.log\s*\(/.test(trimmed)) {
          matches.push({ line: i + 1, message: "`console.log()` is JavaScript — use `print()` in Python" });
        }
      }
    }

    return matches;
  },
};

export const noHallucinatedImports: Rule = {
  id: "ai-mistakes/no-hallucinated-imports",
  name: "No hallucinated imports",
  message: "Import appears to reference a non-existent or commonly hallucinated package",
  severity: "warning",
  suggestion: "Verify this package exists on PyPI or npm",
  check(code, language) {
    const matches: RuleMatch[] = [];
    const lines = code.split("\n");

    // Commonly hallucinated Python packages
    const fakePythonPackages = new Set([
      "langchain_magic",
      "openai_helpers",
      "transformers_utils",
      "pytorch_lightning_utils",
      "sklearn_helpers",
      "tensorflow_utils",
      "auto_ml",
      "ai_utils",
      "ml_helpers",
      "data_utils",
      "api_wrapper",
    ]);

    // Commonly hallucinated npm packages
    const fakeNodePackages = new Set([
      "openai-helpers",
      "react-ai-utils",
      "next-auth-helpers",
      "express-utils",
      "api-helper",
      "ai-sdk-utils",
    ]);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (language === "python") {
        const importMatch = line.match(/^\s*(?:from|import)\s+([\w.]+)/);
        if (importMatch) {
          const pkg = importMatch[1].split(".")[0];
          if (fakePythonPackages.has(pkg)) {
            matches.push({
              line: i + 1,
              message: `Possibly hallucinated package: \`${pkg}\``,
              suggestion: `Verify this package exists on PyPI: https://pypi.org/project/${pkg}/`,
            });
          }
        }
      }

      if (language === "javascript" || language === "typescript") {
        const requireMatch = line.match(/(?:require|from)\s*\(?\s*["']([^"']+)["']/);
        if (requireMatch) {
          const pkg = requireMatch[1].startsWith("@")
            ? requireMatch[1].split("/").slice(0, 2).join("/")
            : requireMatch[1].split("/")[0];

          if (fakeNodePackages.has(pkg)) {
            matches.push({
              line: i + 1,
              message: `Possibly hallucinated package: \`${pkg}\``,
              suggestion: `Verify this package exists on npm: https://www.npmjs.com/package/${pkg}`,
            });
          }
        }
      }
    }

    return matches;
  },
};

/** All AI-mistake rules. */
export const aiMistakeRules: Rule[] = [
  noPlaceholderValues,
  noIncompleteCode,
  noMixedSyntax,
  noHallucinatedImports,
];
