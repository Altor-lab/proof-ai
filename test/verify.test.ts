import { describe, it, expect } from "vitest";
import { verify } from "../src/verify.js";

describe("verify", () => {
  describe("input handling", () => {
    it("rejects when no input is provided", async () => {
      await expect(verify({})).rejects.toThrow("One of `code`, `text`, or `file`");
    });

    it("rejects when multiple inputs are provided", async () => {
      await expect(
        verify({ code: "x = 1", text: "```python\nx = 1\n```" }),
      ).rejects.toThrow("Only one of");
    });

    it("verifies a code string", async () => {
      const result = await verify({
        code: 'print("hello world")',
        language: "python",
        sandbox: false,
      });

      expect(result.passed).toBe(true);
      expect(result.stats.totalBlocks).toBe(1);
      expect(result.blocks[0].block.language).toBe("python");
    });

    it("verifies text with code blocks", async () => {
      const text = `Here's some Python:

\`\`\`python
x = 1 + 2
print(x)
\`\`\`

And some JavaScript:

\`\`\`javascript
const y = 1 + 2;
console.log(y);
\`\`\``;

      const result = await verify({ text, sandbox: false });
      expect(result.stats.totalBlocks).toBe(2);
      expect(result.blocks[0].block.language).toBe("python");
      expect(result.blocks[1].block.language).toBe("javascript");
    });

    it("treats plain text as code when no fences found", async () => {
      const result = await verify({
        text: 'print("hello")',
        language: "python",
        sandbox: false,
      });

      expect(result.stats.totalBlocks).toBe(1);
    });

    it("returns empty result for text with no code", async () => {
      const result = await verify({
        text: "",
        sandbox: false,
      });

      expect(result.passed).toBe(true);
      expect(result.stats.totalBlocks).toBe(0);
    });
  });

  describe("rule checking", () => {
    it("catches hardcoded secrets", async () => {
      const result = await verify({
        code: 'api_key = "sk-1234567890abcdefghijklmnop"',
        language: "python",
        sandbox: false,
        rules: "security",
      });

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.ruleId === "security/no-hardcoded-secrets")).toBe(true);
    });

    it("catches placeholder values", async () => {
      const result = await verify({
        code: 'client = OpenAI(api_key="YOUR_API_KEY")',
        language: "python",
        sandbox: false,
        rules: "ai-mistakes",
      });

      expect(result.passed).toBe(false);
      expect(result.issues.some((i) => i.ruleId === "ai-mistakes/no-placeholder-values")).toBe(true);
    });

    it("respects rules: false to skip all rules", async () => {
      const result = await verify({
        code: 'api_key = "sk-1234567890abcdefghijklmnop"',
        language: "python",
        sandbox: false,
        rules: false,
      });

      // No rules = only syntax check, which passes for this code
      const ruleIssues = result.issues.filter((i) => i.source === "rule");
      expect(ruleIssues).toHaveLength(0);
    });

    it("accepts custom rules", async () => {
      const customRule = {
        id: "custom/no-foo",
        name: "No foo",
        pattern: /foo/,
        message: "Don't use foo",
        severity: "error" as const,
      };

      const result = await verify({
        code: 'const x = "foo";',
        language: "javascript",
        sandbox: false,
        rules: [customRule],
      });

      expect(result.issues.some((i) => i.ruleId === "custom/no-foo")).toBe(true);
    });
  });

  describe("syntax checking", () => {
    it("catches missing colon in Python", async () => {
      const result = await verify({
        code: `if x > 0
    print(x)`,
        language: "python",
        sandbox: false,
        rules: false,
      });

      expect(result.issues.some((i) => i.source === "syntax")).toBe(true);
    });

    it("catches unbalanced braces in JavaScript", async () => {
      const result = await verify({
        code: `function test() {
  console.log("hello");`,
        language: "javascript",
        sandbox: false,
        rules: false,
      });

      expect(result.issues.some((i) => i.source === "syntax")).toBe(true);
    });
  });

  describe("result structure", () => {
    it("includes all expected fields", async () => {
      const result = await verify({
        code: 'print("hello")',
        language: "python",
        sandbox: false,
      });

      // Top-level fields
      expect(result).toHaveProperty("passed");
      expect(result).toHaveProperty("issues");
      expect(result).toHaveProperty("blocks");
      expect(result).toHaveProperty("stats");

      // Stats fields
      expect(result.stats).toHaveProperty("totalBlocks");
      expect(result.stats).toHaveProperty("passedBlocks");
      expect(result.stats).toHaveProperty("failedBlocks");
      expect(result.stats).toHaveProperty("rulesChecked");
      expect(result.stats).toHaveProperty("durationMs");
      expect(result.stats).toHaveProperty("sandboxProvider");
    });

    it("correctly counts blocks and issues", async () => {
      const text = `\`\`\`python
api_key = "sk-1234567890abcdefghijklmnop"
\`\`\`

\`\`\`python
print("clean code")
\`\`\``;

      const result = await verify({ text, sandbox: false });
      expect(result.stats.totalBlocks).toBe(2);
      expect(result.stats.failedBlocks).toBe(1);
      expect(result.stats.passedBlocks).toBe(1);
    });

    it("reports sandbox provider as null when sandbox is disabled", async () => {
      const result = await verify({
        code: 'print("hi")',
        language: "python",
        sandbox: false,
      });
      expect(result.stats.sandboxProvider).toBeNull();
    });
  });

  describe("AI-generated code scenarios", () => {
    it("catches a typical GPT hallucination: mixed Python/JS", async () => {
      const code = `def process_data(data):
    const result = data.map(x => x * 2)
    return result`;

      const result = await verify({
        code,
        language: "python",
        sandbox: false,
      });

      // Mixed syntax is a warning, not an error (code might still be intentional)
      expect(result.issues.some((i) => i.ruleId === "ai-mistakes/no-mixed-syntax")).toBe(true);
      expect(result.issues.some((i) => i.severity === "warning")).toBe(true);
    });

    it("catches incomplete AI-generated code with pass", async () => {
      const code = `class DataProcessor:
    def __init__(self):
        pass

    def process(self, data):
        pass

    def validate(self, data):
        pass`;

      const result = await verify({
        code,
        language: "python",
        sandbox: false,
        rules: "ai-mistakes",
      });

      expect(result.issues.some((i) => i.ruleId === "ai-mistakes/no-incomplete-code")).toBe(true);
    });

    it("passes clean, real-world Python code", async () => {
      const code = `import json
from pathlib import Path

def load_config(path: str) -> dict:
    """Load configuration from a JSON file."""
    config_path = Path(path)
    if not config_path.exists():
        raise FileNotFoundError(f"Config not found: {path}")

    with open(config_path) as f:
        return json.load(f)

config = load_config("config.json")
print(f"Loaded {len(config)} settings")`;

      const result = await verify({
        code,
        language: "python",
        sandbox: false,
      });

      // This should pass or at worst have warnings, not errors
      const errors = result.issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("passes clean, real-world JavaScript code", async () => {
      const code = `import { readFile } from "fs/promises";

async function loadConfig(path) {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content);
}

const config = await loadConfig("./config.json");
console.log(\`Loaded \${Object.keys(config).length} settings\`);`;

      const result = await verify({
        code,
        language: "javascript",
        sandbox: false,
      });

      const errors = result.issues.filter((i) => i.severity === "error");
      expect(errors).toHaveLength(0);
    });
  });
});
