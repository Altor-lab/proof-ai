/**
 * Sandbox provider auto-detection
 *
 * Detects the best available sandbox provider and returns it.
 *
 * Priority order:
 * 1. Docker — free, local, private, works everywhere
 * 2. E2B — cloud sandbox for serverless environments
 * 3. null — no sandbox available, only rules + syntax checks
 */

import { DockerSandbox, isDockerAvailable } from "./docker.js";
import { E2BSandbox, isE2BAvailable } from "./e2b.js";
import type { SandboxProvider } from "./types.js";

export type { SandboxProvider, SandboxRunOptions, DockerImage } from "./types.js";
export { DockerSandbox, isDockerAvailable, resetDockerCache } from "./docker.js";
export { E2BSandbox, isE2BAvailable } from "./e2b.js";

/**
 * Detect and return the best available sandbox provider.
 *
 * @param preference - Force a specific provider ("docker" or "e2b").
 * @returns The sandbox provider, or `null` if none is available.
 */
export async function detectSandbox(
  preference?: "docker" | "e2b",
): Promise<SandboxProvider | null> {
  // Explicit preference
  if (preference === "e2b") {
    if (isE2BAvailable()) return new E2BSandbox();
    throw new Error(
      "E2B sandbox requested but not available. " +
      "Install @e2b/code-interpreter and set E2B_API_KEY.",
    );
  }

  if (preference === "docker") {
    if (await isDockerAvailable()) return new DockerSandbox();
    throw new Error(
      "Docker sandbox requested but Docker is not available. " +
      "Install Docker: https://docs.docker.com/get-docker/",
    );
  }

  // Auto-detect: Docker first, then E2B, then null
  if (await isDockerAvailable()) {
    return new DockerSandbox();
  }

  if (isE2BAvailable()) {
    return new E2BSandbox();
  }

  return null;
}
