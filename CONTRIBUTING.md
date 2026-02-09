# Contributing to Proof

Thank you for wanting to contribute to Proof! This document explains how to get started, what we look for in contributions, and how to submit your changes.

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **Docker** (for sandbox tests)
- **Git**

### Setup

```bash
git clone https://github.com/altorlab/proof-ai.git
cd proof-ai
npm install
```

### Development Commands

```bash
# Type-check
npm run lint

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Run the CLI locally
node bin/proof.js check ./test/fixtures/example.py
```

## How to Contribute

### Reporting Bugs

Open a [GitHub issue](https://github.com/altorlab/proof-ai/issues/new?template=bug_report.md) with:

1. What you expected to happen
2. What actually happened
3. Steps to reproduce
4. Your environment (Node version, OS, Docker version)

### Requesting Features

Open a [feature request](https://github.com/altorlab/proof-ai/issues/new?template=feature_request.md). We especially welcome:

- **New rules** — catch more AI mistakes, security issues, or code quality problems
- **New language support** — Go, Rust, Java, etc.
- **Better error messages** — help users understand what went wrong

### Submitting Code

1. **Fork** the repository
2. **Create a branch** from `main` (`git checkout -b feat/my-feature`)
3. **Make your changes** with tests
4. **Run the full test suite** (`npm test`)
5. **Run the type checker** (`npm run lint`)
6. **Submit a pull request** against `main`

### Writing a New Rule

Rules are the easiest way to contribute. Here's the template:

```typescript
// src/rules/builtin/security.ts (or ai-mistakes.ts, code-quality.ts)

import { defineRule } from "../define.js";

export const noMyPattern = defineRule({
  id: "category/no-my-pattern",    // Must be unique
  name: "No my pattern",           // Human-readable
  languages: ["python"],           // Optional: restrict to specific languages
  severity: "warning",             // "error", "warning", or "info"
  message: "This pattern is problematic because...",
  suggestion: "Do this instead...",

  // Option A: Regex pattern (matched per-line)
  pattern: /dangerous_function\s*\(/,

  // Option B: Custom check function (for complex logic)
  check(code, language) {
    const matches = [];
    // ... your logic here ...
    return matches;
  },
});
```

After adding a rule:

1. Add it to the array in the same file (e.g., `securityRules`)
2. Write tests in `test/rules.test.ts`
3. Update the count in `src/rules/builtin/index.ts` doc comment
4. Run the full test suite

## Code Style

- **TypeScript** — strict mode, no `any` unless necessary
- **JSDoc** — document all public functions and types
- **Functional** — prefer pure functions over classes
- **Explicit** — prefer readability over cleverness
- **No unnecessary dependencies** — we ship with only 2 runtime deps

## Architecture Decisions

- **Docker first** — Docker is the default sandbox, E2B is optional
- **Zero config** — `verify()` should work with sensible defaults
- **Conservative rules** — prefer false negatives over false positives
- **Fast** — rules and syntax checks should be sub-millisecond per block
- **Explicit errors** — when something fails, the error message should tell you exactly what to do

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
