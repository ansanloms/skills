# skills

自前の Agent Skills 集。

各 skill を `<name>/SKILL.md` で管理し、 [apm (Agent Package Manager)](https://github.com/microsoft/apm) 経由で任意のクライアント (個別プロジェクトや dotfiles) に取り込んで使う。

## 収録 skill

| skill                                                 | 概要                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`library-docs`](./library-docs/SKILL.md)             | ライブラリ・フレームワーク・SDK 等の質問時に `ctx7` CLI で最新ドキュメントを取得する。                  |
| [`yamareco`](./yamareco/SKILL.md)                     | ユーザの登山履歴・タイム・ペースをヤマレコから取得し、登山計画の所要時間予測に使う。                    |
| [`jartic-traffic`](./jartic-traffic/SKILL.md)         | 指定の道路・エリアの現在の交通量を JARTIC 交通量 API (国土交通省) から取得する。                        |
| [`bluesky`](./bluesky/SKILL.md)                       | 指定ユーザ (主に自分) の Bluesky の投稿・関心トピック・フォロー/フォロワーを公開 API から取得する。     |
| [`cloud-architecture`](./cloud-architecture/SKILL.md) | AWS のクラウドインフラ構成図 (アーキテクチャ図) を draw.io 形式で作成し、PNG / SVG にエクスポートする。 |

## 前提: apm

skill の取り込みには [apm](https://github.com/microsoft/apm) CLI を使う。

## 取り込み

### 任意のプロジェクトで使う

```sh
cd <project>
apm install ansanloms/skills/library-docs --target claude
# → <project>/.claude/skills/ にコピー + apm.yml / apm.lock.yaml に記録
```

`--target` は配置先ハーネス (claude / cursor / codex 等)。Claude Code なら `.claude/skills/` に入る。

## 更新

```sh
cd <project> && apm update
```
