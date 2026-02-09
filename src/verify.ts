/**
 * Main verification pipeline
 *
 * This is the core of Proof. It orchestrates:
 * 1. Input parsing — code, text (with code block extraction), or file
 * 2. Syntax checks — fast, offline, no dependencies
 * 3. Rule matching — pattern-based and custom checks
 * 4. Sandbox execution — run code in Docker (or E2B) to catch runtime errors
 *
 * Each step is independent and can be skipped via options.
 */

import { readFile } from "node:fs/promises";
import { extractCodeBlocks, languageFromPath } from "./extract.js";
import { checkSyntax } from "./syntax.js";
import { runRules } from "./rules/engine.js";
import { allBuiltinRules, resolveRuleSet } from "./rules/builtin/index.js";
import { detectSandbox } from "./sandbox/index.js";
import type { SandboxProvider } from "./sandbox/types.js";
import type {
  CodeBlock,
  CodeBlockResult,
  ExecutableLanguage,
  Issue,
  Rule,
  VerifyOptions,
  VerifyResult,
  Language,
} from "./types.js";
import { resolveLanguage } from "./types.js";

// Languages that can be executed in a sandbox
const EXECUTABLE_LANGUAGES = new Set<string>(["python", "javascript", "typescript"]);

/**
 * Verify AI-generated code for correctness, security, and quality.
 *
 * @example
 * ```ts
 * import { verify } from "proof-ai";
 *
 * // Verify a code string
 * const result = await verify({
 *   code: 'import pandas as pd\ndf = pd.read_csv("data.csv")',
 *   language: "python",
 * });
 *
 * if (!result.passed) {
 *   console.log("Issues found:", result.issues);
 * }
 * ```
 *
 * @example
 * ```ts
 * // Verify all code blocks in a markdown string (e.g., LLM response)
 * const result = await verify({
 *   text: llmResponse,
 *   sandbox: true,
 * });
 * ```
 *
 * @example
 * ```ts
 * // Verify a file
 * const result = await verify({
 *   file: "./generated.py",
 * });
 * ```
 */
export async function verify(options: VerifyOptions): Promise<VerifyResult> {
  const start = Date.now();

  // Step 0: Parse input into code blocks
  const blocks = await resolveInput(options);

  if (blocks.length === 0) {
    return emptyResult(start);
  }

  // Step 1: Resolve rules
  const rules = resolveRules(options.rules);

  // Step 2: Detect sandbox (if requested)
  const sandboxPreference = resolveSandboxPreference(options.sandbox);
  let sandbox: SandboxProvider | null = null;

  if (sandboxPreference !== false) {
    try {
      sandbox = await detectSandbox(
        sandboxPreference === true ? undefined : sandboxPreference,
      );
    } catch {
      // If sandbox detection fails, continue without it
    }
  }

  try {
    // Step 3: Verify each block
    const blockResults = await Promise.all(
      blocks.map((block) => verifyBlock(block, rules, sandbox, options)),
    );

    // Step 4: Aggregate results
    return aggregateResults(blockResults, rules.length, sandbox, start);
  } finally {
    // Always clean up sandbox resources
    if (sandbox) {
      await sandbox.cleanup().catch(() => {});
    }
  }
}

// ---------------------------------------------------------------------------
// Input resolution
// ---------------------------------------------------------------------------

async function resolveInput(options: VerifyOptions): Promise<CodeBlock[]> {
  const { code, text, file, language } = options;

  // Validate: exactly one of code/text/file must be provided
  const inputCount = [code, text, file].filter((x) => x !== undefined).length;
  if (inputCount === 0) {
    throw new Error("One of `code`, `text`, or `file` must be provided");
  }
  if (inputCount > 1) {
    throw new Error("Only one of `code`, `text`, or `file` can be provided");
  }

  // Direct code string
  if (code !== undefined) {
    const resolvedLang = language ? resolveLanguage(language) ?? "unknown" : "unknown";
    return [
      {
        language: resolvedLang,
        code,
      },
    ];
  }

  // Text with embedded code blocks
  if (text !== undefined) {
    const blocks = extractCodeBlocks(text);

    // If no fenced blocks found, treat the entire text as code
    if (blocks.length === 0 && text.trim().length > 0) {
      const resolvedLang = language ? resolveLanguage(language) ?? "unknown" : "unknown";
      return [{ language: resolvedLang, code: text }];
    }

    return blocks;
  }

  // File
  if (file !== undefined) {
    const content = await readFile(file, "utf-8");
    const detectedLang = languageFromPath(file);
    const resolvedLang = language
      ? resolveLanguage(language) ?? detectedLang ?? "unknown"
      : detectedLang ?? "unknown";

    return [
      {
        language: resolvedLang,
        code: content,
      },
    ];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Rule resolution
// ---------------------------------------------------------------------------

function resolveRules(
  rulesOption: VerifyOptions["rules"],
): Rule[] {
  if (rulesOption === false) return [];
  if (rulesOption === undefined || rulesOption === "all") return allBuiltinRules;
  if (typeof rulesOption === "string") return resolveRuleSet(rulesOption);
  return rulesOption; // Custom rule array
}

// ---------------------------------------------------------------------------
// Sandbox preference resolution
// ---------------------------------------------------------------------------

function resolveSandboxPreference(
  sandbox: VerifyOptions["sandbox"],
): boolean | "docker" | "e2b" {
  if (sandbox === undefined) return true; // Default: auto-detect
  return sandbox;
}

// ---------------------------------------------------------------------------
// Per-block verification
// ---------------------------------------------------------------------------

async function verifyBlock(
  block: CodeBlock,
  rules: Rule[],
  sandbox: SandboxProvider | null,
  options: VerifyOptions,
): Promise<CodeBlockResult> {
  const issues: Issue[] = [];

  // 1. Syntax check (fast, always runs)
  const syntaxIssues = checkSyntax(block.code, block.language);
  issues.push(...syntaxIssues);

  // 2. Rule matching (fast, always runs)
  const ruleIssues = runRules(block.code, block.language, rules);
  issues.push(...ruleIssues);

  // 3. Sandbox execution (slower, only if sandbox is available and language is executable)
  let execution;
  if (sandbox && block.language !== "unknown" && EXECUTABLE_LANGUAGES.has(block.language)) {
    const executableLang = block.language as ExecutableLanguage;
    execution = await sandbox.run({
      code: block.code,
      language: executableLang,
      install: options.install,
      env: options.env,
      timeout: options.timeout,
    });

    if (!execution.success) {
      issues.push({
        source: "execution",
        severity: "error",
        message: execution.error ?? "Code execution failed",
      });

      // If stderr has useful info, include it
      if (execution.stderr && execution.stderr !== execution.error) {
        // Extract the most relevant error line
        const errorLine = extractErrorLine(execution.stderr, block.language);
        if (errorLine) {
          issues.push({
            source: "execution",
            severity: "info",
            message: errorLine,
          });
        }
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    block,
    passed: !hasErrors,
    issues,
    execution,
  };
}

/**
 * Extract the most relevant error line from stderr output.
 */
function extractErrorLine(stderr: string, language: Language | "unknown"): string | null {
  const lines = stderr.split("\n").filter((l) => l.trim());

  if (language === "python") {
    // Python: look for the line starting with the error type (e.g., "ModuleNotFoundError:")
    const errorLine = lines.find((l) => /^[A-Z]\w*Error:/.test(l.trim()));
    if (errorLine) return errorLine.trim();
  }

  if (language === "javascript" || language === "typescript") {
    // Node: look for lines with "Error:" or the first stack-free line
    const errorLine = lines.find((l) => /Error:/.test(l) && !l.trim().startsWith("at "));
    if (errorLine) return errorLine.trim();
  }

  // Fallback: return the last non-empty line
  return lines[lines.length - 1]?.trim() ?? null;
}

// ---------------------------------------------------------------------------
// Result aggregation
// ---------------------------------------------------------------------------

function aggregateResults(
  blocks: CodeBlockResult[],
  rulesChecked: number,
  sandbox: SandboxProvider | null,
  startTime: number,
): VerifyResult {
  const allIssues = blocks.flatMap((b) => b.issues);
  const passedBlocks = blocks.filter((b) => b.passed).length;
  const failedBlocks = blocks.length - passedBlocks;

  return {
    passed: failedBlocks === 0,
    issues: allIssues,
    blocks,
    stats: {
      totalBlocks: blocks.length,
      passedBlocks,
      failedBlocks,
      rulesChecked,
      durationMs: Date.now() - startTime,
      sandboxProvider: sandbox
        ? (sandbox.name as "docker" | "e2b")
        : null,
    },
  };
}

function emptyResult(startTime: number): VerifyResult {
  return {
    passed: true,
    issues: [],
    blocks: [],
    stats: {
      totalBlocks: 0,
      passedBlocks: 0,
      failedBlocks: 0,
      rulesChecked: 0,
      durationMs: Date.now() - startTime,
      sandboxProvider: null,
    },
  };
}
