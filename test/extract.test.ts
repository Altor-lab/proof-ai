import { describe, it, expect } from "vitest";
import { extractCodeBlocks, languageFromPath } from "../src/extract.js";

describe("extractCodeBlocks", () => {
  it("extracts a single Python code block", () => {
    const text = `Here's some code:

\`\`\`python
print("hello world")
\`\`\`

That's it.`;

    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("python");
    expect(blocks[0].code).toBe('print("hello world")');
  });

  it("extracts multiple code blocks", () => {
    const text = `First block:

\`\`\`python
x = 1
\`\`\`

Second block:

\`\`\`javascript
const y = 2;
\`\`\``;

    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe("python");
    expect(blocks[1].language).toBe("javascript");
  });

  it("resolves language aliases", () => {
    const text = `\`\`\`py
x = 1
\`\`\`

\`\`\`js
const y = 2;
\`\`\`

\`\`\`ts
const z: number = 3;
\`\`\``;

    const blocks = extractCodeBlocks(text);
    expect(blocks[0].language).toBe("python");
    expect(blocks[1].language).toBe("javascript");
    expect(blocks[2].language).toBe("typescript");
  });

  it("marks unknown languages as 'unknown'", () => {
    const text = `\`\`\`ruby
puts "hi"
\`\`\``;

    const blocks = extractCodeBlocks(text);
    expect(blocks[0].language).toBe("unknown");
  });

  it("skips empty code blocks", () => {
    const text = `\`\`\`python
\`\`\``;

    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(0);
  });

  it("handles code blocks without language tags", () => {
    const text = `\`\`\`
some code
\`\`\``;

    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("unknown");
  });

  it("handles tilde fences", () => {
    const text = `~~~python
x = 1
~~~`;

    const blocks = extractCodeBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe("python");
  });

  it("calculates line numbers", () => {
    const text = `Line 1
Line 2

\`\`\`python
print("hello")
\`\`\``;

    const blocks = extractCodeBlocks(text);
    expect(blocks[0].startLine).toBe(4);
  });

  it("preserves code indentation", () => {
    const text = `\`\`\`python
def hello():
    print("hi")
    if True:
        return
\`\`\``;

    const blocks = extractCodeBlocks(text);
    expect(blocks[0].code).toContain("    print");
    expect(blocks[0].code).toContain("        return");
  });
});

describe("languageFromPath", () => {
  it("detects Python files", () => {
    expect(languageFromPath("script.py")).toBe("python");
    expect(languageFromPath("module.pyw")).toBe("python");
  });

  it("detects JavaScript files", () => {
    expect(languageFromPath("app.js")).toBe("javascript");
    expect(languageFromPath("module.mjs")).toBe("javascript");
    expect(languageFromPath("module.cjs")).toBe("javascript");
    expect(languageFromPath("component.jsx")).toBe("javascript");
  });

  it("detects TypeScript files", () => {
    expect(languageFromPath("app.ts")).toBe("typescript");
    expect(languageFromPath("module.mts")).toBe("typescript");
    expect(languageFromPath("component.tsx")).toBe("typescript");
  });

  it("detects Go files", () => {
    expect(languageFromPath("main.go")).toBe("go");
  });

  it("detects Rust files", () => {
    expect(languageFromPath("main.rs")).toBe("rust");
  });

  it("returns undefined for unknown extensions", () => {
    expect(languageFromPath("file.rb")).toBeUndefined();
    expect(languageFromPath("file.java")).toBeUndefined();
    expect(languageFromPath("file.txt")).toBeUndefined();
  });

  it("handles paths with directories", () => {
    expect(languageFromPath("/usr/local/scripts/test.py")).toBe("python");
    expect(languageFromPath("src/components/App.tsx")).toBe("typescript");
  });
});
