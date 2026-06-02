---
name: cloud-architecture
description: >-
  AWS のクラウドインフラ構成図 (アーキテクチャ図) を draw.io 形式で作成・編集するツール。EC2 / RDS / S3 / VPC
  などの AWS サービスアイコンを用いた構成図を XML で生成し、PNG (確認用) と SVG (成果物) にエクスポートする。AWS
  のシステム構成やインフラ設計を図にする場面、.drawio ファイルを操作する場面で使用する。フローチャート・シーケンス図・ER
  図などベンダーアイコンを必要としない汎用ダイアグラムには使用しない (それらは mermaid 等のテキストベースのツールを使う)。
---

# Cloud Architecture (draw.io) Skills

## 引数

このスキルは引数を受け取らない。呼び出しは `/cloud-architecture` のみで使用する。

## 概要

この Skills は、AWS のクラウドインフラ構成図 (アーキテクチャ図) を draw.io の XML 形式で作成・編集するためのツール。

主な用途は次の通り。

- AWS アーキテクチャ図 (構成図) の作成・編集
- クラウドインフラ設計の図解
- 技術ドキュメント用の AWS 構成図

現時点の対象は AWS のみ。GCP / Azure 等の他クラウドは未対応 (将来 `references/<provider>-architecture.md` とテンプレートを追加して拡張する想定)。

フローチャート・シーケンス図・ER 図など、ベンダーアイコンを必要としない汎用ダイアグラムはこのスキルの対象外。テキストで完結するこれらの図は mermaid 等を使う。

PNG / SVG エクスポートが必要な場合は draw.io CLI が必要。

## 推奨ワークフロー

1. `.drawio` ファイルを XML 形式で作成
2. PNG を出力して視覚的に確認する
3. 問題があれば XML を修正して手順 2 に戻る
4. 完成したら SVG にエクスポート (成果物): `diagram.svg`
5. 成果物は `diagram.drawio` と `diagram.svg` の両方を残す

## 使用例

### AWS 構成図 (最小構成)

EC2 と RDS を矢印で繋ぐ最小構成の例。

```xml
<mxfile host="app.diagrams.net">
  <diagram name="example">
    <mxGraphModel>
      <root>
        <mxCell id="0"/><mxCell id="1" parent="0"/>
        <mxCell id="ec2" value="EC2" style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.ec2;fillColor=#ED7100;strokeColor=#ffffff;aspect=fixed;verticalLabelPosition=bottom;verticalAlign=top;fontSize=12;fontFamily=Helvetica;" vertex="1" parent="1">
          <mxGeometry x="100" y="100" width="78" height="78" as="geometry"/>
        </mxCell>
        <mxCell id="rds" value="RDS" style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.rds;fillColor=#2E73B8;strokeColor=#ffffff;aspect=fixed;verticalLabelPosition=bottom;verticalAlign=top;fontSize=12;fontFamily=Helvetica;" vertex="1" parent="1">
          <mxGeometry x="300" y="100" width="78" height="78" as="geometry"/>
        </mxCell>
        <mxCell id="e1" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="ec2" target="rds" parent="1">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

## XML 形式の詳細

mxCell 構造、style 属性、グループ・コンテナ、接続ポイントなど詳細は [xml-format.md](./references/xml-format.md) を参照。

## レイアウトとスタイル

フォント設定、テキストサイズ、日本語幅の確保、図形の配置順序、エッジのルーティングなど詳細は [layout-best-practices.md](./references/layout-best-practices.md) を参照。

## AWS アーキテクチャ図

アイコンスタイル、resIcon 値、カラー、レイアウト原則など詳細は [aws-architecture.md](./references/aws-architecture.md) を参照。

## エクスポート

PNG / SVG の出力コマンド、オプション、使い分けの詳細は [export.md](./references/export.md) を参照。

## トラブルシューティング

詳細は [troubleshooting.md](./references/troubleshooting.md) を参照。

## 参考資料

- `references/xml-format.md` - XML 形式の詳細
- `references/layout-best-practices.md` - フォント・レイアウト・エッジのベストプラクティス
- `references/aws-architecture.md` - AWS アーキテクチャ図のベストプラクティス
- `references/export.md` - PNG / SVG エクスポートコマンドとオプション
- `references/troubleshooting.md` - よくある問題と解決策

## 外部リンク

- [draw.io 公式ドキュメント](https://www.drawio.com/doc/)
- [draw.io XML format](https://www.drawio.com/doc/faq/diagram-source-edit)
- [AWS Architecture Icons](https://aws.amazon.com/architecture/icons/)
