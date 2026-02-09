import { describe, it, expect } from "vitest";
import { runRules } from "../src/rules/engine.js";
import { securityRules } from "../src/rules/builtin/security.js";
import { aiMistakeRules } from "../src/rules/builtin/ai-mistakes.js";
import { codeQualityRules } from "../src/rules/builtin/code-quality.js";
import { allBuiltinRules } from "../src/rules/builtin/index.js";
import { defineRule } from "../src/rules/define.js";

describe("Security rules", () => {
  it("detects hardcoded API keys", () => {
    const code = `api_key = "sk-1234567890abcdefghijklmnop"`;
    const issues = runRules(code, "python", securityRules);
    expect(issues.some((i) => i.ruleId === "security/no-hardcoded-secrets")).toBe(true);
  });

  it("detects OpenAI API keys", () => {
    const code = `const key = "sk-abcdefghijklmnopqrstuvwx";`;
    const issues = runRules(code, "javascript", securityRules);
    expect(issues.some((i) => i.ruleId === "security/no-hardcoded-secrets")).toBe(true);
  });

  it("detects GitHub tokens", () => {
    const code = `token = "ghp_1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZab"`;
    const issues = runRules(code, "python", securityRules);
    expect(issues.some((i) => i.ruleId === "security/no-hardcoded-secrets")).toBe(true);
  });

  it("does not flag env var usage", () => {
    const code = `import os
api_key = os.environ["OPENAI_API_KEY"]`;
    const issues = runRules(code, "python", securityRules);
    expect(issues.filter((i) => i.ruleId === "security/no-hardcoded-secrets")).toHaveLength(0);
  });

  it("detects dangerous eval() in Python", () => {
    const code = `result = eval(user_input)`;
    const issues = runRules(code, "python", securityRules);
    expect(issues.some((i) => i.ruleId === "security/no-dangerous-operations")).toBe(true);
  });

  it("detects dangerous eval() in JavaScript", () => {
    const code = `const result = eval(userInput);`;
    const issues = runRules(code, "javascript", securityRules);
    expect(issues.some((i) => i.ruleId === "security/no-dangerous-operations")).toBe(true);
  });

  it("does not flag ast.literal_eval", () => {
    const code = `import ast
result = ast.literal_eval(data)`;
    const issues = runRules(code, "python", securityRules);
    const dangerousOps = issues.filter(
      (i) => i.ruleId === "security/no-dangerous-operations" && i.message.includes("eval"),
    );
    expect(dangerousOps).toHaveLength(0);
  });

  it("detects SQL injection patterns", () => {
    const code = `query = "SELECT * FROM users WHERE id = " + userId + ""`;
    const issues = runRules(code, "python", securityRules);
    expect(issues.some((i) => i.ruleId === "security/no-sql-injection")).toBe(true);
  });
});

describe("AI mistake rules", () => {
  it("detects YOUR_API_KEY placeholder", () => {
    const code = `client = OpenAI(api_key="YOUR_API_KEY")`;
    const issues = runRules(code, "python", aiMistakeRules);
    expect(issues.some((i) => i.ruleId === "ai-mistakes/no-placeholder-values")).toBe(true);
  });

  it("detects REPLACE_ME placeholder", () => {
    const code = `const url = "REPLACE_ME";`;
    const issues = runRules(code, "javascript", aiMistakeRules);
    expect(issues.some((i) => i.ruleId === "ai-mistakes/no-placeholder-values")).toBe(true);
  });

  it("does not flag placeholders in comments", () => {
    const code = `# Replace YOUR_API_KEY with your actual key
api_key = os.environ["OPENAI_API_KEY"]`;
    const issues = runRules(code, "python", aiMistakeRules);
    expect(issues.filter((i) => i.ruleId === "ai-mistakes/no-placeholder-values")).toHaveLength(0);
  });

  it("detects incomplete code markers", () => {
    const code = `def process():
    data = load_data()
    # rest of implementation
    pass`;
    const issues = runRules(code, "python", aiMistakeRules);
    expect(issues.some((i) => i.ruleId === "ai-mistakes/no-incomplete-code")).toBe(true);
  });

  it("detects Python syntax in JavaScript", () => {
    const code = `def calculate(x, y):
    return x + y`;
    const issues = runRules(code, "javascript", aiMistakeRules);
    expect(issues.some((i) => i.ruleId === "ai-mistakes/no-mixed-syntax")).toBe(true);
  });

  it("detects JavaScript syntax in Python", () => {
    const code = `const result = calculate(1, 2);`;
    const issues = runRules(code, "python", aiMistakeRules);
    expect(issues.some((i) => i.ruleId === "ai-mistakes/no-mixed-syntax")).toBe(true);
  });

  it("detects console.log in Python", () => {
    const code = `console.log("hello")`;
    const issues = runRules(code, "python", aiMistakeRules);
    expect(issues.some((i) => i.message.includes("console.log"))).toBe(true);
  });
});

describe("Code quality rules", () => {
  it("detects unbalanced brackets", () => {
    const code = `function test() {
  if (true) {
    console.log("hi");
  }`;
    const issues = runRules(code, "javascript", codeQualityRules);
    expect(issues.some((i) => i.ruleId === "code-quality/balanced-brackets")).toBe(true);
  });

  it("passes balanced code", () => {
    const code = `function test() {
  if (true) {
    console.log("hi");
  }
}`;
    const issues = runRules(code, "javascript", codeQualityRules);
    expect(issues.filter((i) => i.ruleId === "code-quality/balanced-brackets")).toHaveLength(0);
  });

  it("detects unused Python imports", () => {
    const code = `import os
import json
print("hello")`;
    const issues = runRules(code, "python", codeQualityRules);
    const unusedImports = issues.filter((i) => i.ruleId === "code-quality/no-unused-imports");
    expect(unusedImports.length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag used Python imports", () => {
    const code = `import json
data = json.loads('{"key": "value"}')`;
    const issues = runRules(code, "python", codeQualityRules);
    expect(issues.filter((i) => i.ruleId === "code-quality/no-unused-imports")).toHaveLength(0);
  });

  it("detects unused JS named imports", () => {
    const code = `import { readFile, writeFile } from "fs";
const data = readFile("test.txt");`;
    const issues = runRules(code, "javascript", codeQualityRules);
    const unusedImports = issues.filter(
      (i) => i.ruleId === "code-quality/no-unused-imports" && i.message.includes("writeFile"),
    );
    expect(unusedImports).toHaveLength(1);
  });

  it("detects empty catch blocks in JavaScript", () => {
    const code = `try {
  doSomething();
} catch (e) { }`;
    const issues = runRules(code, "javascript", codeQualityRules);
    expect(issues.some((i) => i.message.includes("catch"))).toBe(true);
  });
});

describe("Rule engine", () => {
  it("skips rules that don't match the language", () => {
    const pythonOnlyRule = defineRule({
      id: "test/python-only",
      name: "Python only",
      languages: ["python"],
      pattern: /print/,
      message: "Found print",
      severity: "info",
    });

    const jsIssues = runRules('console.log("print")', "javascript", [pythonOnlyRule]);
    expect(jsIssues).toHaveLength(0);

    const pyIssues = runRules('print("hello")', "python", [pythonOnlyRule]);
    expect(pyIssues).toHaveLength(1);
  });

  it("runs custom check functions", () => {
    const customRule = defineRule({
      id: "test/custom",
      name: "Custom",
      check: (code) => {
        if (code.includes("bad")) {
          return [{ message: "Found bad code", line: 1 }];
        }
        return [];
      },
      message: "Default message",
      severity: "warning",
    });

    const issues = runRules("this is bad code", "python", [customRule]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe("Found bad code");
  });

  it("all 10 built-in rules are loaded", () => {
    expect(allBuiltinRules).toHaveLength(10);
  });
});

describe("defineRule", () => {
  it("validates required fields", () => {
    expect(() => defineRule({ id: "", name: "x", message: "x", severity: "error", pattern: /x/ } as any)).toThrow();
    expect(() => defineRule({ id: "x", name: "", message: "x", severity: "error", pattern: /x/ } as any)).toThrow();
    expect(() => defineRule({ id: "x", name: "x", message: "", severity: "error", pattern: /x/ } as any)).toThrow();
  });

  it("requires pattern or check", () => {
    expect(() =>
      defineRule({ id: "x", name: "x", message: "x", severity: "error" }),
    ).toThrow("pattern or a check function");
  });

  it("freezes the rule object", () => {
    const rule = defineRule({
      id: "test/frozen",
      name: "Frozen",
      pattern: /test/,
      message: "Test",
      severity: "info",
    });
    expect(Object.isFrozen(rule)).toBe(true);
  });
});
