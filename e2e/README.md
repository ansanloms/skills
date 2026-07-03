# e2e

Web アプリの E2E テストの試験項目書 (`spec.json`) 作成・Excel 出力・playwright-cli によるテスト実行を行う skill。

## サブコマンド

- `write` — 試験項目書 (`spec.json`) の作成
- `generate` — ワークスペース生成
- `export:excel` — Excel 出力
- `run` — テスト実行

## 対象外

- 単体テスト
- API 単発の確認

シナリオ・ユーザー操作フロー全体の試験を設計・実施する用途に限る。

## 依存

- playwright-cli そのものの操作リファレンスは [playwright-cli skill](../playwright-cli/README.md) に依存する。本 skill は spec 駆動ワークフロー固有の規約のみを持ち、spec を介さない ad-hoc な画面検証は playwright-cli skill を直接使う。

## 発動する場面

「試験項目書を作りたい」「E2E テストを実行したい」「試験項目書を Excel にしたい」など。

## 導入

```sh
apm install ansanloms/skills/e2e --target claude
```

詳細は [SKILL.md](./SKILL.md) を参照。
