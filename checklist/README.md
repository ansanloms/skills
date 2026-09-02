# checklist

成果物を検査するチェックリストの共通プロトコル。各 skill が自前で発明しがちな確認の仕組み (判定記号・重要度・報告・レビューの統合) をドメイン非依存の規約として一本化し、検査項目そのものは各 skill に残す。

## できること

- 検査項目の書き方の規範 (1 項目 1 判定、killer 項目への絞り込み、`[critical]` タグ、機械判定と読解判定の区分)
- 判定の 3 値 (○/×/対象外) と共通規定 (× への根拠の義務、対象外への理由の義務、前提欠落の連鎖、機械判定結果の転記)
- 重要度 (RFC 5424 の語彙に基づく critical/error/warning) の定義と、レビュア間で割れた場合の裁定
- 実行モード: self-check (既定) とレビュア subagent (観点別に起動し統合する)
- 報告書式 (集計・判定表・指摘・修正と再判定・チェックリスト外の付記)。体裁は `assets/checklist-template.md`・`assets/report-template.md` が正本で、記入済みの実例が `references/checklist-example.md`・`references/report-example.md` にある

## 対象外

- 検査項目そのものの内容 (ドメイン固有。各 skill が定義する)
- 機械チェッカ (スクリプト・lint) の実装

## 発動する場面

skill に検証チェックリストを新設・改訂するとき。他の skill が「判定・報告は checklist skill に従う」と参照しているとき。チェックリストの判定結果を報告にまとめるとき。

## 設計の根拠

- killer 項目への絞り込み・妥協の禁止・致命的項目の先頭配置・「望ましい状態そのもの」を書く判定文: [NASA CR-177549 (Degani & Wiener, 1990)](https://ntrs.nasa.gov/api/citations/19910017830/downloads/19910017830.pdf) と Atul Gawande「The Checklist Manifesto」
- 判定ごとの根拠の義務・1 項目 1 判定 (基準の混同と halo effect の回避): [Autorubric (arXiv:2603.00077)](https://arxiv.org/html/2603.00077)
- 対象外 (N/A) へ理由を添える運用: [W3C WAI Evaluation Task Force の議論](https://lists.w3.org/Archives/Public/public-wai-evaltf/2012Feb/0103.html)
- 重要度の語彙: RFC 5424 (syslog severity) の critical/error/warning。区分の少なさは [Fagan inspection](https://en.wikipedia.org/wiki/Fagan_inspection) の major/minor defect に倣う
- チェックリストを生きた文書として付記から改訂する運用: [コードレビュー実務の形骸化対策](https://getdx.com/blog/code-review-checklist/)
- `[critical]` タグと成否判定: mizchi/skills の empirical-prompt-tuning の requirements checklist
- 機械判定の実行規定 (取得形・実行不可の扱い・ハッシュ比較)・要判断・同型反復の集約: 同リポジトリの ja-tech-proofread の運用知見の移植

## 導入

```sh
apm install ansanloms/skills/checklist --target claude
```

詳細は [SKILL.md](./SKILL.md) を参照。
