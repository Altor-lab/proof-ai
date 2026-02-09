/**
 * Result formatting
 *
 * Renders verification results into human-readable terminal output.
 * Used by the CLI but also available programmatically.
 */

import chalk from "chalk";
import type { VerifyResult, Issue } from "./types.js";

/**
 * Format a verification result as a human-readable string.
 *
 * @param result - The result from `verify()`.
 * @param verbose - Show per-block details even when blocks pass.
 * @returns Formatted string with ANSI colors.
 */
export function formatResult(result: VerifyResult, verbose = false): string {
  const lines: string[] = [];

  // Header
  lines.push("");
  if (result.passed) {
    lines.push(chalk.green.bold("  ✓ Verification passed"));
  } else {
    lines.push(chalk.red.bold("  ✗ Verification failed"));
  }
  lines.push("");

  // Per-block details
  for (let i = 0; i < result.blocks.length; i++) {
    const block = result.blocks[i];
    const blockLabel = `Block ${i + 1}`;
    const langLabel = block.block.language !== "unknown"
      ? chalk.dim(` (${block.block.language})`)
      : "";

    if (block.passed && !verbose) continue;

    if (block.passed) {
      lines.push(`  ${chalk.green("✓")} ${blockLabel}${langLabel}`);
    } else {
      lines.push(`  ${chalk.red("✗")} ${blockLabel}${langLabel}`);
    }

    // Show issues
    for (const issue of block.issues) {
      lines.push(formatIssue(issue));
    }

    // Show execution output (if sandbox was used)
    if (block.execution && verbose) {
      if (block.execution.stdout) {
        lines.push(chalk.dim("    stdout: ") + block.execution.stdout.split("\n")[0]);
      }
      lines.push(
        chalk.dim(`    executed in ${block.execution.durationMs}ms`),
      );
    }

    lines.push("");
  }

  // Summary
  lines.push(chalk.dim("  ─────────────────────────────────"));
  const { stats } = result;
  const blocksSummary = `${stats.passedBlocks}/${stats.totalBlocks} blocks passed`;
  const issueCount = result.issues.length;
  const issueSummary = issueCount === 0
    ? "no issues"
    : `${issueCount} issue${issueCount === 1 ? "" : "s"}`;

  lines.push(
    `  ${chalk.dim("Blocks:")} ${stats.failedBlocks > 0 ? chalk.yellow(blocksSummary) : chalk.green(blocksSummary)}`,
  );
  lines.push(
    `  ${chalk.dim("Issues:")} ${issueCount > 0 ? chalk.yellow(issueSummary) : chalk.green(issueSummary)}`,
  );
  lines.push(
    `  ${chalk.dim("Sandbox:")} ${stats.sandboxProvider ?? "none"}`,
  );
  lines.push(
    `  ${chalk.dim("Time:")} ${stats.durationMs}ms`,
  );
  lines.push("");

  return lines.join("\n");
}

/**
 * Format a single issue as a terminal string.
 */
function formatIssue(issue: Issue): string {
  const icon = severityIcon(issue.severity);
  const lineRef = issue.line ? chalk.dim(`:${issue.line}`) : "";
  const ruleRef = issue.ruleId ? chalk.dim(` [${issue.ruleId}]`) : "";
  const main = `    ${icon} ${issue.message}${lineRef}${ruleRef}`;

  if (issue.suggestion) {
    return main + "\n" + chalk.dim(`      → ${issue.suggestion}`);
  }

  return main;
}

function severityIcon(severity: Issue["severity"]): string {
  switch (severity) {
    case "error":
      return chalk.red("✗");
    case "warning":
      return chalk.yellow("⚠");
    case "info":
      return chalk.blue("ℹ");
  }
}

/**
 * Format a result as JSON (for programmatic use and CI).
 */
export function formatJSON(result: VerifyResult): string {
  return JSON.stringify(result, null, 2);
}

/**
 * Format a summary line suitable for CI output or GitHub Actions.
 */
export function formatSummary(result: VerifyResult): string {
  if (result.passed) {
    return `✓ ${result.stats.totalBlocks} block(s) verified, no issues found`;
  }

  const errors = result.issues.filter((i) => i.severity === "error").length;
  const warnings = result.issues.filter((i) => i.severity === "warning").length;

  const parts = [];
  if (errors > 0) parts.push(`${errors} error${errors === 1 ? "" : "s"}`);
  if (warnings > 0) parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);

  return `✗ ${result.stats.failedBlocks}/${result.stats.totalBlocks} block(s) failed: ${parts.join(", ")}`;
}
