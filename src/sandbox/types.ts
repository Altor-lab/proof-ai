/**
 * Sandbox provider types
 *
 * Defines the interface that all sandbox providers must implement.
 * Docker is the default; E2B is the optional cloud alternative.
 */

import type { ExecutionResult, ExecutableLanguage } from "../types.js";

/** Configuration for a sandbox execution. */
export interface SandboxRunOptions {
  /** The code to execute. */
  code: string;

  /** Programming language. */
  language: ExecutableLanguage;

  /** Packages to install before execution (e.g., ["pandas", "numpy"]). */
  install?: string[];

  /** Environment variables to set inside the sandbox. */
  env?: Record<string, string>;

  /** Execution timeout in seconds. */
  timeout?: number;
}

/**
 * A sandbox provider that can run code in an isolated environment.
 *
 * Implementations must ensure:
 * - Code runs in isolation (cannot affect the host system)
 * - Execution respects the provided timeout
 * - Resources are cleaned up after execution
 */
export interface SandboxProvider {
  /** Human-readable name of this provider (e.g., "docker", "e2b"). */
  readonly name: string;

  /** Run code and return the execution result. */
  run(options: SandboxRunOptions): Promise<ExecutionResult>;

  /** Clean up any resources (containers, sandboxes, temp files). */
  cleanup(): Promise<void>;
}

/** Docker image configuration for a language. */
export interface DockerImage {
  /** Docker image name and tag (e.g., "python:3.12-slim"). */
  image: string;

  /** Command to run the code file (e.g., "python"). */
  command: string;

  /** File extension for the temp file (e.g., ".py"). */
  extension: string;

  /** Command to install packages (e.g., "pip install -q"). */
  installCommand?: string;
}
