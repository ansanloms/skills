# write: 試験項目書作成

## 引数仕様

```bash
/e2e write [overview]    # テスト対象の概要（省略時はヒアリングから開始）
```

## 実行フロー

### 1. 要件ヒアリング

overview が引数で与えられ要件が確定しているなら、この step は省略してよい。overview が無い、または不十分な場合に次の情報をヒアリングで補う。

- テスト対象機能: どの機能をテストするか
- テスト範囲: 正常系・異常系・境界値テストの範囲
- 想定シナリオ: ユーザーの操作フローやビジネスロジック
- 環境・データ: テスト環境や必要なテストデータ
- 多言語対応: 日本語・英語等の言語切替が必要か
- デバイス対応: PC・スマートフォンでの操作差異

### 2. spec.json の作成

spec.json を作成する。スキーマは `../scripts/schemas/spec.schema.json` を参照。

```json
{
  "title": "テスト項目書タイトル",
  "description": "テスト概要（任意）",
  "case": {
    "columns": ["colA", "colB"],
    "rows": [
      { "colA": "値1", "colB": "値2" }
    ]
  },
  "scenarios": [
    {
      "name": "シナリオ名",
      "description": "シナリオ概要（任意）",
      "case": {
        "columns": ["colX"],
        "rows": [{ "colX": "値" }]
      },
      "steps": [
        "${BASE_URL} にアクセスする",
        "メールアドレスフィールドに `<email>` を入力する",
        "ログインボタンをクリックする"
      ]
    }
  ]
}
```

#### 制約事項

- ケーステーブル（`case`）は任意。言語・デバイス・データパターン等でパラメータ化する場合のみ付け、単一ケースで足りるなら省略する（テンプレートの `case` ブロックごと削ってよい。省略時は no. の 2 桁目が 1 固定になる）。単一ケースの書き方は `appendix/format-specification.md` を参照
- `case.columns` の各値は識別子パターン `^[a-zA-Z][a-zA-Z0-9\-]*$` に従う
- `scenarios` は最低 1 件必要
- `steps` は最低 1 件必要
- ステップ内のパラメータ置換記法: `${ENV_VAR}`（環境変数）、`<column-name>`（ケースの値）
- 環境ごとに URL を変える必要がなければ `${ENV_VAR}` を使わず、`サインアップ画面にアクセスする` のように素の文や相対パスで書いてよい。`${ENV_VAR}` は環境差や秘匿値があるときだけ使う
- マクロ参照: `@macro-name` 形式でマクロを参照できる
  - マクロ名自体にも `<column-name>` を使用可能。ケースの値に応じてマクロを動的に切り替えられる
  - 例: `@login-frontend-<lang>` → `lang: ja` のとき `@login-frontend-ja` に展開されてからマクロ展開される
  - マクロ script 内の `<column-name>` もケースの値で置換される

#### 命名規則

- シナリオ名は `1.`, `2.`, ... と先頭に 1 始まりの連番を付けること
  ```json
  { "name": "1. 正常ログインテスト", ... }
  { "name": "2. 異常ログインテスト", ... }
  ```
- ケーステーブルを付ける場合、その先頭列は `case` とし、行の値は `"1"`, `"2"`, ... と連番を振ること
  ```json
  {
    "columns": ["case", "lang"],
    "rows": [
      { "case": "1", "lang": "" },
      { "case": "2", "lang": "/en" }
    ]
  }
  ```

フォーマット仕様の詳細は `appendix/format-specification.md` を参照。

### 3. spec.md の生成

spec.json から spec.md を生成する。**json-to-md は内部で JSON スキーマバリデーションも実行する。**

コマンド仕様は [scripts/README.md](../scripts/README.md#json-to-md) を参照。**MUST: git リポジトリのルートで実行すること。**

```bash
deno task --cwd .claude/skills/e2e/scripts json-to-md \
  --input $(pwd)/path/to/{feature-name}/spec.json \
  --output $(pwd)/path/to/{feature-name}/spec.md
```

バリデーションエラーが出た場合は spec.json を修正して再実行する。

### 4. .env.example と README.md の生成（必要に応じて）

#### .env.example

spec.json のステップ内で使用されている `${ENV_VAR}` 形式の変数が存在する場合に生成する。

```bash
# {feature-name}/.env.example の例
# /e2e generate 実行時に --env-file で渡すか、--env KEY=VALUE で個別指定すること

# テスト用商品 ID（実在する商品 ID を設定）
TEST_PRODUCT_ID_1=
TEST_PRODUCT_ID_2=
```

#### README.md

次のいずれかに該当する場合に生成する。

- テスト固有の環境変数が存在する（`.env.example` を生成した場合）
- テスト実行前に手動で用意が必要なデータがある（fixture ファイルの前提データ等）

次のフォーマットで記述する（必要な節のみ含める）。

```markdown
# {spec の title}

## 事前準備

### 環境変数

`.env.example` を参考に値を設定したファイルを用意し、`/e2e generate` 実行時に `--env-file` で渡す。渡した内容は generate によってワークスペース内の `.env` にコピーされる。

(必要な変数の説明を記述)

### テストデータ

- {fixture ファイルのプレースホルダー等、手動設定が必要な事項を箇条書きで記述}

## 実行

(実行コマンド例を記述)
```

- テスト固有の ID（商品 ID、会員 ID 等）は実際の環境で取得・設定する手順を記述する
- テスト概要は spec.md を参照させる（README.md には重複して書かない）

### 5. fmt

生成後、**実際に生成したファイルにのみ** fmt をかける。存在しないファイルへの fmt はエラーになるため、step 4 で生成しなかったものは対象から外す。

```bash
# spec.json / spec.md は常に生成されるので必ず fmt する
deno fmt --no-config --prose-wrap preserve $(pwd)/path/to/{feature-name}/spec.json
deno fmt --no-config --prose-wrap preserve $(pwd)/path/to/{feature-name}/spec.md
# 以下は step 4 で生成した場合のみ実行する（未生成ならスキップ）
deno fmt --no-config --prose-wrap preserve $(pwd)/path/to/{feature-name}/.env.example
deno fmt --no-config --prose-wrap preserve $(pwd)/path/to/{feature-name}/README.md
```

## テンプレート設計ガイド

- フォーマット仕様: `appendix/format-specification.md`
