# export:excel: Excel 試験項目書出力

> **このファイルはサブエージェント（Task ツールで起動された `general-purpose` エージェント）が読む実行手順書。**
> メインセッションからの委譲で実行される。作業宣言・承認確認は不要。即座に生成処理を実行すること。

## 引数仕様

```bash
/e2e export:excel --workspace <string>    # 対象ワークスペースのパス（必須）
```

## 前提条件

- **MUST: すべてのコマンドは git リポジトリのルートで実行すること**

`{workspace}/` 配下に次のファイルが存在すること。

- `spec.replaced.json`

## 実行フロー

### 1. ファイル確認

`spec.replaced.json` の存在を確認する。存在しない場合は中断してユーザーに通知する。

### 2. Excel 出力

次のコマンドを実行する。`--cwd` でスクリプトディレクトリに移動して実行するため、パスはすべて `$(pwd)/` 付きの絶対パスで渡す（ルート相対のままだと解決に失敗する）。`macro.{N}.replaced.json` が存在する場合は `--macro` を連番順に追加する（無ければその行を外す）。

```bash
deno task --cwd .claude/skills/e2e/scripts export:excel \
  --spec $(pwd)/{workspace}/spec.replaced.json \
  --macro $(pwd)/{workspace}/macro.0.replaced.json \
  --output $(pwd)/{workspace}/result.xlsx
```

`{workspace}/result.xlsx` が生成されていることを確認する。
