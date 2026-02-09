/**
 * Core types for Proof AI
 *
 * These types define the public API surface. Every type here
 * is exported and may be used by consumers of the library.
 */

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

/** Programming languages that Proof can verify. */
export type Language = "python" | "javascript" | "typescript" | "go" | "rust";

/** Languages that can be executed in a sandbox today. */
export type ExecutableLanguage = "python" | "javascript" | "typescript";

/** Map of language aliases to canonical names. */
export const LANGUAGE_ALIASES: Record<string, Language> = {
  py: "python",
  python: "python",
  python3: "python",
  js: "javascript",
  javascript: "javascript",
  node: "javascript",
  ts: "typescript",
  typescript: "typescript",
  go: "go",
  golang: "go",
  rust: "rust",
  rs: "rust",
};

/**
 * Resolve a language string (possibly an alias) to a canonical Language.
 * Returns `undefined` for unrecognized languages.
 */
export function resolveLanguage(lang: string): Language | undefined {
  return LANGUAGE_ALIASES[lang.toLowerCase().trim()];
}

// ---------------------------------------------------------------------------
// Code blocks
// ---------------------------------------------------------------------------

/** A code block extracted from text or a file. */
export interface CodeBlock {
  /** Canonical language identifier. */
  language: Language | "unknown";

  /** The raw source code. */
  code: string;

  /** 1-based line number where the block starts in the source text. */
  startLine?: number;

  /** 1-based line number where the block ends in the source text. */
  endLine?: number;
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

/** How severe an issue is. */
export type Severity = "error" | "warning" | "info";

/** Where an issue came from. */
export type IssueSource =
  | "execution"   // Code failed to run in sandbox
  | "syntax"      // Local syntax check found a problem
  | "rule"        // A verification rule matched
  | "timeout";    // Sandbox execution timed out

/** A single issue found during verification. */
export interface Issue {
  /** Machine-readable issue source. */
  source: IssueSource;

  /** Severity level. */
  severity: Severity;

  /** Human-readable description of the problem. */
  message: string;

  /** The rule ID that triggered this issue (if source is "rule"). */
  ruleId?: string;

  /** 1-based line number in the code block (if known). */
  line?: number;

  /** Suggested fix or alternative. */
  suggestion?: string;
}

// ---------------------------------------------------------------------------
// Execution results
// ---------------------------------------------------------------------------

/** Result of running code in a sandbox. */
export interface ExecutionResult {
  /** Whether the code ran without errors. */
  success: boolean;

  /** Standard output from execution. */
  stdout: string;

  /** Standard error from execution. */
  stderr: string;

  /** Error message if execution failed. */
  error?: string;

  /** Exit code from the process (0 = success). */
  exitCode: number;

  /** Wall-clock execution time in milliseconds. */
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Verification results
// ---------------------------------------------------------------------------

/** Result of verifying a single code block. */
export interface CodeBlockResult {
  /** The code block that was verified. */
  block: CodeBlock;

  /** Whether this block passed all checks. */
  passed: boolean;

  /** Issues found in this block. */
  issues: Issue[];

  /** Execution result (only if sandbox was used). */
  execution?: ExecutionResult;
}

/** The complete result of a `verify()` call. */
export interface VerifyResult {
  /** Whether all code blocks passed verification. */
  passed: boolean;

  /** All issues found across all code blocks (flat list). */
  issues: Issue[];

  /** Per-code-block results (populated when verifying text with multiple blocks). */
  blocks: CodeBlockResult[];

  /** Summary statistics. */
  stats: {
    /** Total code blocks found and checked. */
    totalBlocks: number;

    /** Blocks that passed all checks. */
    passedBlocks: number;

    /** Blocks that had at least one error. */
    failedBlocks: number;

    /** Total rules checked. */
    rulesChecked: number;

    /** Total wall-clock time in milliseconds. */
    durationMs: number;

    /** Which sandbox provider was used, or `null` if none. */
    sandboxProvider: "docker" | "e2b" | null;
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Options for the `verify()` function. */
export interface VerifyOptions {
  /**
   * The code to verify. Mutually exclusive with `text` and `file`.
   */
  code?: string;

  /**
   * Markdown or plain text containing fenced code blocks.
   * All code blocks will be extracted and verified.
   * Mutually exclusive with `code` and `file`.
   */
  text?: string;

  /**
   * Path to a file to verify. The language is inferred from extension.
   * Mutually exclusive with `code` and `text`.
   */
  file?: string;

  /**
   * Language of the code. Required when using `code`, optional for `text`
   * (inferred from fence markers) and `file` (inferred from extension).
   */
  language?: string;

  /**
   * Whether to run code in a sandbox.
   *
   * - `true` — run in sandbox (auto-detect Docker or E2B)
   * - `false` — skip sandbox, only run rules + syntax checks
   * - `"docker"` — force Docker sandbox
   * - `"e2b"` — force E2B cloud sandbox
   *
   * @default true (auto-detect)
   */
  sandbox?: boolean | "docker" | "e2b";

  /**
   * Which rules to apply.
   *
   * - `"all"` — all built-in rules
   * - `"security"` — only security rules
   * - `"ai-mistakes"` — only AI-specific mistake rules
   * - `"code-quality"` — only code quality rules
   * - `Rule[]` — a custom array of rules
   * - `false` — disable rules entirely
   *
   * @default "all"
   */
  rules?: "all" | "security" | "ai-mistakes" | "code-quality" | Rule[] | false;

  /**
   * Packages to pre-install in the sandbox before running.
   *
   * @example ["pandas", "numpy"]
   */
  install?: string[];

  /**
   * Environment variables to set inside the sandbox.
   * Useful for providing mock API keys so code can import SDKs.
   *
   * @example { OPENAI_API_KEY: "sk-test" }
   */
  env?: Record<string, string>;

  /**
   * Sandbox execution timeout in seconds.
   *
   * @default 30
   */
  timeout?: number;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/** A verification rule that checks code for known problems. */
export interface Rule {
  /** Unique identifier (e.g., "security/no-hardcoded-secrets"). */
  id: string;

  /** Short human-readable name. */
  name: string;

  /** Which languages this rule applies to. `undefined` = all languages. */
  languages?: Language[];

  /**
   * Regex pattern to match against the code.
   * If provided, the rule uses pattern matching.
   */
  pattern?: RegExp;

  /**
   * Custom check function for rules that need more than a regex.
   * Return an array of issues, or an empty array if the code passes.
   */
  check?: (code: string, language: Language | "unknown") => RuleMatch[];

  /** Human-readable message explaining the problem. */
  message: string;

  /** Severity of the issue when this rule triggers. */
  severity: Severity;

  /** Suggested fix or alternative approach. */
  suggestion?: string;
}

/** A match found by a rule's custom check function. */
export interface RuleMatch {
  /** Human-readable message (overrides the rule's default message). */
  message?: string;

  /** 1-based line number where the match was found. */
  line?: number;

  /** Suggested fix (overrides the rule's default suggestion). */
  suggestion?: string;
}
