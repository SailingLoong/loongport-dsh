# LoongPort DSH Setup CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish `loongport`, a Node CLI that safely configures one OpenAI-compatible LoongPort route for DeepSeek Harness.

**Architecture:** The CLI owns only user-requested DSH configuration. It writes the selected route into DSH's existing `llm-pi-ai` settings namespace and stores the API key in DSH's credential document. DSH's built-in `@deepseek-ai/dsh-llm-pi-ai` remains the sole LLM transport owner; this package does not reimplement streaming, tool calls, or retries.

**Tech Stack:** Node.js 20+, TypeScript, Commander, YAML, Vitest, tsup.

## Global Constraints

- Package name is `loongport`; npm distribution contains built `dist/` output only.
- API keys must never be accepted as a command-line argument or printed to stdout/stderr.
- Default DSH home is `$DSH_HOME`, falling back to `~/.dsh`.
- The command updates only its explicit `--route` under `llm-pi-ai.providers` and its explicit credential name; all unrelated YAML entries and existing provider routes are preserved.
- Mutating files requires `--write`; without it the command prints only a redacted plan.
- Only `http:` and `https:` base URLs without embedded credentials are accepted.
- Initial scope supports manually provisioned OpenAI-compatible endpoints; browser login, relay discovery, desktop-app bridging, and automatic tier switching are out of scope.

---

### Task 1: Package and command contract

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `src/cli.ts`
- Create: `src/options.ts`
- Test: `tests/options.test.ts`

**Interfaces:**
- Produces `parseSetupOptions(argv: string[], env: NodeJS.ProcessEnv): SetupOptions`.
- `SetupOptions` contains `baseUrl`, `route`, `credentialName`, `models`, `dshHome`, `write`, and `apiKey`.

- [ ] **Step 1: Write failing option tests**

```ts
expect(() => parseSetupOptions(['dsh', 'setup', '--base-url', 'ftp://example.com', '--model', 'm'], {}))
  .toThrow('base URL must use http or https')
expect(() => parseSetupOptions(['dsh', 'setup', '--base-url', 'https://example.com/v1', '--model', 'm'], {}))
  .toThrow('LOONGPORT_API_KEY is required')
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/options.test.ts`

Expected: the test fails because `parseSetupOptions` does not exist.

- [ ] **Step 3: Implement parsing and validation**

```ts
export interface SetupOptions {
  baseUrl: string
  route: string
  credentialName: string
  models: string[]
  dshHome: string
  write: boolean
  apiKey: string
}
```

Require at least one `--model`; read the secret only from `LOONGPORT_API_KEY`; normalize a trailing slash from the base URL.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm vitest run tests/options.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts src/cli.ts src/options.ts tests/options.test.ts
git commit -m "feat: add loongport dsh setup command"
```

### Task 2: DSH document mutation

**Files:**
- Create: `src/dsh-config.ts`
- Test: `tests/dsh-config.test.ts`

**Interfaces:**
- Consumes `SetupOptions` from `src/options.ts`.
- Produces `buildProviderProfile(options)`, `mergeSettings(text, options)`, and `mergeCredentials(text, options)`.

- [ ] **Step 1: Write failing merge tests**

```ts
expect(mergeSettings('other: true\nllm-pi-ai:\n  providers:\n    openai: {}\n', options))
  .toContain('openai: {}')
expect(mergeSettings(existing, options)).toContain('api: openai-completions')
expect(mergeCredentials('EXISTING: keep\n', options)).toContain('EXISTING: keep')
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/dsh-config.test.ts`

Expected: the test fails because the document helpers do not exist.

- [ ] **Step 3: Implement targeted YAML merges**

Use `yaml` documents to preserve unrelated document content. Set only:

```yaml
llm-pi-ai:
  providers:
    <route>:
      displayName: LoongPort
      apiKeyEnv: <credentialName>
      api: openai-completions
      baseURL: <baseUrl>
      models:
        - id: <model>
```

Write `<credentialName>: <apiKey>` only in the DSH credential document.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm vitest run tests/dsh-config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dsh-config.ts tests/dsh-config.test.ts
git commit -m "feat: write loongport route into DSH config"
```

### Task 3: Safe file application and CLI integration

**Files:**
- Create: `src/files.ts`
- Modify: `src/cli.ts`
- Test: `tests/cli.test.ts`

**Interfaces:**
- Consumes rendered settings and credentials text.
- Produces `applySetup(options): Promise<SetupResult>` with a redacted dry-run summary or both written file paths.

- [ ] **Step 1: Write failing CLI behavior tests**

```ts
await expect(runSetup(options)).resolves.toMatchObject({ written: false })
await expect(readFile(join(home, 'settings.yaml'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
await expect(runSetup({ ...options, write: true })).resolves.toMatchObject({ written: true })
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/cli.test.ts`

Expected: the test fails because no setup runner exists.

- [ ] **Step 3: Implement atomic file writes**

Create the DSH home if absent. Read existing YAML when present, write a temporary sibling file, then rename it. Create `.credentials.yaml` with owner-only mode and never include the key in command output.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm vitest run tests/cli.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/files.ts src/cli.ts tests/cli.test.ts
git commit -m "feat: apply DSH setup safely"
```

### Task 4: Package documentation and release verification

**Files:**
- Modify: `README.md`
- Create: `.npmignore`

- [ ] **Step 1: Document installation and security boundaries**

Include the exact invocation:

```bash
LOONGPORT_API_KEY='sk-…' npx loongport dsh setup \
  --base-url https://relay.example.com/v1 \
  --model model-id \
  --write
```

Explain that the command writes DSH's own credential store, preserves other routes, and does not automate third-party login or tier switching.

- [ ] **Step 2: Run the full quality gate**

Run: `pnpm test && pnpm lint && pnpm build && npm pack --dry-run`

Expected: all tests and type checks pass; package contents include only the built CLI, README, license, and manifest.

- [ ] **Step 3: Verify a packed install in a temporary directory**

Run:

```bash
pkg=$(npm pack --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].filename))")
tmp=$(mktemp -d)
npm install --prefix "$tmp" "./$pkg"
LOONGPORT_API_KEY=test "$tmp/node_modules/.bin/loongport" dsh setup --base-url https://relay.example.com/v1 --model test
```

Expected: installation succeeds and the command prints a redacted dry-run plan.

- [ ] **Step 4: Commit**

```bash
git add README.md .npmignore
git commit -m "docs: document DSH setup"
```

### Task 5: Public release

**Files:**
- Modify: `package.json` version only if release verification requires it.

- [ ] **Step 1: Inspect the final git diff and npm package contents**

Run: `git status --short && git diff --check && npm pack --dry-run`

Expected: only intended files are present; no secret, fixture credential, or source-only development artifact is packaged.

- [ ] **Step 2: Commit and push main**

Run:

```bash
git add -A
git commit -m "feat: publish LoongPort DSH setup CLI"
git push origin main
```

- [ ] **Step 3: Publish the verified package publicly**

Run: `npm publish --access public`

Expected: npm returns the immutable `loongport@0.1.0` release identifier.

- [ ] **Step 4: Add repository discovery metadata**

Set GitHub topics: `dsh-plugin`, `deepseek-harness`, `loongport`, `openai-compatible`; create a GitHub release for `v0.1.0` describing supported scope and limits.
