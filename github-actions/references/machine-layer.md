# 機械層の出力の実物

`github-actions` skill の機械層 (actionlint・zizmor・`gh actions-lock`) が実際に出す出力を集めた。コマンドと exit code の一覧は [SKILL.md](../SKILL.md) の「機械層」節にある。

サンプルは、ことわりが無ければ 2026-11-15 に検証用のリポジトリで取得した。バージョンは actionlint 1.7.12、zizmor 1.32.0、gh-actions-lock v0.4.1 である。actionlint と zizmor は `nix run nixpkgs#<名前> --` 経由で実行したので、サンプル直上のコマンドからその接頭辞を省いている。

## actionlint

取得したコマンド: `actionlint -oneline` (引数なしで `.github/workflows/` の全ファイルを検査する)

```text
.github/workflows/bad.yml:13:9: shellcheck reported issue in this script: SC2086:info:2:6: Double quote to prevent globbing and word splitting [shellcheck]
.github/workflows/bad.yml:13:31: "github.event.pull_request.title" is potentially untrusted. avoid using it directly in inline scripts. instead, pass it through an environment variable. see https://docs.github.com/en/actions/reference/security/secure-use#good-practices-for-mitigating-script-injection-attacks for more details [expression]
.github/workflows/withcheck.yml:10:11: input "no-such-input" is not defined in action "actions/checkout@v4". available inputs are "clean", "fetch-depth", (中略: 入力名の列挙が続く) "token" [action]
```

書式は `<ファイル>:<行>:<列>: <メッセージ> [<種別>]` で、exit code はこのとき 1 だった。

workflow が 1 つも無いリポジトリで引数なしの `actionlint -oneline` を実行すると、exit code は 3 になり、次の 1 行が出た。検査は行われていない。

```text
no project was found in any parent directories of "/home/ansanloms/dev/github.com/ansanloms/skills". check workflows directory is put correctly in your Git repository
```

## zizmor

取得したコマンド: `zizmor --format=github .` (token なし。抜粋で、`INFO`・`WARN` で始まるログ行と同種の行を省いた)

```text
::warning file=.github/workflows/bad.yml,line=9,title=artipacked::bad.yml:9: credential persistence through GitHub Actions artifacts: does not set persist-credentials: false
::warning file=.github/workflows/bad.yml,line=6,title=excessive-permissions::bad.yml:6: overly broad permissions: default permissions used due to no permissions: block
::error file=.github/workflows/bad.yml,line=3,title=dangerous-triggers::bad.yml:3: use of fundamentally insecure workflow trigger: pull_request_target is almost always used insecurely
::error file=.github/workflows/bad.yml,line=14,title=template-injection::bad.yml:14: code injection via template expansion: may expand into attacker-controllable code
::error file=.github/workflows/fulltag.yml,line=13,title=unpinned-uses::fulltag.yml:13: unpinned action reference: action is not pinned to a hash (required by blanket policy)
```

`title=` が監査の名前、`file=` と `line=` が場所である。exit code はこのとき 14 だった。監査の説明は `https://docs.zizmor.sh/audits/#<監査の名前>` にある。

ディレクトリを渡すと、zizmor は `.github/dependabot.yml` も監査する。

取得したコマンド: `zizmor --format=github .github` (token なし。workflow が無く、`cooldown` を設定していない `dependabot.yml` だけがあるリポジトリで実行した。`INFO`・`WARN` で始まるログ行を省いた)

```text
::warning file=.github/dependabot.yml,line=3,title=dependabot-cooldown::dependabot.yml:3: insufficient cooldown in Dependabot updates: insufficient implicit default-days (less than 7)
```

exit code はこのとき 13 だった。

指摘が無いときは `No findings to report. Good job!` と出て、exit code は 0 になる。存在しないパスを渡すと `fatal: no audit was performed` と出て、exit code は 1 になる。

token を付けた実行が参照先のリポジトリに届かないときの出力は次のとおり。

取得したコマンド: `GH_TOKEN="$(gh auth token)" zizmor --format=github .` (存在しないリポジトリの reusable workflow を参照する workflow に対して実行した)

```text
fatal: no audit was performed
'ref-confusion' audit failed on file://./.github/workflows/release.yml

Caused by:
    0: error in 'ref-confusion' audit
    1: couldn't list branches for octo-org/shared-workflows
    2: can't access octo-org/shared-workflows: missing or you have no access
```

exit code はこのとき 1 だった。

lockfile があるリポジトリでは、次の 1 行が出る。エラーではない。

```text
 WARN collect_inputs: zizmor::registry::input: one or more inputs uses a GitHub Actions workflow lockfile; see https://docs.zizmor.sh/usage/#workflow-lockfiles for details
```

## gh actions-lock

### lockfile の検証

取得したコマンド: `gh actions-lock --verify` (すべての workflow が lockfile に載っている状態)

```text
Scanning 3 workflows
All 3 workflows valid
```

取得したコマンド: `gh actions-lock --verify` (lockfile に無い `uses: actions/cache@v4` を `fulltag.yml` に足した状態。抜粋で、他の workflow の指摘を省いた)

```text
Scanning 3 workflows
3 of 3 workflows failed
✗ Not pinned actions/cache@v4
  used in workflow but not pinned in lockfile (actions/cache@v4)
  see: https://github.com/github/gh-actions-lock/blob/main/docs/troubleshooting.md#not-pinned
  ↳ .github/workflows/fulltag.yml
Re-run without --verify to apply fixes.
```

取得したコマンド: `gh actions-lock --verify --json` (同じ状態。抜粋で、`findings` と `workflows` を `fulltag.yml` の分だけに絞り、`workflows[].findings` の中身を省いた)

```json
{
  "cli_version": "v0.4.1",
  "lockfile_version": "v0.0.3",
  "valid": false,
  "findings": [
    {
      "workflow": ".github/workflows/fulltag.yml",
      "category": "not-pinned",
      "severity": "error",
      "confidence": "high",
      "dependency": "actions/cache@v4",
      "detail": "used in workflow but not pinned in lockfile (actions/cache@v4)",
      "remediation": "pin with `gh actions-lock`",
      "doc_url": "https://github.com/github/gh-actions-lock/blob/main/docs/troubleshooting.md#not-pinned"
    }
  ],
  "workflows": [
    {
      "path": ".github/workflows/fulltag.yml",
      "valid": false,
      "findings": ["(省略: 上の findings と同じ要素)"],
      "dependencies": [
        {
          "nwo": "actions/checkout",
          "ref": "v7.0.1",
          "sha": "3d3c42e5aac5ba805825da76410c181273ba90b1",
          "hash_algo": "sha1",
          "direct": true
        }
      ]
    }
  ]
}
```

`--json` を付けても、`Scanning 3 workflows` の行は JSON の前に出る。

workflow が 1 つも無いリポジトリでは、`--verify` と `--verify-local` のどちらも `no workflow files found in .github/workflows/` と出て、exit code は 2 になる。

### lockfile の生成

取得したコマンド: `gh actions-lock --no-interactive` (`ansanloms/skills` リポジトリで、`lint.yml` と `verify-lockfile.yml` を新しく書いた直後に実行した)

```text
Scanning 2 workflows
Planning pins
Pinned 2 actions across 2 workflows
  actions/checkout@v7.0.1 (3d3c42e)
    └─ .github/workflows/lint.yml
    └─ .github/workflows/verify-lockfile.yml
  actions/setup-node@v7.1.0 (949feb2)
    └─ .github/workflows/lint.yml
```

exit code は 0 で、`uses:` の書き換えは起きなかった。`uses: actions/checkout@v4` のような部分バージョンがあると、`@v4.4.0` のような完全なバージョンタグへ書き換わる。`@main` のようなブランチ参照は書き換わらず、そのまま lock される。

### lockfile の形

取得したコマンド: `gh actions-lock --no-interactive .github/workflows/fulltag.yml` を実行した後の `cat .github/workflows/actions.lock`

```yaml
# This file is machine-generated by `gh actions-lock`.
# Do not edit by hand; run `gh actions-lock` to update.
# Docs: https://gh.io/actions-lockfile
version: 'v0.0.3'
workflows:
    '.github/workflows/fulltag.yml':
        - 'actions/checkout@v7.0.1'
        - 'actions/setup-node@v6.0.0'
dependencies:
    'actions/checkout@v7.0.1':
        ref: 'v7.0.1'
        commit: 'sha1-3d3c42e5aac5ba805825da76410c181273ba90b1'
        owner_id: 44036562
        repo_id: 197814629
    'actions/setup-node@v6.0.0':
        ref: 'v6.0.0'
        commit: 'sha1-2028fbc5c25fe9cf00d9f06a71cc4710d4507903'
        owner_id: 44036562
        repo_id: 189476904
```

`workflows` のキーに載っている workflow が、onboard 済みの workflow である。
