/**
 * Code block extraction
 *
 * Extracts fenced code blocks from markdown, plain text, or AI responses.
 * Handles the common formats LLMs use when returning code.
 */

import { type CodeBlock, type Language, resolveLanguage } from "./types.js";

/**
 * Extract all fenced code blocks from a string of text.
 *
 * Supports:
 * - Standard markdown fences: ```language ... ```
 * - Tilde fences: ~~~language ... ~~~
 * - Language aliases (py, js, ts, etc.)
 *
 * @example
 * ```ts
 * const blocks = extractCodeBlocks("```python\nprint('hi')\n```");
 * // [{ language: "python", code: "print('hi')", startLine: 1, endLine: 3 }]
 * ```
 */
export function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];

  // Match fenced code blocks (backticks or tildes)
  // Captures: optional language tag and the code content
  const fenceRegex = /^(?:`{3,}|~{3,})(\w+)?\s*\n([\s\S]*?)^(?:`{3,}|~{3,})\s*$/gm;

  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(text)) !== null) {
    const langHint = match[1] ?? "";
    const code = match[2];

    // Skip empty code blocks
    if (!code || code.trim().length === 0) {
      continue;
    }

    const language = resolveLanguage(langHint) ?? "unknown";

    // Calculate line numbers
    const textBeforeMatch = text.slice(0, match.index);
    const startLine = textBeforeMatch.split("\n").length;
    const endLine = startLine + match[0].split("\n").length - 1;

    blocks.push({
      language,
      code: code.trimEnd(),
      startLine,
      endLine,
    });
  }

  return blocks;
}

/** Map of file extensions to languages. */
const EXTENSION_MAP: Record<string, Language> = {
  ".py": "python",
  ".pyw": "python",
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".jsx": "javascript",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "typescript",
  ".go": "go",
  ".rs": "rust",
};

/**
 * Infer the language from a file path based on its extension.
 *
 * @returns The detected language or `undefined` if unrecognized.
 */
export function languageFromPath(filePath: string): Language | undefined {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return EXTENSION_MAP[ext];
}
