# playwright-cli

playwright-cli でブラウザを駆動し Web 画面をブラックボックスで検証する操作リファレンス。

エージェント向けの操作手順は [SKILL.md](./SKILL.md) にある。この README は人間向けの概要と、スキルを修正するときの追加要件を記す。

## 概要

- ページ遷移・スナップショット・クリック/入力/セレクト・スクリーンショットで画面の動作を実操作で確認する。
- 要素は ref ベースで操作する。snapshot で ref を取得し、その ref をコマンドに渡す。
- コンテナや自己署名証明書のローカル HTTPS 環境では config ファイル (`--no-sandbox`/`ignoreHTTPSErrors`) を指定する。
- SP 画面検証は config の `viewport` で指定する (`deviceScaleFactor`/`isMobile` は併記しない)。
- セッション分離 (`-s=name`) で複数画面を並行検証できる。
- 操作コマンドが出力する Playwright コードを収集し、動作確認済みコードとしてテストへ転写できる。
- 試験仕様ベースのワークフローは e2e skill の担当。本 skill は spec を介さない ad-hoc な画面検証に使う。

## 修正時の追加要件

リポジトリ共通のルール (lint、`empirical-prompt-tuning` での磨き、PR 作成手順) は [.claude/CLAUDE.md](../.claude/CLAUDE.md) に従う。このスキル固有の追加要件は次のとおり。

- ref は snapshot 時点の DOM に対応する。DOM 変更後は取り直し、古い ref を使わないルールを保つ。
- コンテナ・自己署名証明書・HTTPS エラーは `--no-sandbox`/`ignoreHTTPSErrors` で対応する MUST と、DNS・リダイレクト誤診の落とし穴を残す。
- viewport は `contextOptions.viewport` のみで指定し、`deviceScaleFactor`/`isMobile` を併記しない・device 名指定は無視される点を保つ。
- 生成コードの収集 (snapshot/eval を除く) と、動的 ID を安定セレクタへ書き直す注意を残す。
- 条件付き MUST (`--no-sandbox`/`ignoreHTTPSErrors`) には「条件が不明な場合の既定は付ける」を対で保つ。
- 実行せず手順書だけを提示する場合の規約 (ref・テストデータ等の未確定値はプレースホルダとし実行時に読み替える) を残す。
- 全コマンド・全オプションの一次リファレンスは playwright-cli 同梱の公式 SKILL.md である旨を明記する。
