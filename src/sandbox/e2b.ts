/**
 * E2B cloud sandbox provider (optional)
 *
 * For serverless environments (Vercel, Cloudflare Workers) where Docker
 * is not available. Requires the `@e2b/code-interpreter` peer dependency
 * and an E2B_API_KEY environment variable.
 *
 * Install: npm install @e2b/code-interpreter
 * Docs: https://e2b.dev/docs
 */

import type { ExecutionResult } from "../types.js";
import type { SandboxProvider, SandboxRunOptions } from "./types.js";

/**
 * Check whether the E2B peer dependency is installed and configured.
 */
export function isE2BAvailable(): boolean {
  if (!process.env.E2B_API_KEY) return false;

  try {
    // Dynamic import check — we don't want to hard-depend on @e2b/code-interpreter
    require.resolve("@e2b/code-interpreter");
    return true;
  } catch {
    return false;
  }
}

export class E2BSandbox implements SandboxProvider {
  readonly name = "e2b";

  private sandbox: unknown = null;

  private async getSandbox(): Promise<unknown> {
    if (this.sandbox) return this.sandbox;

    // Dynamic import so the peer dependency isn't required at load time
    const e2b = await import("@e2b/code-interpreter");

    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) {
      throw new Error(
        "E2B_API_KEY environment variable is required for the E2B sandbox provider. " +
        "Get a free key at https://e2b.dev",
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.sandbox = await (e2b.Sandbox as any).create({
      apiKey,
      timeoutMs: 10 * 60 * 1000, // 10 minute sandbox lifetime
    });

    return this.sandbox;
  }

  async run(options: SandboxRunOptions): Promise<ExecutionResult> {
    const { code, language, install, timeout = 30 } = options;

    if (language !== "python" && language !== "javascript" && language !== "typescript") {
      return {
        success: false,
        stdout: "",
        stderr: `E2B sandbox only supports Python and JavaScript/TypeScript. Got: ${language}`,
        error: `Unsupported language: ${language}`,
        exitCode: 1,
        durationMs: 0,
      };
    }

    const start = Date.now();

    try {
      const sandbox = await this.getSandbox();

      // Install packages if needed
      if (install && install.length > 0) {
        const installCmd =
          language === "python"
            ? `!pip install -q ${install.join(" ")}`
            : `const { execSync } = require('child_process'); execSync('npm install -q ${install.join(" ")}');`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (sandbox as any).runCode(installCmd);
      }

      // Run the code
      const runOptions = language === "javascript" || language === "typescript"
        ? { language: "javascript" as const, timeoutMs: timeout * 1000 }
        : { timeoutMs: timeout * 1000 };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (sandbox as any).runCode(code, runOptions);
      const output = result.text || "";
      const durationMs = Date.now() - start;

      return {
        success: !result.error,
        stdout: output,
        stderr: result.error?.message || "",
        error: result.error?.message,
        exitCode: result.error ? 1 : 0,
        durationMs,
      };
    } catch (error) {
      return {
        success: false,
        stdout: "",
        stderr: error instanceof Error ? error.message : "E2B execution failed",
        error: error instanceof Error ? error.message : "E2B execution failed",
        exitCode: 1,
        durationMs: Date.now() - start,
      };
    }
  }

  async cleanup(): Promise<void> {
    if (this.sandbox) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (this.sandbox as any).kill();
      } catch {
        // Best-effort cleanup
      }
      this.sandbox = null;
    }
  }
}
