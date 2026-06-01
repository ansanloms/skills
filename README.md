# skills

自前の Agent Skills 集。

各 skill を `<name>/SKILL.md` で管理し、 [apm (Agent Package Manager)](https://github.com/microsoft/apm) 経由で任意のクライアント (個別プロジェクトや dotfiles) に取り込んで使う。

## 収録 skill

| skill                                     | 概要                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| [`library-docs`](./library-docs/SKILL.md) | ライブラリ・フレームワーク・SDK 等の質問時に `ctx7` CLI で最新ドキュメントを取得する。 |
| [`yamareco`](./yamareco/SKILL.md)         | ユーザの登山履歴・タイム・ペースをヤマレコから取得し、登山計画の所要時間予測に使う。   |

## 前提: apm

skill の取り込みには [apm](https://github.com/microsoft/apm) CLI を使う。

## 取り込み

### 任意のプロジェクトで使う

```sh
cd <project>
apm install ansanloms/skills/library-docs ansanloms/skills/yamareco --target claude
# → <project>/.claude/skills/ にコピー + apm.yml / apm.lock.yaml に記録
```

`--target` は配置先ハーネス (claude / cursor / codex 等)。Claude Code なら `.claude/skills/` に入る。

## 更新

```sh
cd <project> && apm update
```

## 注意

- skill は full agent permission で実行される。取り込む内容は自分で確認すること。
