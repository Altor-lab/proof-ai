/**
 * Docker sandbox provider
 *
 * Runs code in isolated Docker containers with hardened security defaults.
 * No network access, memory limits, read-only filesystem, and process limits.
 *
 * This is the default sandbox provider — free, local, and private.
 * Code never leaves the machine.
 */

import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExecutionResult, ExecutableLanguage } from "../types.js";
import type { SandboxProvider, SandboxRunOptions, DockerImage } from "./types.js";

// ---------------------------------------------------------------------------
// Language → Docker image mapping
// ---------------------------------------------------------------------------

const DOCKER_IMAGES: Record<ExecutableLanguage, DockerImage> = {
  python: {
    image: "python:3.12-slim",
    command: "python",
    extension: ".py",
    installCommand: "pip install -q",
  },
  javascript: {
    image: "node:20-slim",
    command: "node",
    extension: ".js",
    installCommand: "npm install --silent",
  },
  typescript: {
    image: "node:20-slim",
    command: "node",
    extension: ".js", // We'll transpile-free via tsx or strip types
    installCommand: "npm install --silent",
  },
};

// ---------------------------------------------------------------------------
// Docker availability detection
// ---------------------------------------------------------------------------

let dockerAvailable: boolean | null = null;

/**
 * Check if Docker is available on this system.
 *
 * Caches the result after the first check. The check runs `docker info`
 * which verifies both that the CLI exists and the daemon is running.
 */
export async function isDockerAvailable(): Promise<boolean> {
  if (dockerAvailable !== null) return dockerAvailable;

  try {
    const result = await runProcess("docker", ["info"], {
      timeout: 5,
      quiet: true,
    });
    dockerAvailable = result.exitCode === 0;
  } catch {
    dockerAvailable = false;
  }

  return dockerAvailable;
}

/** Reset the cached Docker availability (for testing). */
export function resetDockerCache(): void {
  dockerAvailable = null;
}

// ---------------------------------------------------------------------------
// Docker sandbox implementation
// ---------------------------------------------------------------------------

export class DockerSandbox implements SandboxProvider {
  readonly name = "docker";

  async run(options: SandboxRunOptions): Promise<ExecutionResult> {
    const { code, language, install, env, timeout = 30 } = options;

    const imageConfig = DOCKER_IMAGES[language];
    if (!imageConfig) {
      return {
        success: false,
        stdout: "",
        stderr: `Unsupported language for Docker sandbox: ${language}`,
        error: `Unsupported language: ${language}`,
        exitCode: 1,
        durationMs: 0,
      };
    }

    // Create temp directory with code file
    const tmpDir = await mkdtemp(join(tmpdir(), "proof-"));
    const codeFile = `code${imageConfig.extension}`;
    const codePath = join(tmpDir, codeFile);

    try {
      // For TypeScript, strip type annotations for Node execution
      const executableCode = language === "typescript" ? stripTypeAnnotations(code) : code;
      await writeFile(codePath, executableCode, "utf-8");

      // Build the command that runs inside the container
      const innerCommand = buildInnerCommand(imageConfig, codeFile, install);

      // Build Docker arguments with security flags
      const dockerArgs = buildDockerArgs({
        image: imageConfig.image,
        tmpDir,
        innerCommand,
        env,
        timeout,
        needsNetwork: install !== undefined && install.length > 0,
      });

      const start = Date.now();
      const result = await runProcess("docker", dockerArgs, { timeout: timeout + 10 });
      const durationMs = Date.now() - start;

      return {
        success: result.exitCode === 0,
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
        error: result.exitCode !== 0 ? result.stderr.trim() || `Exit code ${result.exitCode}` : undefined,
        exitCode: result.exitCode,
        durationMs,
      };
    } finally {
      // Always clean up temp directory
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {
        // Best-effort cleanup — don't throw on failure
      });
    }
  }

  async cleanup(): Promise<void> {
    // Docker containers are created with --rm, so they self-clean.
    // Nothing to do here.
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DockerArgsOptions {
  image: string;
  tmpDir: string;
  innerCommand: string;
  env?: Record<string, string>;
  timeout: number;
  needsNetwork: boolean;
}

function buildDockerArgs(options: DockerArgsOptions): string[] {
  const { image, tmpDir, innerCommand, env, timeout, needsNetwork } = options;

  const args: string[] = [
    "run",
    "--rm",                                         // Auto-remove container
    ...(needsNetwork ? [] : ["--network=none"]),    // No network unless installing packages
    `--memory=256m`,                                // Memory limit
    `--cpus=0.5`,                                   // CPU limit
    `--pids-limit=64`,                              // Process limit (prevent fork bombs)
    `--read-only`,                                  // Read-only root filesystem
    `--tmpfs=/tmp:size=64m`,                        // Writable /tmp with size limit
    `--security-opt=no-new-privileges`,             // Prevent privilege escalation
    `--stop-timeout=${timeout}`,                    // Container stop timeout
    `-v`, `${tmpDir}:/code:ro`,                     // Mount code directory read-only
    `-w`, `/code`,                                  // Working directory
  ];

  // Environment variables
  if (env) {
    for (const [key, value] of Object.entries(env)) {
      args.push("-e", `${key}=${value}`);
    }
  }

  // Image and command
  args.push(image, "sh", "-c", innerCommand);

  return args;
}

function buildInnerCommand(
  imageConfig: DockerImage,
  codeFile: string,
  install?: string[],
): string {
  const parts: string[] = [];

  // Install packages first (if any)
  if (install && install.length > 0 && imageConfig.installCommand) {
    const packages = install.join(" ");
    parts.push(`${imageConfig.installCommand} ${packages} 2>/dev/null`);
  }

  // Run the code
  parts.push(`${imageConfig.command} ${codeFile}`);

  return parts.join(" && ");
}

/**
 * Strip TypeScript type annotations for basic Node.js execution.
 *
 * This is a simple heuristic for common patterns. It won't handle
 * every TypeScript feature, but covers the code that AI agents
 * typically generate (type annotations on variables and parameters).
 *
 * For Node.js 22+, `--experimental-strip-types` could be used instead.
 */
function stripTypeAnnotations(code: string): string {
  return code
    // Remove `: Type` annotations on variables and parameters
    .replace(/:\s*(?:string|number|boolean|any|void|never|unknown|null|undefined)(?:\[\])?\s*(?=[=,;)\n{])/g, "")
    // Remove `as Type` assertions
    .replace(/\s+as\s+\w+(?:\[\])?/g, "")
    // Remove interface/type declarations entirely
    .replace(/^(?:export\s+)?(?:interface|type)\s+\w+[\s\S]*?^\}/gm, "")
    // Remove import type statements
    .replace(/^import\s+type\s+.*$/gm, "");
}

// ---------------------------------------------------------------------------
// Process runner
// ---------------------------------------------------------------------------

interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runProcess(
  command: string,
  args: string[],
  options: { timeout?: number; quiet?: boolean } = {},
): Promise<ProcessResult> {
  const { timeout = 30, quiet = false } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: timeout * 1000,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
      // Cap output at 1MB to prevent memory issues
      if (stdout.length > 1_048_576) {
        child.kill("SIGTERM");
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
      if (stderr.length > 1_048_576) {
        child.kill("SIGTERM");
      }
    });

    child.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });

    child.on("error", (err) => {
      if (quiet) {
        resolve({ stdout: "", stderr: err.message, exitCode: 1 });
      } else {
        reject(err);
      }
    });
  });
}
