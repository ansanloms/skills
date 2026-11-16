# github-actions

GitHub Actions の workflow・composite action・reusable workflow を書く・直す・検査するときの規準と手順を定める skill。

## できること

規準は 1 つで、書くときにも検査するときにも同じものを使う。規準が扱うのは次の 6 つである。

- 固定: workflow lockfile への onboard と、`uses:` の完全なバージョンタグ。lockfile が固定しない箇所 (別リポジトリの reusable workflow・container image・`action.yml` の中の参照) は SHA と digest
- 権限: `permissions:` の明示と、job 単位での引き上げ
- トリガ: `pull_request_target`・`workflow_run` と、fork のコードの checkout
- injection: 信頼できない値の `run:` への直接の埋め込み
- secrets: OIDC、`persist-credentials`、`secrets: inherit`、environment
- 更新: Dependabot の `github-actions` と cooldown

書くときは、規準を満たすように workflow を書き、`gh actions-lock` で lockfile を生成し、actionlint・zizmor・`gh actions-lock --verify` が通るまで直す。リポジトリに lockfile を検証する workflow・Dependabot の `github-actions`・CODEOWNERS が無ければ、一緒に足す。

検査するときは、同じ 3 つのツールを実行し、対象ファイルを規準と突き合わせる。指摘は場所・規準・理由・出典の組で返す。ファイルは書き換えない。

## 対象外

- GitHub Actions 以外の CI
- リポジトリと organization の設定の変更。ファイルから確認できない設定は、確かめてほしい項目として報告に並べる。
- commit と push

誰が最初に書くか (エージェントが書くか、依頼者の下書きを待つか) は、この skill は決めない。

## 発動する場面

workflow を新しく書くとき、既存の workflow に job や step を足す・直すとき、「workflow をレビューして」「Actions の設定を点検して」と頼まれたとき。

## 前提

次のツールを使う。

- [actionlint](https://github.com/rhysd/actionlint) と shellcheck
- [zizmor](https://docs.zizmor.sh/) (lockfile の対応は v1.32.0 以降)
- [gh-actions-lock](https://github.com/github/gh-actions-lock) (`gh extension install github/gh-actions-lock`)

検査は、ツールが無くても規準との突き合わせだけで動く。書くときに gh-actions-lock が無いと、lockfile を生成できない。

workflow lockfile は GitHub Enterprise Server では使えない。

## 導入

```sh
apm install ansanloms/skills/github-actions --target claude
```

詳細は [SKILL.md](./SKILL.md) を参照。
