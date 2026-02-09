import { describe, it, expect } from "vitest";
import { checkSyntax } from "../src/syntax.js";

describe("checkSyntax", () => {
  describe("Python", () => {
    it("detects missing colon after if statement", () => {
      const code = `if x > 0
    print(x)`;
      const issues = checkSyntax(code, "python");
      expect(issues.some((i) => i.message.includes("Missing colon"))).toBe(true);
    });

    it("does not flag correct if statement", () => {
      const code = `if x > 0:
    print(x)`;
      const issues = checkSyntax(code, "python");
      expect(issues.filter((i) => i.message.includes("Missing colon"))).toHaveLength(0);
    });

    it("does not flag one-liner if", () => {
      const code = `if x > 0: print(x)`;
      const issues = checkSyntax(code, "python");
      expect(issues.filter((i) => i.message.includes("Missing colon"))).toHaveLength(0);
    });

    it("detects missing colon after def", () => {
      const code = `def hello()
    print("hi")`;
      const issues = checkSyntax(code, "python");
      expect(issues.some((i) => i.message.includes("Missing colon"))).toBe(true);
    });

    it("detects unbalanced parentheses", () => {
      const code = `print("hello"
x = (1 + 2`;
      const issues = checkSyntax(code, "python");
      expect(issues.some((i) => i.message.includes("parentheses"))).toBe(true);
    });

    it("ignores brackets inside strings", () => {
      const code = `x = "this has (brackets) in a string"
y = f"nested {func(arg)} value"`;
      const issues = checkSyntax(code, "python");
      // Should not report unbalanced brackets for content inside strings
      const bracketIssues = issues.filter((i) => i.message.includes("Unbalanced"));
      expect(bracketIssues).toHaveLength(0);
    });

    it("passes clean code", () => {
      const code = `def greet(name: str) -> str:
    return f"Hello, {name}!"

result = greet("World")
print(result)`;
      const issues = checkSyntax(code, "python");
      expect(issues).toHaveLength(0);
    });
  });

  describe("JavaScript / TypeScript", () => {
    it("detects unbalanced braces", () => {
      const code = `function hello() {
  console.log("hi");`;
      const issues = checkSyntax(code, "javascript");
      expect(issues.some((i) => i.message.includes("braces"))).toBe(true);
    });

    it("passes clean code", () => {
      const code = `function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));`;
      const issues = checkSyntax(code, "javascript");
      expect(issues).toHaveLength(0);
    });
  });

  describe("Unknown language", () => {
    it("returns empty array", () => {
      const issues = checkSyntax("some code", "unknown");
      expect(issues).toHaveLength(0);
    });
  });
});
