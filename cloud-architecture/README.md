# cloud-architecture

AWS のクラウドインフラ構成図 (アーキテクチャ図) を draw.io 形式で作成・編集するための Agent Skill。

エージェント向けの操作手順は [SKILL.md](./SKILL.md) にある。この README は人間向けの概要と、付属スクリプトの開発・テスト手順を記す。

## 概要

- AWS サービスアイコン (EC2/RDS/S3/VPC など) を使った構成図を draw.io の XML 形式で作成・編集する。
- PNG (確認用) と、drawio XML を埋め込んだ編集可能 SVG (`.drawio.svg`, 成果物) にエクスポートする。
- 見やすさ (線の重なり・凡例被り・無関係ノードの貫通・枠の貫通) を、PNG 目視ではなくエクスポート後の SVG 座標から幾何的に検査する。

対象は AWS のみ。フローチャート・シーケンス図など、ベンダーアイコンを必要としない汎用ダイアグラムは対象外 (mermaid 等を使う)。PNG/SVG エクスポートと幾何チェックには draw.io CLI と Deno が必要。

## 構成

- [`SKILL.md`](./SKILL.md) — エージェント向けの操作手順 (本スキルのエントリポイント)
- `references/` — 詳細リファレンス
  - [`xml-format.md`](./references/xml-format.md) — draw.io XML 形式の詳細
  - [`layout-best-practices.md`](./references/layout-best-practices.md) — フォント・レイアウト・エッジのベストプラクティス
  - [`aws-architecture.md`](./references/aws-architecture.md) — AWS アーキテクチャ図のベストプラクティス
  - [`readability-checks.md`](./references/readability-checks.md) — 見やすさの幾何チェック (4 観点・実行方法・限界)
  - [`export.md`](./references/export.md) — PNG/SVG エクスポートコマンドとオプション
  - [`troubleshooting.md`](./references/troubleshooting.md) — よくある問題と解決策
- `scripts/` — 見やすさの幾何チェッカ (Deno)
  - `check-readability.ts` — チェッカ本体
  - `check-readability.test.ts` — テスト
  - `testdata/` — テスト用の実 drawio 出力 fixture
  - `deno.json` — task 定義

## 開発・テスト

幾何チェッカ (`scripts/check-readability.ts`) の開発は `scripts/deno.json` の task で行う。

```bash
cd scripts
deno task test   # 幾何プリミティブの単体 + clean/bad fixture での結合テスト
deno task lint   # deno lint && deno check && deno fmt --check
deno task fix    # deno lint --fix && deno fmt
deno task check --drawio ../diagram.drawio --svg ../diagram.drawio.svg  # 単体実行
```

テストの fixture は `scripts/testdata/` に置いた実際の drawio 出力 (`clean.*` は指摘なし、`bad.*` は 4 観点すべてが発火する図)。`testdata/` は drawio 出力に忠実な状態を保つため fmt/lint の対象外にしてある (ルートの `deno.json` と `scripts/deno.json` の双方で除外)。チェッカの判定ロジックを変えたら fixture を作り直し、`deno task test` が通ることを確認する。
