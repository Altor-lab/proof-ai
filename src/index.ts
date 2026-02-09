/**
 * Proof AI — Code verification for AI agents
 *
 * @example
 * ```ts
 * import { verify } from "proof-ai";
 *
 * const result = await verify({
 *   code: 'print("hello world")',
 *   language: "python",
 * });
 *
 * console.log(result.passed); // true
 * ```
 *
 * @example
 * ```ts
 * import { verify } from "proof-ai";
 *
 * // Verify all code blocks in an LLM response
 * const result = await verify({
 *   text: llmResponse,
 *   sandbox: "docker",
 *   rules: "all",
 * });
 *
 * if (!result.passed) {
 *   for (const issue of result.issues) {
 *     console.log(`[${issue.severity}] ${issue.message}`);
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

// Core function
export { verify } from "./verify.js";

// Types
export type {
  VerifyOptions,
  VerifyResult,
  CodeBlock,
  CodeBlockResult,
  Issue,
  ExecutionResult,
  Language,
  ExecutableLanguage,
  Severity,
  IssueSource,
  Rule,
  RuleMatch,
} from "./types.js";

// Helpers
export { resolveLanguage } from "./types.js";
export { extractCodeBlocks, languageFromPath } from "./extract.js";
export { checkSyntax } from "./syntax.js";

// Rules
export { defineRule } from "./rules/define.js";
export { runRules } from "./rules/engine.js";
export {
  allBuiltinRules,
  securityRules,
  aiMistakeRules,
  codeQualityRules,
} from "./rules/builtin/index.js";

// Sandbox
export {
  detectSandbox,
  isDockerAvailable,
  isE2BAvailable,
  DockerSandbox,
  E2BSandbox,
} from "./sandbox/index.js";
export type { SandboxProvider, SandboxRunOptions } from "./sandbox/index.js";

// Formatting
export { formatResult, formatJSON, formatSummary } from "./report.js";
