/**
 * Security rules
 *
 * Catch hardcoded secrets, dangerous operations, and SQL injection patterns.
 * These are the rules you absolutely want in CI/CD pipelines.
 */

import type { Rule } from "../../types.js";

export const noHardcodedSecrets: Rule = {
  id: "security/no-hardcoded-secrets",
  name: "No hardcoded secrets",
  message: "Possible hardcoded secret or API key detected",
  severity: "error",
  suggestion: "Use environment variables instead of hardcoding secrets",
  check(code) {
    const matches: Array<{ line?: number; message?: string; suggestion?: string }> = [];
    const lines = code.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Skip comments
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("*")) {
        continue;
      }

      // Detect common secret patterns
      const patterns: Array<{ regex: RegExp; type: string }> = [
        // Generic API key assignment
        { regex: /(?:api_key|apikey|api_secret|secret_key|auth_token)\s*[:=]\s*["'][A-Za-z0-9_\-/.]{16,}["']/i, type: "API key" },
        // AWS keys
        { regex: /(?:AKIA|ASIA)[A-Z0-9]{16}/i, type: "AWS access key" },
        // GitHub tokens
        { regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,}/i, type: "GitHub token" },
        // OpenAI keys
        { regex: /\bsk-[A-Za-z0-9]{20,}/i, type: "OpenAI API key" },
        // Generic password assignment
        { regex: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/i, type: "password" },
        // Bearer tokens
        { regex: /["']Bearer\s+[A-Za-z0-9_\-/.]{20,}["']/i, type: "bearer token" },
        // Private keys
        { regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/i, type: "private key" },
      ];

      for (const { regex, type } of patterns) {
        if (regex.test(line)) {
          matches.push({
            line: lineNum,
            message: `Possible hardcoded ${type} detected`,
            suggestion: `Use environment variables: \`os.environ["KEY"]\` (Python) or \`process.env.KEY\` (JS/TS)`,
          });
          break; // One match per line is enough
        }
      }
    }

    return matches;
  },
};

export const noDangerousOperations: Rule = {
  id: "security/no-dangerous-operations",
  name: "No dangerous operations",
  message: "Potentially dangerous operation that could harm the system",
  severity: "error",
  suggestion: "Review this code carefully before execution",
  check(code, language) {
    const matches: Array<{ line?: number; message?: string; suggestion?: string }> = [];
    const lines = code.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

      // Python dangerous patterns
      if (language === "python") {
        if (/\bos\.system\s*\(/.test(line)) {
          matches.push({ line: lineNum, message: "`os.system()` executes shell commands", suggestion: "Use `subprocess.run()` with explicit arguments instead" });
        }
        if (/\beval\s*\(/.test(line) && !/\bast\.literal_eval\b/.test(line)) {
          matches.push({ line: lineNum, message: "`eval()` executes arbitrary Python code", suggestion: "Use `ast.literal_eval()` for safe evaluation of literals" });
        }
        if (/\bexec\s*\(/.test(line)) {
          matches.push({ line: lineNum, message: "`exec()` executes arbitrary Python code", suggestion: "Avoid `exec()` — refactor to use direct function calls" });
        }
        if (/\bshutil\.rmtree\s*\(/.test(line)) {
          matches.push({ line: lineNum, message: "`shutil.rmtree()` recursively deletes directories", suggestion: "Verify the path is correct and add safety checks" });
        }
      }

      // JavaScript/TypeScript dangerous patterns
      if (language === "javascript" || language === "typescript") {
        if (/\beval\s*\(/.test(line)) {
          matches.push({ line: lineNum, message: "`eval()` executes arbitrary JavaScript code", suggestion: "Use `JSON.parse()` for data or a sandboxed evaluator" });
        }
        if (/\bchild_process\b/.test(line) && /\bexec\s*\(/.test(line)) {
          matches.push({ line: lineNum, message: "`child_process.exec()` runs shell commands", suggestion: "Use `child_process.execFile()` with explicit arguments" });
        }
        if (/\bnew Function\s*\(/.test(line)) {
          matches.push({ line: lineNum, message: "`new Function()` creates functions from strings (like eval)", suggestion: "Define functions directly instead of from strings" });
        }
      }

      // Universal: rm -rf
      if (/rm\s+-rf\s+[/"']/.test(line) || /rm\s+-rf\s+\//.test(line)) {
        matches.push({ line: lineNum, message: "Recursive force delete detected", suggestion: "Verify the target path is correct and not a system directory" });
      }
    }

    return matches;
  },
};

export const noSqlInjection: Rule = {
  id: "security/no-sql-injection",
  name: "No SQL injection",
  message: "Possible SQL injection via string concatenation",
  severity: "warning",
  suggestion: "Use parameterized queries instead of string concatenation",
  pattern: /(?:["'`]\s*\+\s*\w+\s*\+\s*["'`]|f["'].*\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP|WHERE))/i,
};

/** All security rules. */
export const securityRules: Rule[] = [
  noHardcodedSecrets,
  noDangerousOperations,
  noSqlInjection,
];
