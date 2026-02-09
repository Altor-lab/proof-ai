<p align="center">
  <h1 align="center">Proof</h1>
  <p align="center">
    <strong>Code verification for AI agents</strong>
  </p>
  <p align="center">
    Run AI-generated code in isolated Docker containers before it reaches your users.
    <br />
    Catch runtime errors, security issues, and AI hallucinations — locally, for free.
  </p>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#why-proof">Why Proof</a> &bull;
  <a href="#cli">CLI</a> &bull;
  <a href="#api">API</a> &bull;
  <a href="#rules">Rules</a> &bull;
  <a href="#ci-integration">CI</a>
</p>

---

```bash
npx proof-ai check ./generated.py
# ✓ Verification passed — 1/1 blocks, no issues
```

## The Problem

Every AI coding tool — Cursor, Copilot, Devin, ChatGPT — generates code that _looks_ right but might:

- **Not run** — missing imports, wrong syntax, hallucinated packages
- **Be insecure** — hardcoded API keys, eval(), SQL injection
- **Be incomplete** — `pass`, `// TODO`, placeholder values

You shouldn't ship code you haven't tested. Proof tests it for you.

## Why Proof

| | Proof | Guardrails AI | Manual review |
|---|---|---|---|
| **Runs the code** | Yes (Docker sandbox) | No | Sometimes |
| **Catches runtime errors** | Yes | No | Maybe |
| **Free & local** | Yes (just Docker) | Cloud API | Yes |
| **Zero API keys** | Yes | Requires key | Yes |
| **CI-native** | Exit code 0/1 | SDK only | Manual |
| **AI-specific rules** | 10 built-in | Structured output | None |

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **Docker** (for sandbox execution) — [Install Docker](https://docs.docker.com/get-docker/)

> Docker is optional. Without it, Proof still runs 10 built-in rules + syntax checks. Docker adds actual code execution in isolated containers.

### Install

```bash
npm install proof-ai
```

### CLI

```bash
# Verify a file
npx proof-ai check ./script.py

# Verify a code string
npx proof-ai verify --code 'print("hello")' --language python

# Verify an LLM response (all code blocks)
npx proof-ai verify --text "$(cat response.md)"

# Pipe from stdin
echo 'console.log("hi")' | npx proof-ai verify --stdin --language javascript

# JSON output (for CI)
npx proof-ai check ./script.py --json

# Skip sandbox (rules + syntax only)
npx proof-ai check ./script.py --sandbox none

# Only security rules
npx proof-ai check ./script.py --rules security
```

### API

```typescript
import { verify } from "proof-ai";

// Verify a code string
const result = await verify({
  code: 'import pandas as pd\ndf = pd.read_csv("data.csv")',
  language: "python",
});

if (!result.passed) {
  for (const issue of result.issues) {
    console.log(`[${issue.severity}] ${issue.message}`);
  }
}
```

```typescript
// Verify all code blocks in an LLM response
const result = await verify({
  text: llmResponse,
  sandbox: "docker",
  rules: "all",
});

console.log(`${result.stats.passedBlocks}/${result.stats.totalBlocks} blocks passed`);
```

```typescript
// Verify a file
const result = await verify({ file: "./generated.py" });
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `code` | `string` | — | Code string to verify |
| `text` | `string` | — | Markdown/text containing fenced code blocks |
| `file` | `string` | — | Path to a file to verify |
| `language` | `string` | auto-detect | `python`, `javascript`, `typescript` |
| `sandbox` | `boolean \| "docker" \| "e2b"` | `true` | Sandbox provider (auto-detect, force Docker/E2B, or disable) |
| `rules` | `string \| Rule[] \| false` | `"all"` | `"all"`, `"security"`, `"ai-mistakes"`, `"code-quality"`, custom array, or `false` |
| `install` | `string[]` | — | Packages to install in sandbox (e.g., `["pandas"]`) |
| `env` | `Record<string, string>` | — | Environment variables for sandbox |
| `timeout` | `number` | `30` | Sandbox timeout in seconds |

## Rules

Proof ships with **10 built-in rules** across 3 categories:

### Security (3 rules)

| Rule | What it catches |
|------|----------------|
| `security/no-hardcoded-secrets` | API keys, tokens, passwords in code |
| `security/no-dangerous-operations` | `eval()`, `exec()`, `os.system()`, `rm -rf` |
| `security/no-sql-injection` | SQL built with string concatenation |

### AI Mistakes (4 rules)

| Rule | What it catches |
|------|----------------|
| `ai-mistakes/no-placeholder-values` | `YOUR_API_KEY`, `REPLACE_ME`, `example.com` |
| `ai-mistakes/no-incomplete-code` | `# rest of implementation`, standalone `...`, `pass` |
| `ai-mistakes/no-mixed-syntax` | Python `def` in JS, `const` in Python, `console.log` in Python |
| `ai-mistakes/no-hallucinated-imports` | Commonly hallucinated package names |

### Code Quality (3 rules)

| Rule | What it catches |
|------|----------------|
| `code-quality/balanced-brackets` | Unclosed `()`, `[]`, `{}` |
| `code-quality/no-unused-imports` | Imported names not used in code |
| `code-quality/no-empty-blocks` | Empty function bodies, empty catch blocks |

### Custom Rules

```typescript
import { verify, defineRule } from "proof-ai";

const noFetch = defineRule({
  id: "custom/no-fetch",
  name: "No fetch calls",
  pattern: /\bfetch\s*\(/,
  message: "Direct fetch() calls are not allowed — use the API client",
  severity: "error",
  suggestion: "Use apiClient.get() instead of fetch()",
});

const result = await verify({
  code: myCode,
  language: "typescript",
  rules: [noFetch],
});
```

List all rules from the CLI:

```bash
npx proof-ai rules list
```

## Sandbox Security

When Docker is available, Proof runs code with hardened security defaults:

- **No network access** — containers run with `--network=none`
- **Memory limit** — 256MB max (`--memory=256m`)
- **CPU limit** — 0.5 CPUs (`--cpus=0.5`)
- **Process limit** — 64 PIDs (`--pids-limit=64`)
- **Read-only filesystem** — `--read-only` with tmpfs for `/tmp`
- **No privilege escalation** — `--security-opt=no-new-privileges`
- **Auto-cleanup** — containers are created with `--rm`

Network access is only enabled temporarily when `install` packages are specified.

## CI Integration

### GitHub Actions

```yaml
name: Verify AI Code
on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install proof-ai

      - name: Verify generated code
        run: npx proof-ai check ./src/generated/*.py --json
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npx proof-ai check ./src/generated/ --sandbox none
```

### In Your AI Pipeline

```typescript
import { verify } from "proof-ai";

async function generateAndVerify(prompt: string) {
  const llmResponse = await callLLM(prompt);

  const result = await verify({
    text: llmResponse,
    sandbox: "docker",
    rules: "all",
  });

  if (!result.passed) {
    // Retry, flag for review, or use a different model
    console.log("Issues found:", result.issues);
    return null;
  }

  return llmResponse;
}
```

## E2B Cloud Sandbox (Optional)

For serverless environments (Vercel, Cloudflare Workers) where Docker isn't available, Proof supports [E2B](https://e2b.dev) as a cloud sandbox:

```bash
npm install @e2b/code-interpreter
export E2B_API_KEY=your_key
```

```typescript
const result = await verify({
  code: myCode,
  language: "python",
  sandbox: "e2b",
});
```

## System Check

```bash
npx proof-ai doctor
```

```
  Proof Doctor
  ─────────────────────────────────

  ✓ Docker is available
  ○ E2B not configured (optional)
  ✓ Node.js v20.10.0

  ✓ Ready to verify code!
```

## Architecture

```
proof-ai/
├── src/
│   ├── index.ts          # Public API exports
│   ├── verify.ts         # Main verification pipeline
│   ├── extract.ts        # Code block extraction from markdown
│   ├── syntax.ts         # Offline syntax checking
│   ├── report.ts         # Terminal output formatting
│   ├── cli.ts            # CLI (proof verify, check, rules, doctor)
│   ├── sandbox/
│   │   ├── docker.ts     # Docker sandbox (default)
│   │   ├── e2b.ts        # E2B cloud sandbox (optional)
│   │   └── index.ts      # Auto-detection
│   └── rules/
│       ├── engine.ts     # Rule matching engine
│       ├── define.ts     # defineRule() helper
│       └── builtin/      # 10 built-in rules
│           ├── security.ts
│           ├── ai-mistakes.ts
│           └── code-quality.ts
├── test/                 # 72 tests
├── bin/proof.js          # CLI entry point
└── package.json          # 2 dependencies (chalk, commander)
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](LICENSE)

---

<p align="center">
  Built by <a href="https://altorlab.com">Altorlab</a> — we use Proof in production to verify every AI-generated code snippet before it reaches our users.
</p>
