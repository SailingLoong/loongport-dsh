# Agent guide

This document is the canonical technical context for agents maintaining `loongport`. Read it
before changing the package. For publication steps, also read
[`releasing.md`](releasing.md).

## Purpose and boundary

`loongport` is a DeepSeek Harness (DSH) Cordis bundle with a Settings → LoongPort client page,
a verified provider host service, and a Node.js CLI for advanced custom endpoints. The host
configures DSH's built-in `llm-pi-ai` provider adapter; DSH remains responsible for HTTP
transport, streaming, tool calls, retries, and model execution.

The package deliberately does not implement:

- browser or desktop login;
- relay discovery or provisioning;
- desktop-application bridging;
- automatic tier or route switching;
- a second OpenAI-compatible transport stack.

Do not expand those boundaries without a separately reviewed product design.

For bundle users, the signed LoongPort v2 directory is the sole authority for provider identity,
entry URL, invitation code, API base URL, models, sponsorship disclosure, disabled state, and
authorization capability. VeriDrop observations are display-only health data: they must never
select a site, override directory fields, change a provider, or configure credentials. The
client opens registration/login only as an external browser link; it never automates a third-party
login or reads browser/session data. DSH credentials own every API key. The client/store may
retain only `{ configured: boolean }` credential state.

## User contract

The normal installation path is:

```bash
dsh plugin --profile <profile> add loongport
```

After installation, users select a site in **Settings → LoongPort**, follow its policy-backed
registration or login link when needed, manually create an API key, select a listed model, and
save. The current default directory site is DeepSeek's official API (`https://api.deepseek.com/v1`)
with `deepseek-v4-flash` and `deepseek-v4-pro` (Flash is selected by default); BestAPI
(`https://api.bestapi.store/v1`) is the verified relay entry. This is a directory
policy fact, not a hard-coded UI fallback.

The CLI is an advanced custom-endpoint path:

The command is:

```bash
LOONGPORT_API_KEY='your-api-key' npx loongport dsh setup \
  --base-url https://relay.example.com/v1 \
  --model model-id
```

It is a redacted dry-run unless `--write` is present. Supported options are:

| Option | Contract |
| --- | --- |
| `--base-url <url>` | Required HTTP(S) OpenAI-compatible endpoint. Embedded credentials are rejected; trailing slashes are removed. |
| `--model <id>` | Required and repeatable. IDs must be non-empty and unique. |
| `--route <name>` | DSH provider-route key; defaults to `loongport`. |
| `--credential-name <name>` | DSH credential-map key and `apiKeyEnv` reference; defaults to `LOONGPORT_API_KEY` and must be a valid environment-variable name. |
| `--write` | Applies the change. Omission must never mutate the filesystem. |

The real API key always comes from the `LOONGPORT_API_KEY` environment variable. The
`--credential-name` option changes the name stored in DSH's provider profile; it is not the
environment variable from which this CLI reads the secret.

`DSH_HOME` selects the DSH configuration directory. If it is unset, the package uses
`~/.dsh`. The two owned write targets are:

- `$DSH_HOME/settings.yaml`
- `$DSH_HOME/.credentials.yaml`

## DSH configuration contract

For the selected route, the package writes this shape under
`llm-pi-ai.providers.<route>`:

```yaml
displayName: LoongPort
apiKeyEnv: LOONGPORT_API_KEY
api: openai-completions
baseURL: https://relay.example.com/v1
models:
  - id: model-id
```

The selected credential name maps to the real key in `.credentials.yaml`. The package replaces
only the selected provider route and selected credential entry. It preserves every unrelated
top-level setting, `llm-pi-ai` setting, provider route, and credential.

The DSH schema is an external contract. Before changing this shape, verify it against the
current official DeepSeek Harness source and its `@deepseek-ai/dsh-llm-pi-ai` package. Do not
infer the contract from generated website JavaScript or add compatibility fields speculatively.

## Safety invariants

These are product behavior, not implementation suggestions:

- Dry-run performs no directory or file writes.
- Output and errors never contain the API key or raw underlying error messages that may contain
  it.
- A base URL cannot contain username/password credentials.
- Both YAML documents are parsed and rendered before either target is changed.
- Each target is staged in the DSH directory and activated with `rename`.
- Credentials are activated before settings, so a settings-activation failure cannot expose an
  active provider without a committed credential.
- Temporary staged files are removed after success or failure.
- `.credentials.yaml` is written with mode `0600`.
- Invalid input and invalid YAML leave existing target files unchanged.

The two-file update is ordered and failure-aware, but it is not a transactional filesystem
operation across both files. Do not describe it as a cross-file atomic transaction.

## Code ownership

| Path | Single responsibility |
| --- | --- |
| `src/options.ts` | Parse and validate CLI/environment input; resolve DSH home and defaults. |
| `src/dsh-config.ts` | Pure provider-profile construction and targeted YAML merges. |
| `src/files.ts` | Dry-run boundary, reads, staging, permissions, ordered activation, cleanup, and safe application errors. |
| `src/cli.ts` | Executable entrypoint, orchestration, redacted human output, and exit status. |
| `tests/options.test.ts` | CLI validation and normalization contract. |
| `tests/dsh-config.test.ts` | Provider schema and targeted preservation contract. |
| `tests/cli.test.ts` | Filesystem safety, ordering, permissions, and failure behavior. |
| `tests/cli-boundary.test.ts` | Packed artifact, installed binary, no-write dry-run, and secret-boundary tests. |

Keep dependencies flowing in that direction: the CLI orchestrates options and files; files use
the pure YAML helpers; pure helpers do not know about the filesystem or process globals. If a
small change needs unrelated edits across most of these files, re-check the responsibility
boundary before adding special cases.

## Package and artifact contract

- Runtime: Node.js 20 or newer.
- Package manager and lockfile owner: pnpm with `pnpm-lock.yaml`.
- npm remains the registry and packaging CLI.
- The executable is `dist/cli.js` and the installed command is `loongport`.
- `cordis.patch.yml` inserts two rows: the package root (`loongport`) and the isolated host
  service (`loongport/host`). The root exports a no-op Cordis `apply()` solely so DSH can scan
  the package-root `dsh.client` metadata and resolve `exports["./client"]`; do not import the
  host runtime from that root entry.
- The published artifact contains exactly `LICENSE`, `README.md`, `cordis.patch.yml`,
  `dist/cli.js`, `dist/client/index.js`, `dist/host/index.js`, `dist/index.js`, and
  `package.json`.
- Source, tests, plans, and maintainer documentation are excluded by `.npmignore`.

Do not introduce `package-lock.json`; use `pnpm install --frozen-lockfile` for reproducible
installs.

## Public integration points

- Package repository: <https://github.com/SailingLoong/loongport-dsh>
- npm package: <https://www.npmjs.com/package/loongport>
- Main LoongPort repository: <https://github.com/SailingLoong/LoongPort>
- User documentation: <https://loongport.dev/zh/dsh>, <https://loongport.dev/en/dsh>, and
  <https://loongport.dev/ja/dsh>

User-visible CLI changes normally require checking the package README, the main LoongPort
README in both languages, and all three website locales. The website repository, maintainer
coordination order, and private planning locations do not belong in this public repository.

Before accepting a DSH contract change, perform the packed-bundle smoke test with the installed
tarball and inspect `dsh --dump-config`. Confirm the bundle resolves both rows, the client root
and host subpath remain separate, the signed directory verifies, and a VeriDrop outage cannot
alter configuration.

For discoverability, the npm keywords and GitHub topics must continue to cover
`deepseek-harness`, `dsh`, `dsh-plugin`, `loongport`, and `openai-compatible`. Treat
`package.json` as the owner of npm keywords and GitHub as the owner of repository topics.

## Query mutable facts

Do not copy a current version, latest tag, registry integrity, topic list, or upstream commit
into another guide. Query the owner when needed:

```bash
node -p "require('./package.json').version"
npm view loongport name version dist-tags.latest repository homepage dist.integrity --json
gh repo view SailingLoong/loongport-dsh --json defaultBranchRef,description,homepageUrl,repositoryTopics
gh release list --repo SailingLoong/loongport-dsh
git ls-remote https://github.com/deepseek-ai/deepseek-harness.git HEAD
```

The last command reports current upstream state; it does not authorize changing the DSH
contract. Contract changes require source review and tests.

## Information classification

This public repository may contain architecture, interfaces, tests, public URLs, public release
commands, and generic security guidance. It must not contain:

- credentials, token values, cookies, sessions, OTPs, recovery codes, or Passkey material;
- personal authentication storage or account-recovery details;
- maintainer home-directory paths;
- private repository URLs, private plan/issue links, or unpublished product information.

If a future agent needs private maintainer context, it must use the maintainer workspace rather
than copying that context here.
