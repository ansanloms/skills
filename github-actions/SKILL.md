---
name: github-actions
description: GitHub Actions の workflow・composite action・reusable workflow (`.github/workflows/*.yml`、`action.yml`) を書く・直す・検査するときの規準と手順。workflow lockfile による action の固定、`permissions`、トリガ、script injection、secrets、依存の更新について満たすべき状態を定め、actionlint・zizmor・`gh actions-lock` で確かめる。workflow を新しく書くとき、既存の workflow に job や step を足す・直すとき、「workflow をレビューして」「Actions の設定を点検して」と頼まれたときに使う。GitHub Actions 以外の CI、リポジトリや organization の設定の変更には使わない。
---

# github-actions

GitHub Actions の定義ファイルが満たすべき状態 (規準) と、それを書く手順・検査する手順を定める。規準は 1 つである。書くときは規準を満たすように書き、検査するときは規準と突き合わせる。

固定の方式は workflow lockfile (`.github/workflows/actions.lock`) を前提にする。lockfile が固定しない箇所だけ、commit SHA と digest で固定する。

誰が最初に書くか (エージェントが書くか、依頼者の下書きを待つか) は、この skill は決めない。呼び出し側の指示に従う。commit と push も、この skill は行わない。

## 対象

- `.github/workflows/*.yml` と `*.yaml` (workflow と reusable workflow)
- `action.yml` と `action.yaml` (composite action)
- 関連して読むファイル: `.github/workflows/actions.lock`、`.github/dependabot.yml`、`CODEOWNERS` (`.github/`・リポジトリ直下・`docs/` のいずれか)

## 使い分け

- 書く: 頼まれたのが workflow の新設や変更である場合。「書く手順」に従う。
- 検査する: 頼まれたのが点検やレビューである場合。「検査する手順」に従う。ファイルは書き換えない。
- 両方:「レビューして直して」のように両方を頼まれた場合。先に検査の報告を出し、続けて書く手順で直す。
  - 直すのは、直し方がファイルから決まる指摘だけにする。依頼者の意図が要る指摘 (認証の方式、トリガ、権限の引き上げ、owner、解決できない参照の扱いなど) は直さず、質問として残す。
  - 報告に並べる順は次のとおり。検査の報告 (修正前の状態)、変更したこと、依頼者への質問、修正後の機械層の実行状況。検査の報告の指摘には 1 件ごとに「修正済み」か「未修正」を付ける。

どの場合も、コマンドはリポジトリの最上位 (`git rev-parse --show-toplevel`) を cwd にして実行する。

## 書く手順

1. 現状を読む。`.github/` の下の workflow・`actions.lock`・`dependabot.yml` と `CODEOWNERS` を読み、`git status --short` で作業前の未コミットの変更を控える。
2. 意図を確かめる。次のうち依頼から読み取れない項目だけを依頼者に尋ねる。推測で埋めない。
   - 何をトリガに動かすか
   - リポジトリへの書き込みなど、read を超える権限が要る操作があるか
   - secret やクラウドの認証を使うか
   - デプロイや publish を行うか
3. 規準を満たすように書く。「最小の例」をもとにする。
   - action は完全なバージョンタグで参照する。最新のタグは `gh api repos/<owner>/<repo>/releases/latest --jq .tag_name` で確かめ、記憶で書かない。
   - action の入力名は `gh api "repos/<owner>/<repo>/contents/action.yml?ref=<タグ>" --jq .content | base64 -d` で確かめる。理由: 完全なバージョンタグで参照する action の入力名を、actionlint は検証しない。
   - リポジトリの既存の workflow が使っている action を、同じタグと同じ入力で使う場合は、上の 2 つを確かめ直さなくてよい。
   - 既存の参照を固定し直すとき (`@v6` を完全なバージョンタグや SHA にする等) は、いまの参照が指す major を保つ。major を上げるのは、依頼された場合だけにする。理由: major の更新は挙動を変えうる。
   - action の外にある要件 (registry の認証方式、CLI に必要なバージョンなど) は、そのサービスの現行のドキュメントで確かめる。確かめられなかった要件は、報告の「依頼者に確かめてほしい項目」に書く。
   - 既存の workflow を変更するときは、頼まれた箇所だけを変える。頼まれていない箇所が規準に反していたら、直さずに報告に書く。規準には反しないが依頼の内容と食い違って見える箇所も、報告に 1 行で書く。
4. リポジトリ単位のファイルを確かめ、無ければ足す。
   - `gh actions-lock --verify` を実行する workflow (F6)。「最小の例」の `verify-lockfile.yml` を使う。
   - `.github/dependabot.yml` の `github-actions` (U1)。
   - `CODEOWNERS` (F7)。owner は依頼者に確かめる。理由: owner には write 権限を持つユーザか team を書く必要があり、ファイルからは決まらない。
5. lockfile を生成または更新する。`gh actions-lock --no-interactive` を実行する。
   - このコマンドは `actions.lock` を書き、`@v4` のような部分バージョンの `uses:` を完全なバージョンタグへ書き換える。書き換えはそのまま採る。
   - エラーが出たら、lockfile の生成はそこで止め、原文を報告に書く。`--accept-moved` は使わない。この場合も手順 6 へ進み、actionlint と zizmor は実行する。F1 は満たせなかった規準として報告する。
6. 機械層を通す (「機械層」節)。3 つとも exit code が 0 になるまで、指摘された箇所を直して手順 5 からやり直す。ツールの設定で指摘を消さない。
   - 依頼者の意図が要るために直せない指摘が残る場合は、そこで止め、残った指摘と exit code を報告に書く。
   - zizmor を token 付きで実行して監査の全体が止まる場合は、token を外した実行の結果で判定する。
7. `git status --short` で、変更が意図したファイルだけであることを確かめる。
8. 報告する。次を書く。
   - 作成・変更したファイルと、それぞれの要点
   - 機械層の実行状況 (コマンド・exit code・実行できなかったツール)
   - 満たせなかった規準と、その理由
   - 「ファイルから確認できない項目」のうち、依頼者に確かめてほしい項目

新しく生成した `actions.lock` は commit するまで git に追跡されない。F1 の追跡の条件は commit で満たされるので、未達には数えず、commit が要ることを報告に書く。

`gh actions-lock` が使えない環境では lockfile を生成できない。`uses:` を完全なバージョンタグで書いたところで止まり、F1 を満たしていない事実と、依頼者が実行するコマンド (`gh extension install github/gh-actions-lock` と `gh actions-lock`) を報告に書く。

## 最小の例

次の 2 つの workflow は `ansanloms/skills` リポジトリの実物で、2026-11-15 に pull request 上で成功した。`#` で始まる規準の注記はこの文書で足した。

`.github/workflows/lint.yml` は次のとおり。

```yaml
name: lint

on:
  pull_request:
  push:
    branches:
      - main

permissions: {} # P1

jobs:
  lint:
    name: lint (${{ matrix.dir }})
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read # P1
    strategy:
      fail-fast: false
      matrix:
        dir:
          - google-health/scripts
          - infra-architecture/scripts
    steps:
      - uses: actions/checkout@v7.0.1 # F2
        with:
          persist-credentials: false # S2
      - uses: actions/setup-node@v7.1.0 # F2
        with:
          node-version: 24
          package-manager-cache: false
      - name: Install dependencies
        run: npm ci
        working-directory: ${{ matrix.dir }}
      - name: Lint
        run: npm run lint
        working-directory: ${{ matrix.dir }}
```

実物の matrix は 4 項目あり、ここでは 2 項目に減らした。`${{ }}` は `name:` と `working-directory:` にだけ使い、`run:` には埋めていない (I1)。依存の cache は使っていない。

`.github/workflows/verify-lockfile.yml` は次のとおり。

```yaml
name: verify-lockfile

on:
  pull_request:
  push:
    branches:
      - main
  schedule:
    - cron: "17 3 * * 1"

permissions: {}

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    env:
      GH_TOKEN: ${{ github.token }}
    steps:
      - uses: actions/checkout@v7.0.1
        with:
          persist-credentials: false
      - run: gh extension install github/gh-actions-lock --pin v0.4.1 # F6
      - run: gh actions-lock --verify
```

gh-actions-lock は binary の拡張で、`--pin` には release のタグを渡す。タグが動かせないことは、`gh api repos/github/gh-actions-lock/releases/tags/<タグ> --jq .immutable` が `true` を返すことで確かめる。

`.github/dependabot.yml` には次の entry を足す (U1)。

```yaml
- package-ecosystem: "github-actions"
  directory: "/"
  schedule:
    interval: "weekly"
  cooldown:
    default-days: 7
```

`github-actions` の `cooldown` で使えるキーは `default-days`・`include`・`exclude` である[14]。

`.github/CODEOWNERS` は次の 1 行にする (F7)。

```text
/.github/ @<owner>
```

publish やデプロイのように強い権限が要る処理は、job を分けて、その job にだけ権限を与える。次は骨格で、`<...>` は書き換える箇所である。この骨格に `actions/setup-node` と実際のコマンドを足した workflow が、検証用のリポジトリで機械層の 3 つを通ることを 2026-11-16 に確かめた。GitHub の上では実行していない。

```yaml
permissions: {}

jobs:
  test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v7.0.1
        with:
          persist-credentials: false
      - run: <テストのコマンド>

  publish:
    needs: test
    runs-on: ubuntu-latest
    environment: <environment の名前> # S5
    permissions:
      contents: read
      id-token: write # P3、S1
    steps:
      - uses: actions/checkout@v7.0.1
        with:
          persist-credentials: false
      - run: <publish のコマンド>
```

environment の名前は認証を受ける側のサービスに登録する名前と一致させ、報告の「依頼者に確かめてほしい項目」に書く。

## 検査する手順

検査ではリポジトリの中のファイルを書き換えない。修正後の YAML も返さない。指摘は場所・規準・理由・出典の組で返し、直す方向は文で書く。理由: 頼まれたのは検査で、権限・secrets・トリガをどう直すかは、その workflow の目的を知る依頼者が決める。

1. 対象ファイルを確定する。依頼者が指定したものを使い、指定が無ければリポジトリ内の「対象」に当たるファイルすべてを対象にする。
2. 機械層を実行する (「機械層」節)。実行できないツールは飛ばし、実行できなかった事実を報告に書く。
3. 意味層を行う (「規準」節)。対象ファイルを全文読み、規準を 1 項目ずつ当てる。機械層が拾った箇所も、規準に当たるなら規準の ID を付ける。
4. 報告する (「検査の報告」節)。

対象を絞られた場合も、リポジトリ全体で決まる規準 (F6・F7・U1・U2) は判定する。F6 の判定には対象外の workflow も読む。読むのは `gh actions-lock --verify` を実行する job があるかを見るためだけで、対象外のファイルにある他の問題は指摘しない。

対象のファイルが 1 つも無いリポジトリでは、その事実を報告の先頭に書く。機械層は zizmor だけを実行し、関連して読むファイルのうち存在するものだけを規準に当てる。対象が無くて判定できなかった規準は、報告の「確認していない項目」に ID を並べる。

## 機械層

3 つのツールを順に実行する。

| ツール            | コマンド                                                                         | 見るもの                                                 | 無いときの確認                                           |
| ----------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| actionlint        | `actionlint -oneline <workflow のファイル...>`                                   | 構文、式の型、`needs`、action の inputs、`run:` の shell | `command -v actionlint`                                  |
| zizmor            | `GH_TOKEN="$(gh auth token)" zizmor --format=github <ファイルかディレクトリ...>` | セキュリティの監査                                       | `command -v zizmor`                                      |
| `gh actions-lock` | `gh actions-lock --verify`                                                       | lockfile と `uses:` の一致、記録された commit の出所     | `gh extension list` に `github/gh-actions-lock` があるか |

exit code は次のとおり。出典を書いていない値は 2026-11-15 に実測した (actionlint 1.7.12、zizmor 1.32.0、gh-actions-lock v0.4.1)。

| ツール            | exit code | 意味                                                               |
| ----------------- | --------- | ------------------------------------------------------------------ |
| actionlint        | 0         | 問題なし。出力も無い                                               |
| actionlint        | 1         | 問題あり                                                           |
| actionlint        | 2         | オプションが不正                                                   |
| actionlint        | 3         | 致命的エラー。ファイルが読めない場合と、workflow が 1 つも無い場合 |
| zizmor            | 0         | 指摘なし                                                           |
| zizmor            | 1         | 監査を実行できなかった                                             |
| zizmor            | 2         | 引数の解析の失敗 (zizmor の docs からの引用で、実測していない)     |
| zizmor            | 3         | 入力が 1 つも集まらなかった (同上)                                 |
| zizmor            | 11・12    | 指摘あり。最も重い指摘が informational・low (同上)                 |
| zizmor            | 13・14    | 指摘あり。最も重い指摘が medium・high                              |
| `gh actions-lock` | 0         | すべての workflow が通った                                         |
| `gh actions-lock` | 1         | 1 件以上が落ちた                                                   |
| `gh actions-lock` | 2         | workflow が 1 つも無い                                             |

出力の実物と `--json` の形は [references/machine-layer.md](references/machine-layer.md) にある。出力のどこが場所でどこが監査の名前かを確かめたいとき、出力を機械処理するとき、exit code の意味に迷ったときに読む。

ツールごとの注意は次のとおり。

### actionlint

- 渡すのは workflow のファイルだけにする。`action.yml` を渡すと workflow として読まれ、`jobs` や `on` が無いという構文の指摘が出る。composite action の中身は actionlint では未検査として、報告に書く。
- actionlint は shellcheck が PATH に無いと、警告も出さずに `run:` の検査を飛ばす。`command -v shellcheck` で有無を確かめ、無ければ「shell の検査は未実行」と報告する。
- action の `with:` の検証は `@v4` のような major タグの参照にしか効かない。完全なバージョンタグでは、存在しない入力名を書いても指摘が出なかった。検査では完全なバージョンタグで参照する action の入力名を未検査として報告に書く。書くときは手順 3 のコマンドで入力名を確かめる。
- actionlint のセキュリティ検査は、信頼できない入力の `run:` への直接使用と、`credentials:` への password 直書きだけである。固定・権限・トリガは見ない。

### zizmor

- ディレクトリを渡すと `.github/dependabot.yml` も監査する。リポジトリの中に `node_modules` や他の作業用の複製がある場合は、`.` ではなく `.github` を渡す。
- zizmor は token が無いとオフラインで動く。`impostor-commit`・`known-vulnerable-actions`・`ref-confusion` の監査は GitHub API を使うので、token を渡したときだけ走る。`gh auth token` が失敗する環境では token を付けずに実行し、この 3 つが未実行であると報告する。この 3 つが走ったかどうかは出力からは分からない。報告には token を付けたかどうかだけを書き、走ったとは書かない。
- token を付けた実行は、参照先のリポジトリに届かないと監査の全体が止まる。exit code は 1 で、指摘は 1 件も出ない。このときは token を外して実行し直し、上の 3 つが未実行であると報告する。
- lockfile の有無で `unpinned-uses` の出方が変わる。zizmor の lockfile 対応は v1.32.0 からで、docs は experimental と書いている。
  - lockfile が無いリポジトリでは、完全なバージョンタグ (`@v7.0.1`) も `unpinned-uses` の対象になる。これは規準 F1 に反している状態で、zizmor の設定では消さない。
  - lockfile があるリポジトリでは、lockfile に載った参照は `unpinned-uses` の対象から外れる。`@main` のようなブランチ参照も外れた。ブランチ参照は zizmor では拾えないので、規準 F2 で見る。

### gh actions-lock

- `--verify` はネットワークを使い、記録された commit の出所まで検査する。`--verify-local` はネットワークを使わず、すべての `uses:` が lockfile に載っているかだけを見る。どちらもリポジトリの中のファイルを書き換えない。実行の記録は `~/.cache/gh-actions-lock/logs/` に書かれる。
- 引数なしの `--verify` はリポジトリのすべての workflow を検査する。検査の対象を絞られた場合も引数なしで実行し、全体を検査した事実を報告に書く。指摘に使うのは、対象のファイルに関わる行だけである。
- ファイルを書き換えるモードは、引数なしの `gh actions-lock`・`--relock`・`--accept-moved`・`--migrate-local-actions` である。検査では実行しない。書くときに使うのは `gh actions-lock --no-interactive` だけで、ほかは依頼者が実行するコマンドとして報告に書く。

## 規準

各項目は「満たすべき状態」と理由を書く。1 つの項目が複数の条件を並べている場合は、どれか 1 つでも欠ければその項目に反する。出典の番号は「出典」節を指す。

F6・F7・U1 は、workflow が 1 つ以上あるリポジトリに当てる。検査するリポジトリに workflow が無ければ指摘にせず、報告の「確認していない項目」に書く。理由: 3 つとも workflow を守るための規準で、守る対象が無いリポジトリでは反していても害が出ない。

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
  - local action (`./` で始まる参照) が外部の action を使っていると、`gh actions-lock` はエラーにする。該当すれば F5 の指摘として書き、[2]の Limitations を示して依頼者に判断を仰ぐ。`action.yml` の中の参照を SHA にする修正はファイルから決まるが、local action をどう扱うかは依頼者が決める。
- F6: pull request で `gh actions-lock --verify` を実行する workflow がある。拡張の導入は `--pin <バージョン>` でバージョンを固定している。
  - 理由: `uses:` を足して lockfile を更新し忘れた変更を、マージ前に止める[2]。
- F7: `CODEOWNERS` が `.github/workflows/` を対象にしている (`actions.lock` を含む)。親の `/.github/` を対象にしていてもよい。
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
  - zizmor の `dependabot-cooldown` は、`default-days` が 7 未満の場合と未設定の場合を指摘する。U2 より厳しい基準なので、検査では U2 に当てず、機械層だけが拾った指摘として書く。書くときは `default-days: 7` を設定する。理由: 書く手順は機械層の exit code が 0 になることを求める。

### ファイルから確認できない項目

次はリポジトリや organization の設定にあり、ファイルを読んでも分からない。確認していない項目として報告に並べ、依頼者に確かめてもらう。

- `gh actions-lock --verify` の job が required check になっているか
- default branch への直接の push を禁じているか、code owner の承認を必須にしているか
- environment に承認者が設定されているか
- Actions の policy で Require lockfile を有効にしているか
- workflow の既定の token 権限が read-only になっているか

## 検査の報告

検査したときは、次の 3 つをこの順で返す。書いたときの報告は「書く手順」の手順 8 に従う。

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

重さは規準の ID で決める。機械層がその箇所を通していても、warning として出していても変えない。lockfile に載った `@main` は `gh actions-lock --verify` も zizmor も通すが、F2 に反するので必須である。規準に当たらず機械層だけが拾った指摘は、ツールが error として出したものを必須、それ以外 (warning・info・notice) を推奨にする。actionlint の出力には水準が付かないので、actionlint だけが拾った指摘は推奨にする。

同じ重さの中では T・I・P・F の順、続けて S・U の順に並べる。理由: 外から送り込める入力で成立するものを先に読めるようにする。

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
14. [Dependabot options reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference) (GitHub Docs)
