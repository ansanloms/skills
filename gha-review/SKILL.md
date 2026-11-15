---
name: gha-review
description: GitHub Actions の workflow・composite action・reusable workflow (`.github/workflows/*.yml`、`action.yml`) を検査し、サプライチェーン対策の穴を指摘で返す。actionlint・zizmor・`gh actions-lock` の機械層と、workflow lockfile による固定・`permissions`・トリガ・script injection・secrets・更新の規準による意味層で点検する。workflow を書き上げて確認する段階、既存 workflow の安全性を見直すとき、「workflow をレビューして」「Actions の設定を点検して」と頼まれたときに使う。workflow の新規作成や書き直しの代行、lockfile の生成・更新、GitHub Actions 以外の CI、リポジトリ設定の変更には使わない。
---

# gha-review

GitHub Actions の定義ファイルを検査し、指摘を返す。検査は 2 層で行う。機械層はツールの実行、意味層は本文の規準との突合である。

この skill はリポジトリの中のファイルを書き換えない。修正後の YAML も返さない。指摘は場所・規準・理由・出典の組で返し、直すのは依頼者である。理由: 権限・secrets・トリガの判断は、その workflow の目的を知る依頼者にしか下せない。

修正や lockfile の生成まで頼まれた場合も、検査だけを行う。報告の先頭で、修正と生成はこの skill の範囲外であると断る。依頼者が実行するコマンドは、該当する指摘の「直す方向」に書く。

固定の方式は workflow lockfile (`.github/workflows/actions.lock`) を前提にする。lockfile が固定しない箇所だけ、commit SHA と digest で固定する。

## 対象

- `.github/workflows/*.yml` と `*.yaml` (workflow と reusable workflow)
- `action.yml` と `action.yaml` (composite action)
- 関連して読むファイル: `.github/workflows/actions.lock`、`.github/dependabot.yml`、`CODEOWNERS` (`.github/`・リポジトリ直下・`docs/` のいずれか)

対象ファイルは依頼者が指定したものを使う。指定が無ければ、リポジトリ内の上記に当たるファイルすべてを対象にする。

対象を絞られた場合も、リポジトリ全体で決まる規準 (F6・F7・U1・U2) は判定する。F6 の判定には対象外の workflow も読む。読むのは `gh actions-lock --verify` を実行する job があるかを見るためだけで、対象外のファイルにある他の問題は指摘しない。

対象のファイルが 1 つも無いリポジトリでは、その事実を報告の先頭に書く。機械層は zizmor だけを実行し、関連して読むファイルのうち存在するものだけを規準に当てる。対象が無くて判定できなかった規準は、報告の「確認していない項目」に ID を並べる。

## 手順

1. 対象ファイルと、リポジトリの最上位 (`git rev-parse --show-toplevel`) を確定する。以降のコマンドは最上位を cwd にして実行する。
2. 機械層を実行する (「機械層」節)。実行できないツールは飛ばし、実行できなかった事実を報告に書く。
3. 意味層を行う (「規準」節)。対象ファイルを全文読み、規準を 1 項目ずつ当てる。機械層が拾った箇所も、規準に当たるなら規準の ID を付ける。
4. 報告する (「報告」節)。

## 機械層

3 つのツールを順に実行する。どれも読み取りだけの形で呼ぶ。

| ツール            | 見るもの                                                 | 無いときの確認                                           |
| ----------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| actionlint        | 構文、式の型、`needs`、action の inputs、`run:` の shell | `command -v actionlint`                                  |
| zizmor            | セキュリティの監査                                       | `command -v zizmor`                                      |
| `gh actions-lock` | lockfile と `uses:` の一致                               | `gh extension list` に `github/gh-actions-lock` があるか |

次のサンプルはどれも 2026-11-15 に検証用のリポジトリで取得した。バージョンは actionlint 1.7.12、zizmor 1.32.0、gh-actions-lock v0.4.1 である。actionlint と zizmor は `nix run nixpkgs#<名前> --` 経由で実行したので、サンプル直上のコマンドからその接頭辞を省いている。

### actionlint

```sh
actionlint -oneline <対象の workflow ファイル...>
```

渡すのは workflow のファイルだけにする。`action.yml` を渡すと workflow として読まれ、`jobs` や `on` が無いという構文の指摘が出る。composite action の中身は actionlint では未検査として、報告の「確認していない項目」に書く。

exit code は次のとおり (0・1・2・3 とも実測)。

| exit code | 意味                                |
| --------- | ----------------------------------- |
| 0         | 問題なし。出力も無い                |
| 1         | 問題あり                            |
| 2         | オプションが不正                    |
| 3         | 致命的エラー (ファイルが読めない等) |

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

読むときの注意が 3 つある。

- actionlint は shellcheck が PATH に無いと、警告も出さずに `run:` の検査を飛ばす。`command -v shellcheck` で有無を確かめ、無ければ「shell の検査は未実行」と報告する。
- action の `with:` の検証は `@v4` のような major タグの参照にしか効かない。`@v4.4.0` や `@v7.0.1` のような完全なバージョンタグでは、存在しない入力名を書いても指摘が出なかった。完全なバージョンタグで参照する action の入力名は未検査として、報告の「確認していない項目」に書く。
- actionlint のセキュリティ検査は、信頼できない入力の `run:` への直接使用と、`credentials:` への password 直書きだけである。固定・権限・トリガは見ない。

### zizmor

```sh
zizmor --format=github <対象ファイルまたはディレクトリ...>
```

zizmor は既定でオフラインで動く。`impostor-commit`・`known-vulnerable-actions`・`ref-confusion` の監査は GitHub API を使うので、token を渡したときだけ走る。`gh auth token` が成功する環境では `GH_TOKEN="$(gh auth token)"` を付けて実行し、付けなかった場合はこの 3 つが未実行であると報告する。この 3 つが走ったかどうかは出力からは分からないので、報告には token を付けたかどうかを書く。

token を付けた実行は、参照先のリポジトリに届かないと監査の全体が止まる。exit code は 1 で、指摘は 1 件も出ない。このときは token を外して実行し直し、上の 3 つが未実行であると報告する。

取得したコマンド: `GH_TOKEN="$(gh auth token)" zizmor --format=github .` (存在しないリポジトリの reusable workflow を参照する workflow に対して実行した)

```text
fatal: no audit was performed
'ref-confusion' audit failed on file://./.github/workflows/release.yml

Caused by:
    0: error in 'ref-confusion' audit
    1: couldn't list branches for octo-org/shared-workflows
    2: can't access octo-org/shared-workflows: missing or you have no access
```

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

exit code のうち実測したのは次の 4 つである。

| exit code | 意味                                                                                  |
| --------- | ------------------------------------------------------------------------------------- |
| 0         | 指摘なし。`No findings to report. Good job!` と出る                                   |
| 1         | 監査を実行できなかった。存在しないパスを渡すと `fatal: no audit was performed` と出る |
| 13        | 指摘あり (最も重い指摘の severity が medium)                                          |
| 14        | 指摘あり (最も重い指摘の severity が high)                                            |

次は実測しておらず、[zizmor の docs](https://docs.zizmor.sh/usage/) からの引用である。2 は引数の解析の失敗、3 は入力が 1 つも集まらなかった場合、11・12 は指摘ありで、最も重い指摘の severity が順に informational・low の場合を表す。

lockfile の有無で `unpinned-uses` の出方が変わる。zizmor の lockfile 対応は v1.32.0 からで、docs は experimental と書いている。

- lockfile が無いリポジトリでは、完全なバージョンタグ (`@v7.0.1`) も `unpinned-uses` の対象になる。これは規準 F1 (lockfile に未 onboard) の指摘として扱い、zizmor の設定で消さない。
- lockfile があるリポジトリでは、lockfile に載った参照は `unpinned-uses` の対象から外れる。`@main` のようなブランチ参照も外れた。ブランチ参照は zizmor では拾えないので、規準 F2 で見る。
- lockfile があると、次の 1 行が出る。エラーではない。

  ```text
   WARN collect_inputs: zizmor::registry::input: one or more inputs uses a GitHub Actions workflow lockfile; see https://docs.zizmor.sh/usage/#workflow-lockfiles for details
  ```

### gh actions-lock

```sh
gh actions-lock --verify-local
gh actions-lock --verify
```

`--verify-local` はネットワークを使わず、すべての `uses:` が lockfile に載っているかだけを見る。`--verify` はネットワークを使い、記録された commit の出所まで検査する。どちらもリポジトリの中のファイルを書き換えない (実行の記録は `~/.cache/gh-actions-lock/logs/` に書かれる)。exit code はすべて通れば 0、1 件でも落ちれば 1 だった。workflow が 1 つも無いリポジトリでは、どちらも exit code が 2 になり、`no workflow files found in .github/workflows/` と出た。

引数なしの `--verify` はリポジトリのすべての workflow を検査する。対象を絞られた場合も引数なしで実行し、全体を検査した事実を報告の実行状況に書く。指摘に使うのは、対象のファイルに関わる行だけである。

この skill は書き込むモードを実行しない。`gh actions-lock` (引数なし)・`--relock`・`--accept-moved`・`--migrate-local-actions` がそれに当たる。必要なら、依頼者が実行するコマンドとして指摘に書く。

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

lockfile そのものの形は次のとおり。取得したコマンド: `gh actions-lock --no-interactive .github/workflows/fulltag.yml` を実行した後の `cat .github/workflows/actions.lock`

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

## 規準

各項目は「満たすべき状態」と理由を書く。1 つの項目が複数の条件を並べている場合は、どれか 1 つでも欠ければその項目に反する。出典の番号は「出典」節を指す。

F6・F7・U1 は、workflow が 1 つ以上あるリポジトリで判定する。workflow が無ければ指摘にせず、報告の「確認していない項目」に書く。理由: 3 つとも workflow を守るための規準で、守る対象が無いリポジトリでは反していても害が出ない。

### 固定 (F)

- F1: 対象の workflow がすべて lockfile に onboard されている。`gh actions-lock --verify` が通り、lockfile が git に追跡されている。
  - 追跡は `git ls-files --error-unmatch .github/workflows/actions.lock` で確かめる。追跡されていれば exit code は 0 になる。
  - 理由: tag と branch は付け替えられる。lockfile があると、runner は tag が動いても記録済みの commit を実行する。推移的な依存 (composite action が中で使う action) も記録される[1][2]。tag の付け替えは 2025-03 の tj-actions/changed-files と 2026-03 の trivy-action で実際に起きた[9][10]。
- F2: `uses:` の参照が完全なバージョンタグ (`@v7.0.1` の形) である。`@v4` のような部分バージョンと、`@main` のようなブランチ参照を残さない。
  - 理由: `gh actions-lock` は部分バージョンを完全タグへ書き換えるが、ブランチ参照はそのまま lock する。README は動く参照を古い commit へ戻す lockfile の変更を検出できないと書いている[2]。
- F3: 別リポジトリの reusable workflow (`jobs.<job_id>.uses`) を、40 桁の commit SHA で参照している。行末にバージョンのコメントを付ける。
  - 理由: lockfile は reusable workflow の呼び出しを固定しない[1]。
- F4: container image (`container:`・`services:`・`uses: docker://`) を `@sha256:` の digest で参照している。
  - 理由: lockfile は container image を固定しない[2]。
- F5: `action.yml` の中の `uses:` を、40 桁の commit SHA で参照している。
  - 理由: composite action の定義は、workflow から使われたときに間接的に lock されるだけで、定義そのものは lock できない[3]。
  - local action (`./` で始まる参照) が外部の action を使っていると、`gh actions-lock` はエラーにする。該当すれば F5 の指摘として書き、[2]の Limitations を示して依頼者に判断を仰ぐ。
- F6: pull request で `gh actions-lock --verify` を実行する workflow がある。拡張の導入は `--pin <バージョン>` でバージョンを固定している。
  - 理由: `uses:` を足して lockfile を更新し忘れた変更を、マージ前に止める[2]。
- F7: `CODEOWNERS` が `.github/workflows/` を対象にしている (`actions.lock` を含む)。
  - 理由: 盗まれたアカウントから workflow を足す攻撃は、固定では防げない。workflow の変更にレビューを要求することが対策になる[4][11]。
- F8: `run:` の中で導入するツールのバージョンを固定している。`curl ... | bash` で最新版を取る形や、`version: latest` を残さない。
  - 理由: action を固定しても、実行時に取ってくるものが動けば同じ穴が残る。

### 権限 (P)

- P1: workflow の最上位に `permissions: {}` (または `contents: read`) があり、書き込みの権限は必要な job にだけ宣言している。
  - 理由: `permissions:` を 1 つでも指定すると、未指定の権限は `none` になる[5]。GitHub は既定を contents の read だけにして必要な job で引き上げる運用を勧めている[4]。`permissions: {}` を起点にする書き方そのものは公式の推奨文言には無く、この skill の規準である。
- P2: `permissions: write-all` と `read-all` を使っていない。
- P3: `id-token: write` は、OIDC を使う job にだけある。

### トリガ (T)

- T1: `pull_request_target` を使っていない。使う場合は、PR 側のコードを checkout しておらず、`actions/checkout` の `allow-unsafe-pr-checkout` も使っていない。
  - 理由: `pull_request_target` は fork からの PR でも読み書きできる token で動く[5]。Nx の事例 (2025-08) はこのトリガと script injection の組み合わせで publish 用の token まで届いた[12]。
  - 公開リポジトリでは 2026-12-02 から既定でブロックされ、使うには Actions の event policy での許可が要る[6]。
- T2: `workflow_run` で起動する workflow が、起動元のコードを checkout していない。起動元の artifact は信頼できない入力として扱っている[4]。
- T3: fork の PR のコードを、`run:` の中の `git`・`gh` で取得していない。
  - 理由: `actions/checkout` v7 は fork の PR の checkout を既定で拒否するが、`run:` での取得と `issue_comment` などのイベントは保護の範囲外である[7]。

### injection (I)

- I1: 信頼できない値を、`run:` と `actions/github-script` の `script:` に `${{ }}` で直接埋めていない。`env:` で受け、shell では二重引用符で囲んだ変数として使っている。
  - 信頼できない値の例: `github.event.pull_request.title`・`github.event.pull_request.body`・`github.event.issue.title`・`github.event.comment.body`・`github.event.head_commit.message`・`github.head_ref`。
  - 理由: `${{ }}` は shell が動く前に展開されるので、値に含まれるコマンドがそのまま実行される[4]。
- I2: 信頼できない値を `$GITHUB_ENV` と `$GITHUB_PATH` に書いていない。
  - 理由: 後続の step の環境と実行ファイルの探索順を書き換えられる (zizmor の `github-env`)。

### secrets (S)

- S1: クラウドと registry の認証に、長寿命の secret ではなく OIDC を使っている。npm への publish は trusted publishing を使っている。
  - 理由: OIDC の token は job ごとに発行され、短時間で失効する[8]。
- S2: `actions/checkout` に `persist-credentials: false` を付けている。
  - 理由: 既定は `true` で、token が `.git/config` に残る。後続の step と artifact から読める (zizmor の `artipacked`)。
- S3: reusable workflow の呼び出しで `secrets: inherit` を使わず、必要な secret を名前で渡している (zizmor の `secrets-inherit`)。
- S4: secret は使う step の `env:` で渡している。workflow と job の `env:` に置いていない。
  - 理由: job の `env:` に置くと、その job が使うすべての action から読める。
  - 対象は `secrets.*` で参照する値である。自動で発行される `github.token` は対象にせず、権限の広さを P1 で見る。
- S5: デプロイと publish の job が `environment:` を指定している。
  - 理由: environment には承認者を設定でき、承認されるまで job は secret を読めない[4]。
- S6: 公開リポジトリで self-hosted runner を使っていない[4]。
- S7: 書き込み権限や secret を持つ workflow が、PR から書き込める cache を復元していない (zizmor の `cache-poisoning`)。

### 更新 (U)

- U1: `.github/dependabot.yml` に `package-ecosystem: github-actions` がある。
  - 理由: 固定した参照は自分では進まない。Dependabot は onboard 済みの workflow の更新 PR で lockfile の entry も一緒に更新する[1]。
  - 固定したままだと、安全側の既定値も届かない。`actions/checkout` v7 の保護は完全タグや SHA で固定した workflow には更新するまで効かない[7]。
- U2: Dependabot の cooldown を 0 にしていない。
  - 理由: 2026-07-14 から、version updates は公開の 3 日後まで PR を作らない。公開直後に見つかる侵害を避ける働きがある[13]。
  - zizmor の `dependabot-cooldown` は、`default-days` が 7 未満の場合と未設定の場合を指摘する。U2 より厳しい基準なので U2 には当てず、機械層だけが拾った指摘として書く。

### ファイルから確認できない項目

次はリポジトリや organization の設定にあり、ファイルを読んでも分からない。確認していない項目として報告に並べ、依頼者に確かめてもらう。

- `gh actions-lock --verify` の job が required check になっているか
- default branch への直接の push を禁じているか、code owner の承認を必須にしているか
- environment に承認者が設定されているか
- Actions の policy で Require lockfile を有効にしているか
- workflow の既定の token 権限が read-only になっているか

## 報告

次の 3 つを、この順で返す。

1. 機械層の実行状況: ツールごとに、実行したコマンド・exit code・実行できなかった場合はその理由。zizmor をオフラインで実行したか、shellcheck があったかも書く。
2. 指摘: 1 件ごとに次を書く。重い順に並べる。
   - 場所 (`<ファイル>:<行>`)
   - 規準の ID (機械層だけが拾い、規準に当たらないものは、ツールの名前と監査・種別の名前)
   - 何が規準に反しているか
   - 理由と出典
   - 直す方向 (文で書く。修正後の YAML は書かない)
3. 確認していない項目:「ファイルから確認できない項目」と、機械層で実行できなかった検査。

指摘が 0 件なら、その事実と、何を検査したかを書く。実行できなかった機械層のツールがある場合は、どのツールが未実行で、結果がどの層に基づくかを先頭に書く。

重さは次の 2 段で付ける。

- 必須: F・P・T・I の規準に反するもの。
- 推奨: S・U の規準に反するもの。

重さは規準の ID で決める。機械層がその箇所を通していても、warning として出していても変えない。lockfile に載った `@main` は `gh actions-lock --verify` も zizmor も通すが、F2 に反するので必須である。規準に当たらず機械層だけが拾った指摘は、ツールが error として出したものを必須、それ以外 (warning・info・notice) を推奨にする。

指摘の付け方は次のとおり。

- 同じ箇所が複数の規準に当たるときは、1 件にまとめて ID を併記する。重さは重い方を採る。
- 同じ規準に反する箇所が複数あるときは、1 件にまとめて場所を列挙する。
- ファイルが無いことの指摘 (`CODEOWNERS` が無い等) は、場所に「該当ファイルなし」と、あるべきパスを書く。
- 規準に反するかどうかがファイルから決まらない箇所は、指摘にせず「確認していない項目」に書く。リポジトリが公開かどうかで決まる S6 がその例である。
- 反する箇所が無かった規準は、指摘の末尾に ID だけを 1 行で並べる。
- 出典の番号が付いていない規準に反する指摘は、理由だけを書く。

## 出典

ツールと GitHub の仕様が変わっていく領域なので、規準を当てる前に、対象のリポジトリが使うバージョンと下の出典の内容が食い違っていないかを見る。取得日はすべて 2026-11-15。

1. [Workflow dependency lockfiles](https://docs.github.com/en/actions/concepts/security/workflow-dependency-lockfiles) (GitHub Docs)
2. [github/gh-actions-lock](https://github.com/github/gh-actions-lock) の README (v0.4.1)
3. [zizmor: GitHub Actions workflow lockfiles](https://docs.zizmor.sh/usage/#workflow-lockfiles)
4. [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use) (GitHub Docs)
5. [Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) (GitHub Docs)
6. [pull_request_target blocked by default December 2](https://github.blog/changelog/2026-11-02-pull_request_target-blocked-by-default-december-2) (GitHub Changelog)
7. [Safer pull_request_target defaults for GitHub Actions checkout](https://github.blog/changelog/2026-06-18-safer-pull_request_target-defaults-for-github-actions-checkout) (GitHub Changelog)
8. [OpenID Connect](https://docs.github.com/en/actions/concepts/security/openid-connect) (GitHub Docs)
9. [GHSA-mrrh-fwg8-r2c3](https://github.com/advisories/GHSA-mrrh-fwg8-r2c3) (tj-actions/changed-files)
10. [GHSA-69fq-xp46-6x23](https://github.com/advisories/GHSA-69fq-xp46-6x23) (trivy-action)
11. [GhostAction Campaign](https://www.stepsecurity.io/blog/ghostaction-campaign-over-3-000-secrets-stolen-through-malicious-github-workflows) (StepSecurity。ベンダーの記事)
12. [GHSA-cxm3-wv7p-598c](https://github.com/nrwl/nx/security/advisories/GHSA-cxm3-wv7p-598c) (Nx)
13. [Dependabot version updates introduce default package cooldown](https://github.blog/changelog/2026-07-14-dependabot-version-updates-introduce-default-package-cooldown/) (GitHub Changelog)
