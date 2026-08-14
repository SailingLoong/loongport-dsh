# Release runbook

This runbook publishes `loongport` without relying on conversational context. Read
[`agent-guide.md`](agent-guide.md) first. Commands assume a clean, isolated worktree and the
repository root as the current directory.

Never place a real API key, npm token, cookie, OTP, Passkey material, or recovery code in a
command, file, log, issue, pull request, or release note.

## 1. Preflight

Confirm the branch and tools:

```bash
git fetch origin --prune
git status --short --branch
git log --oneline origin/main..HEAD
node --version
pnpm --version
npm --version
npm whoami
gh auth status
```

Requirements:

- Node.js is at least 20.
- `pnpm-lock.yaml` is the only dependency lockfile.
- npm and GitHub are authenticated as maintainers authorized for this public package and
  repository.
- the worktree contains no unrelated or uncommitted changes;
- the intended release changes have passed review and are reachable from `origin/main` before
  tagging or publishing.

Read the version from its owner:

```bash
release_version=$(node -p "require('./package.json').version")
release_tag="v${release_version}"
npm view loongport versions --json
git tag --list "$release_tag"
```

For a new release, `release_version` must not already appear in the registry list and
`release_tag` must not point at another commit. Never overwrite a published version or move an
existing release tag.

## 2. Build and verify the exact artifact

Install from the committed pnpm lockfile and run every gate:

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm test
pnpm run build
git diff --check
npm pack --dry-run --json
```

`tests/cli-boundary.test.ts` already packs the project, installs the resulting archive, runs the
installed executable, verifies dry-run behavior, and enforces the four-file package allowlist.
Still inspect the exact release archive independently:

```bash
audit_root=$(mktemp -d)
npm pack --json --pack-destination "$audit_root" > "$audit_root/pack.json"
archive_name=$(node -p "JSON.parse(require('fs').readFileSync('$audit_root/pack.json', 'utf8'))[0].filename")
archive_path="$audit_root/$archive_name"
tar -tzf "$archive_path" | sort
```

The archive must contain exactly:

```text
package/LICENSE
package/README.md
package/dist/cli.js
package/package.json
```

Extract and scan only the staged package:

```bash
mkdir "$audit_root/unpacked"
tar -xzf "$archive_path" -C "$audit_root/unpacked"
rg -n '(npm_[A-Za-z0-9]+|sk-[A-Za-z0-9]{8,}|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY)' \
  "$audit_root/unpacked" || true
```

Any match must be reviewed. Credential-shaped values or private-key material are a release
blocker.

Install the archive and exercise the real binary in dry-run mode:

```bash
install_prefix="$audit_root/install"
dsh_audit_root="$audit_root/dsh"
mkdir -p "$dsh_audit_root"
npm install --prefix "$install_prefix" "$archive_path" --ignore-scripts
LOONGPORT_API_KEY='audit-key-must-not-appear' DSH_HOME="$dsh_audit_root" \
  "$install_prefix/node_modules/.bin/loongport" dsh setup \
  --base-url https://relay.example.com/v1 \
  --model model-id > "$audit_root/dry-run.txt"
```

Verify redaction and the no-write boundary:

```bash
if rg -F 'audit-key-must-not-appear' "$audit_root/dry-run.txt"; then exit 1; fi
test ! -e "$dsh_audit_root/settings.yaml"
test ! -e "$dsh_audit_root/.credentials.yaml"
rg -n 'written: false|settings.yaml|credentials.yaml|model-id' "$audit_root/dry-run.txt"
```

Keep the archive path for publication comparison. Delete the temporary directory only after
post-publish verification, using its exact path rather than a broad glob.

## 3. Merge and tag the release commit

Merge the reviewed package pull request first. From the primary checkout:

```bash
git switch main
git pull --ff-only
git status --short --branch
release_version=$(node -p "require('./package.json').version")
release_tag="v${release_version}"
git tag -a "$release_tag" -m "loongport $release_version"
git push origin "$release_tag"
```

Run all of section 2 again from this exact tagged commit and use the newly created `audit_root`,
`archive_path`, and archive checks for publication. Do not reuse the candidate archive built from
the feature branch. A tag identifies one immutable release commit; do not retarget it after
publication.

## 4. Authenticate and publish to npm

Publish the verified package:

```bash
test -n "${archive_path:-}"
test -f "$archive_path"
npm publish "$archive_path" --access public
```

Publishing the already inspected archive keeps the registry payload identical to the artifact
verified in section 2. Rebuilding from the working directory at this point would create a second,
unverified artifact.

npm may print a web-authentication URL. Open that URL and authenticate with the configured
method:

- a Passkey/security-key flow asks for browser or device confirmation and does not generate a
  six-digit authenticator code;
- a TOTP authenticator flow supplies a short-lived code only when npm prompts for it.

Do not invent an OTP when the account is using a Passkey, and never copy authentication output
into repository files. npm documents these flows in
[Accessing npm using two-factor authentication](https://docs.npmjs.com/accessing-npm-using-2fa/)
and recommends configuring a security key through the website in
[Configuring two-factor authentication](https://docs.npmjs.com/configuring-two-factor-authentication/).

Do not create a bypass token merely to avoid interactive authentication. If authentication
fails, confirm `npm whoami`, registry selection, account policy, and the browser session, then
retry the same verified command.

## 5. Verify the public registry artifact

Query the registry rather than trusting the publish output:

```bash
release_version=$(node -p "require('./package.json').version")
npm view "loongport@$release_version" \
  name version description dist-tags.latest keywords repository.url homepage \
  dist.integrity dist.shasum --json
```

Pack and install the registry copy in a new temporary directory:

```bash
registry_audit_root=$(mktemp -d)
npm pack "loongport@$release_version" --json \
  --pack-destination "$registry_audit_root" > "$registry_audit_root/pack.json"
registry_archive_name=$(node -p "JSON.parse(require('fs').readFileSync('$registry_audit_root/pack.json', 'utf8'))[0].filename")
registry_archive_path="$registry_audit_root/$registry_archive_name"
tar -tzf "$registry_archive_path" | sort
npm install --prefix "$registry_audit_root/install" "$registry_archive_path" --ignore-scripts
mkdir "$registry_audit_root/dsh"
LOONGPORT_API_KEY='registry-audit-key-must-not-appear' \
  DSH_HOME="$registry_audit_root/dsh" \
  "$registry_audit_root/install/node_modules/.bin/loongport" dsh setup \
  --base-url https://relay.example.com/v1 \
  --model model-id > "$registry_audit_root/dry-run.txt"
```

Verify the registry binary does not expose the sentinel and does not write during dry-run:

```bash
if rg -F 'registry-audit-key-must-not-appear' "$registry_audit_root/dry-run.txt"; then exit 1; fi
test ! -e "$registry_audit_root/dsh/settings.yaml"
test ! -e "$registry_audit_root/dsh/.credentials.yaml"
```

Compare the registry package file list with the four-file allowlist. Investigate any integrity,
metadata, or behavior mismatch before announcing the release.

## 6. Publish and verify the GitHub Release

Create the release only for the pushed immutable tag:

```bash
gh release create "$release_tag" \
  --repo SailingLoong/loongport-dsh \
  --verify-tag \
  --title "loongport $release_tag" \
  --generate-notes
gh release view "$release_tag" --repo SailingLoong/loongport-dsh
```

Verify repository discoverability and ownership at their source:

```bash
gh repo view SailingLoong/loongport-dsh \
  --json defaultBranchRef,description,homepageUrl,repositoryTopics
```

The npm keywords and GitHub topics must cover `deepseek-harness`, `dsh`, `dsh-plugin`,
`loongport`, and `openai-compatible`. The GitHub description must identify the npm setup CLI
and DeepSeek Harness, and the repository homepage must point to the public DSH documentation.
Additional implementation topics such as `cli`, `npm`, and `typescript` are acceptable.

## 7. Coordinate user documentation

Before announcing a user-visible CLI change, verify:

- this repository's README;
- the Chinese and English README sections in
  [SailingLoong/LoongPort](https://github.com/SailingLoong/LoongPort);
- the public <https://loongport.dev/zh/dsh>, <https://loongport.dev/en/dsh>, and
  <https://loongport.dev/ja/dsh> pages;
- the production pages and sitemap after deployment.

Prepare and review documentation updates alongside the package change so public instructions do
not lag behind behavior. Exact private coordination order and local repository locations belong
to the maintainer workspace, not this public runbook.

## 8. Failure and recovery

- Before npm publication: fix the issue, re-run every artifact gate, and publish only a reviewed
  commit. Do not move a pushed tag to a different commit.
- After npm publication: published contents are immutable. Fix forward with a reviewed patch
  version and a new tag.
- If a published version is unsafe or unusable, consider `npm deprecate` with a clear replacement
  message while preparing the patch. Do not casually use `npm unpublish`; removal is disruptive
  and subject to registry policy.
- If GitHub Release creation fails after npm succeeds, retry the release operation for the same
  existing tag. Do not rebuild or republish the npm version.
- If user documentation deployment fails, keep the verified package and release intact, repair
  the documentation deployment, and verify production before announcing completion.

Record no incident credentials or authentication responses in issues or release notes.

## 9. Cleanup

Cleanup happens only after the feature commit is reachable from the long-lived branch:

```bash
git fetch origin --prune
feature_branch=$(git branch --show-current)
feature_tip=$(git rev-parse "$feature_branch")
test -n "$feature_branch"
test "$feature_branch" != main
test "$feature_branch" != master
git merge-base --is-ancestor "$feature_tip" origin/main
git status --short --branch
git worktree list --porcelain
```

If the ancestry check exits zero and the exact feature worktree is clean, remove that reported
worktree path, delete the merged local and remote feature branch, and run `git worktree prune`.
Never automate removal from an unresolved variable, broad directory, or glob. Preserve unrelated
changes in every other checkout.
