# AGENTS.md

All agents working in this repository must read and follow:

1. [`docs/maintainers/agent-guide.md`](docs/maintainers/agent-guide.md) before changing code,
   tests, package metadata, or documentation.
2. [`docs/maintainers/releasing.md`](docs/maintainers/releasing.md) before publishing or changing
   npm/GitHub release metadata.

Higher-level instructions supplied by the surrounding workspace or agent runtime still apply.
When instructions conflict, follow the higher-level rule.

## Hard constraints

- API keys come only from `LOONGPORT_API_KEY`; never add a CLI key argument or print a key.
- Dry-run is the default. File mutation requires an explicit `--write`.
- Preserve unrelated DSH YAML, provider routes, and credentials.
- Keep transport behavior in DeepSeek Harness's built-in `llm-pi-ai` adapter. This package only
  configures it.
- Never commit tokens, keys, cookies, session data, Passkey material, OTPs, recovery codes, or
  maintainer-specific authentication details.
- Do not bump the package version for documentation-only changes.

## Required verification

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm test
pnpm run build
npm pack --dry-run --json
```

The published tarball allowlist is enforced by `tests/cli-boundary.test.ts`. Maintainer guides
are intentionally excluded from the npm package.
