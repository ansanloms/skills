# generate: ワークスペース生成

> **このファイルはサブエージェント（Task ツールで起動された `general-purpose` エージェント）が読む実行手順書。**
> メインセッションからの委譲で実行される。作業宣言・承認確認は不要。即座に生成処理を実行すること。

## 引数仕様

```bash
/e2e generate --spec <string>             # spec.json パス（必須）
             [--env <string>]             # 環境変数設定（KEY=VALUE 形式、複数指定可）
             [--env-file <string>]        # 環境変数ファイルのパス（複数指定可）
             [--macro <string>]           # マクロ定義 JSON ファイルのパス（複数指定可、後指定優先）
             [--target <string>]          # 実行対象の絞り込み（appendix/target-specification.md 参照）
             [--workspace <string>]       # 作業領域ディレクトリのパス（省略時は自動生成）
```

## 前提条件

- `--spec` で指定する `spec.json` が存在すること
- **MUST: すべてのコマンドは git リポジトリのルートで実行すること**

## 実行フロー

### 1. 引数解析・バリデーション

`--spec`（spec.json パス）の存在を確認する。

### 2. ワークスペースを作る

`--workspace` が指定されている場合はそのパスを作業領域として使用する。指定がない場合は spec.json があるディレクトリ直下に `generate_{YYYYMMDDHHMMSS}`（YYYYMMDDHHMMSS はワークスペース生成日時）の名前でディレクトリを作成する。

```bash
# --workspace が指定されている場合
WORKSPACE={workspace のパス}
mkdir -p ${WORKSPACE}

# --workspace が指定されていない場合
WORKSPACE=$(dirname {spec.json のパス})/generate_$(date '+%Y%m%d%H%M%S')
mkdir -p ${WORKSPACE}
```

以降のステップで生成されるファイルはすべてこのワークスペース内に出力する。

### 3. 環境変数の準備

**MUST: すべての環境変数をワークスペース内の `.env`（`${WORKSPACE}/.env`）に集約すること。`--env-file` で指定したファイルを直接編集してはいけない。**

#### 3.1. `${WORKSPACE}/.env` の構築

次の順序で `${WORKSPACE}/.env` を構築する。後から書き込んだ値が優先される。

**① `--env-file` の転記（指定がある場合）:**

```bash
# 複数指定がある場合は指定順に追記する。
# env-file が末尾改行を持たないと次の追記が前行に連結するため、転記ごとに改行を補う。
cat {env-file} >> ${WORKSPACE}/.env
echo >> ${WORKSPACE}/.env
```

**② `--env KEY=VALUE` の書き込み（指定がある場合）:**

```bash
# 複数指定がある場合はすべて追記する
echo "KEY=VALUE" >> ${WORKSPACE}/.env
```

#### 3.2. `.env` を export して後続処理で利用可能にする

```bash
set -a && source ${WORKSPACE}/.env && set +a
```

### 4. 環境変数の置換

`replace-env` で spec.json の環境変数を置換し、`spec.replaced.json` を生成する。コマンド仕様は [scripts/README.md](../scripts/README.md#replace-env) を参照。
環境変数はステップ 3 で `${WORKSPACE}/.env` に集約済みのため、それを参照して実行する。

```bash
env $(cat ${WORKSPACE}/.env | grep -v '^#' | xargs) deno task --cwd .claude/skills/e2e/scripts replace-env \
  --input $(pwd)/{spec.json のパス} \
  --output $(pwd)/${WORKSPACE}/spec.replaced.json
```

環境変数の指定がない場合でも `replace-env` を通すことで、未解決のプレースホルダーを検出できる。

`replace-env` は出力先からスキーマへの相対パスを `$schema` フィールドとして `spec.replaced.json` に付与する（エディタ補完用）。入力 spec.json に `$schema` が無くても出力には付くため、生成物は入力と完全一致しない。

次の未解決チェックは `${ENV_VAR}` 形式のみを対象とする。`<column-name>`（カラム参照）はこの段階では未展開のまま残るのが正しく、後段の `scenarios` でケース値に展開される。

**MUST: 置換後に未解決のプレースホルダーが残っていないか確認すること。残っている場合は生成を中断し、未解決の変数名一覧をユーザーに通知する。**

```bash
UNRESOLVED=$(grep -oE '\$\{[A-Z_][A-Z0-9_]*\}' ${WORKSPACE}/spec.replaced.json | sort -u)
if [ -n "$UNRESOLVED" ]; then
  echo "以下の環境変数が未解決です。設定を確認してください:"
  echo "$UNRESOLVED"
  exit 1
fi
```

#### 4.1. macro ファイルの env 置換

ステップ 1 で確定した macro ファイルリストを、読み込み順の連番を付けた `{WORKSPACE}/macro.{N}.replaced.json`（N は 0 始まり）として env 置換して保存する。これにより macro の `script` 内の `${ENV_VAR}` が実際の値に展開される。

```bash
# MACRO_FILES は --macro で渡された macro ファイルのパス（指定順、0 始まりで連番化する）
MACRO_FILES=({macro1 のパス} {macro2 のパス})

# 環境変数はステップ 3 で ${WORKSPACE}/.env に集約済み。生 env-file ではなくこれを参照する。
# 連番は bash/zsh 双方で動くよう手動カウンタで採番する（${!arr[@]} は zsh で動作が異なるため使わない）。
i=0
for f in "${MACRO_FILES[@]}"; do
  env $(cat ${WORKSPACE}/.env | grep -v '^#' | xargs) envsubst < "$f" \
    > "${WORKSPACE}/macro.${i}.replaced.json"
  i=$((i + 1))
done
```

`envsubst` はシェルの環境変数を `${VAR}` 形式で置換する。`$schema` フィールドの URL 値には `${...}` が含まれないため影響を受けない。

### 5. steps.json の生成

`scenarios --format json` で実行対象のシナリオ一覧を取得し、`steps.json` のベースを生成する。コマンド仕様は [scripts/README.md](../scripts/README.md#scenarios) を参照。`--target` が指定されている場合はそのまま渡す。

```bash
# macro.{N}.replaced.json をステップ 4.1 で生成した連番順にすべて --macro で渡す。
# macro が複数あれば --macro 行を連番順に追加する（後指定優先）。
# --target は引数で渡された場合のみ付ける。渡されていなければその行を外す。
deno task --cwd .claude/skills/e2e/scripts scenarios \
  --input $(pwd)/${WORKSPACE}/spec.replaced.json \
  --macro $(pwd)/${WORKSPACE}/macro.0.replaced.json \
  --target {target} \
  --format json \
  --output $(pwd)/${WORKSPACE}/steps.json
```

生成直後の steps.json は `status` / `remark` を持たない状態。

```json
[
  { "no": "1.1.1", "scenario": "正常ログインテスト" },
  { "no": "1.1.2", "scenario": "異常ログインテスト" }
]
```

### 6. フォーマット

生成ファイルに fmt をかける。

```bash
deno fmt --no-config --prose-wrap preserve ${WORKSPACE}/steps.json
deno fmt --no-config --prose-wrap preserve ${WORKSPACE}/spec.replaced.json
```
