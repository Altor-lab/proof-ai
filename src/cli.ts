/**
 * Proof CLI
 *
 * Usage:
 *   proof verify --code "print('hello')" --language python
 *   proof verify --file ./generated.py
 *   proof verify --text "$(cat response.md)"
 *   proof check ./script.py    (shorthand for --file)
 *   proof rules list
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 *   2 — invalid usage or internal error
 */

import { Command } from "commander";
import chalk from "chalk";
import { verify } from "./verify.js";
import { formatResult, formatJSON } from "./report.js";
import { allBuiltinRules } from "./rules/builtin/index.js";
import { isDockerAvailable } from "./sandbox/docker.js";
import { isE2BAvailable } from "./sandbox/e2b.js";
import { version } from "./version.js";

const program = new Command();

program
  .name("proof")
  .description("Code verification for AI agents")
  .version(version);

// ---------------------------------------------------------------------------
// proof verify
// ---------------------------------------------------------------------------

program
  .command("verify")
  .description("Verify AI-generated code for correctness, security, and quality")
  .option("-c, --code <code>", "Code string to verify")
  .option("-t, --text <text>", "Markdown/text containing code blocks to verify")
  .option("-f, --file <path>", "Path to a file to verify")
  .option("-l, --language <lang>", "Programming language (python, javascript, typescript)")
  .option("-s, --sandbox <type>", "Sandbox: auto (default), docker, e2b, none", "auto")
  .option("-r, --rules <set>", "Rules: all (default), security, ai-mistakes, code-quality, none", "all")
  .option("--install <packages...>", "Packages to install in sandbox")
  .option("--timeout <seconds>", "Sandbox timeout in seconds", "30")
  .option("--json", "Output results as JSON")
  .option("-v, --verbose", "Show detailed output for all blocks")
  .option("--stdin", "Read code from stdin")
  .action(async (opts) => {
    try {
      // Handle stdin
      let code = opts.code;
      if (opts.stdin) {
        code = await readStdin();
      }

      // Resolve sandbox option
      let sandbox: boolean | "docker" | "e2b";
      switch (opts.sandbox) {
        case "docker":
          sandbox = "docker";
          break;
        case "e2b":
          sandbox = "e2b";
          break;
        case "none":
          sandbox = false;
          break;
        default:
          sandbox = true;
      }

      // Resolve rules option
      let rules: "all" | "security" | "ai-mistakes" | "code-quality" | false;
      switch (opts.rules) {
        case "none":
          rules = false;
          break;
        case "security":
        case "ai-mistakes":
        case "code-quality":
          rules = opts.rules;
          break;
        default:
          rules = "all";
      }

      const result = await verify({
        code,
        text: opts.text,
        file: opts.file,
        language: opts.language,
        sandbox,
        rules,
        install: opts.install,
        timeout: parseInt(opts.timeout, 10),
      });

      // Output
      if (opts.json) {
        console.log(formatJSON(result));
      } else {
        console.log(formatResult(result, opts.verbose));
      }

      // Exit code
      process.exit(result.passed ? 0 : 1);
    } catch (error) {
      console.error(
        chalk.red(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
      process.exit(2);
    }
  });

// ---------------------------------------------------------------------------
// proof check <file> — shorthand for proof verify --file <file>
// ---------------------------------------------------------------------------

program
  .command("check <file>")
  .description("Verify a file (shorthand for: proof verify --file <path>)")
  .option("-s, --sandbox <type>", "Sandbox: auto, docker, e2b, none", "auto")
  .option("-r, --rules <set>", "Rules: all, security, ai-mistakes, code-quality, none", "all")
  .option("--json", "Output results as JSON")
  .option("-v, --verbose", "Show detailed output")
  .action(async (file, opts) => {
    try {
      let sandbox: boolean | "docker" | "e2b";
      switch (opts.sandbox) {
        case "docker":
          sandbox = "docker";
          break;
        case "e2b":
          sandbox = "e2b";
          break;
        case "none":
          sandbox = false;
          break;
        default:
          sandbox = true;
      }

      let rules: "all" | "security" | "ai-mistakes" | "code-quality" | false;
      switch (opts.rules) {
        case "none":
          rules = false;
          break;
        case "security":
        case "ai-mistakes":
        case "code-quality":
          rules = opts.rules;
          break;
        default:
          rules = "all";
      }

      const result = await verify({
        file,
        sandbox,
        rules,
      });

      if (opts.json) {
        console.log(formatJSON(result));
      } else {
        console.log(formatResult(result, opts.verbose));
      }

      process.exit(result.passed ? 0 : 1);
    } catch (error) {
      console.error(
        chalk.red(
          `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ),
      );
      process.exit(2);
    }
  });

// ---------------------------------------------------------------------------
// proof rules list
// ---------------------------------------------------------------------------

const rulesCmd = program.command("rules").description("Manage verification rules");

rulesCmd
  .command("list")
  .description("List all built-in rules")
  .option("--json", "Output as JSON")
  .action((opts) => {
    if (opts.json) {
      const rules = allBuiltinRules.map((r) => ({
        id: r.id,
        name: r.name,
        severity: r.severity,
        languages: r.languages ?? "all",
        message: r.message,
      }));
      console.log(JSON.stringify(rules, null, 2));
      return;
    }

    console.log("");
    console.log(chalk.bold("  Built-in Rules"));
    console.log(chalk.dim("  ─────────────────────────────────"));
    console.log("");

    // Group by category
    const categories = new Map<string, typeof allBuiltinRules>();
    for (const rule of allBuiltinRules) {
      const category = rule.id.split("/")[0];
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(rule);
    }

    for (const [category, rules] of categories) {
      console.log(chalk.bold(`  ${category}`));
      for (const rule of rules) {
        const icon =
          rule.severity === "error"
            ? chalk.red("●")
            : rule.severity === "warning"
              ? chalk.yellow("●")
              : chalk.blue("●");
        const langs = rule.languages
          ? chalk.dim(` [${rule.languages.join(", ")}]`)
          : "";
        console.log(`    ${icon} ${chalk.white(rule.id)}${langs}`);
        console.log(chalk.dim(`      ${rule.message}`));
      }
      console.log("");
    }
  });

// ---------------------------------------------------------------------------
// proof doctor — check system setup
// ---------------------------------------------------------------------------

program
  .command("doctor")
  .description("Check your system setup for Proof")
  .action(async () => {
    console.log("");
    console.log(chalk.bold("  Proof Doctor"));
    console.log(chalk.dim("  ─────────────────────────────────"));
    console.log("");

    // Check Docker
    const docker = await isDockerAvailable();
    if (docker) {
      console.log(`  ${chalk.green("✓")} Docker is available`);
    } else {
      console.log(`  ${chalk.red("✗")} Docker is not available`);
      console.log(chalk.dim("    Install: https://docs.docker.com/get-docker/"));
    }

    // Check E2B
    const e2b = isE2BAvailable();
    if (e2b) {
      console.log(`  ${chalk.green("✓")} E2B is available (API key set)`);
    } else {
      console.log(chalk.dim(`  ${chalk.dim("○")} E2B not configured (optional)`));
    }

    // Node version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split(".")[0], 10);
    if (major >= 18) {
      console.log(`  ${chalk.green("✓")} Node.js ${nodeVersion}`);
    } else {
      console.log(`  ${chalk.red("✗")} Node.js ${nodeVersion} (requires >= 18)`);
    }

    console.log("");

    if (docker) {
      console.log(chalk.green("  ✓ Ready to verify code!"));
    } else if (e2b) {
      console.log(chalk.green("  ✓ Ready (using E2B cloud sandbox)"));
    } else {
      console.log(chalk.yellow("  ⚠ No sandbox available — rules + syntax checks only"));
      console.log(chalk.dim("    Install Docker for full code execution verification"));
    }

    console.log("");
  });

// ---------------------------------------------------------------------------
// Parse and run
// ---------------------------------------------------------------------------

program.parse();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);

    // If stdin is a TTY (interactive terminal), don't wait for input
    if (process.stdin.isTTY) {
      resolve("");
    }
  });
}
