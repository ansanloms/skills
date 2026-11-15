# gha-review

GitHub Actions の workflow・composite action・reusable workflow を検査し、サプライチェーン対策の穴を指摘で返す skill。

## できること

検査は 2 層で行う。

機械層では actionlint・zizmor・`gh actions-lock --verify` を実行し、出力と exit code を読む。入っていないツールは飛ばし、実行できなかった事実を報告に書く。

意味層では対象ファイルを次の規準と突き合わせる。

- 固定: workflow lockfile への onboard と、`uses:` の完全なバージョンタグ。lockfile が固定しない箇所 (別リポジトリの reusable workflow・container image・`action.yml` の中の参照) は SHA と digest
- 権限: `permissions:` の明示と、job 単位での引き上げ
- トリガ: `pull_request_target`・`workflow_run` と、fork のコードの checkout
- injection: 信頼できない値の `run:` への直接の埋め込み
- secrets: OIDC、`persist-credentials`、`secrets: inherit`、environment
- 更新: Dependabot の `github-actions` と cooldown

指摘は場所・規準・理由・出典の組で返す。ファイルは書き換えず、修正後の YAML も返さない。

## 対象外

- workflow の新規作成と書き直しの代行
- lockfile の生成と更新 (`gh actions-lock` の書き込むモード)
- GitHub Actions 以外の CI
- リポジトリと organization の設定の変更。ファイルから確認できない設定は、確認していない項目として報告に並べる。

## 発動する場面

workflow を書き上げて確認する段階、既存 workflow の安全性を見直すとき、「workflow をレビューして」「Actions の設定を点検して」と頼まれたとき。

## 前提

機械層には次のツールが要る。無くても意味層だけで動く。

- [actionlint](https://github.com/rhysd/actionlint) と shellcheck
- [zizmor](https://docs.zizmor.sh/) (lockfile の対応は v1.32.0 以降)
- [gh-actions-lock](https://github.com/github/gh-actions-lock) (`gh extension install github/gh-actions-lock`)

workflow lockfile は GitHub Enterprise Server では使えない。

## 導入

```sh
apm install ansanloms/skills/gha-review --target claude
```

詳細は [SKILL.md](./SKILL.md) を参照。
