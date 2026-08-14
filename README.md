# loongport

`loongport` is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
(DSH) Cordis bundle for verified LoongPort OpenAI-compatible providers. It also includes an
advanced CLI for custom endpoints.

## Install in DeepSeek Harness

Install the public package into the DSH profile you use:

```bash
dsh plugin --profile <profile> add loongport
```

Open **Settings → LoongPort** in DSH, then:

1. Select a verified provider. The default is BestAPI at
   `https://api.bestapi.store/v1`.
2. If you need an account, use the provider's **Register** or **Sign in** link. It opens the
   provider's own website in your browser.
3. Generate an API key with the provider and paste it into the dialog.
4. Select `deepseek-v4-flash` or `deepseek-v4-pro`, then save.

The signed LoongPort directory is the authority for provider identity, URLs, available models,
and any published invitation code. VeriDrop data, when shown, is only a display-only health
observation and cannot change provider configuration. DSH credentials store API keys; the
Settings page only retains whether a key is configured.

Version 0.2.0 does not automate browser authorization, collect browser sessions, or access
cookies/local storage. Registration/login and API-key creation remain on the provider's site.

## Advanced custom endpoint

For a manually supplied OpenAI-compatible endpoint, run the CLI directly:

```bash
LOONGPORT_API_KEY='your-api-key' npx loongport dsh setup \
  --base-url https://relay.example.com/v1 \
  --model model-id \
  --write
```

The API key is read only from `LOONGPORT_API_KEY`; never place it in a command argument. You
can repeat `--model` to register more than one model.

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

The CLI remains an explicit advanced path. It supports manually provisioned
OpenAI-compatible endpoints, but does not automate third-party browser login, relay discovery,
desktop-app bridging, or automatic tier switching.

## Maintainers

Agents and maintainers should read the [agent guide](docs/maintainers/agent-guide.md)
before changing the package and follow the [release runbook](docs/maintainers/releasing.md)
before publishing.

## License

[MIT](LICENSE)
