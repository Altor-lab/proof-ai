/**
 * Type declaration for the optional @e2b/code-interpreter peer dependency.
 * This allows TypeScript compilation to succeed without the package installed.
 */
declare module "@e2b/code-interpreter" {
  export class Sandbox {
    static create(options: { apiKey: string; timeoutMs?: number }): Promise<Sandbox>;
    runCode(
      code: string,
      options?: { language?: "python" | "javascript"; timeoutMs?: number },
    ): Promise<{ text?: string; error?: { message: string } }>;
    kill(): Promise<void>;
  }
}
