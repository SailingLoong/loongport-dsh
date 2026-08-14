# loongport

`loongport` configures one LoongPort OpenAI-compatible route for [DeepSeek
Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH).

## Install

Run it directly with npm:

```bash
LOONGPORT_API_KEY='sk-…' npx loongport dsh setup \
  --base-url https://relay.example.com/v1 \
  --model model-id \
  --write
```

The API key is read only from `LOONGPORT_API_KEY`; do not place it on the
command line. You can repeat `--model` to register more than one model.

By default, the command performs a dry run. Add `--write` to update DSH's
configuration. It uses `$DSH_HOME` when set, otherwise `~/.dsh`, and writes:

- `settings.yaml`: one selected `llm-pi-ai.providers.<route>` entry
- `.credentials.yaml`: the selected credential name and API key (owner-only)

Other DSH settings, provider routes, and credentials are preserved. The
command uses DSH's built-in `llm-pi-ai` transport; it does not implement its
own streaming, retries, or tool calls.

## Options

```text
--base-url <url>              OpenAI-compatible HTTP(S) endpoint (required)
--model <id>                  Model to expose; repeat for multiple models (required)
--route <name>                DSH provider route (default: loongport)
--credential-name <name>      DSH credential key (default: LOONGPORT_API_KEY)
--write                       Apply changes; omitted means dry run
```

The initial release supports manually provisioned OpenAI-compatible endpoints.
It does not automate third-party browser login, relay discovery, desktop-app
bridging, or automatic tier switching.

## Maintainers

Agents and maintainers should read the [agent guide](docs/maintainers/agent-guide.md)
before changing the package and follow the [release runbook](docs/maintainers/releasing.md)
before publishing.

## License

[MIT](LICENSE)
