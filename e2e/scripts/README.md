# E2E テスト CLI ツール

試験項目書（Markdown/JSON）を変換・加工するための CLI ツール群。

## コマンド一覧

| コマンド      | 説明                                               |
| ------------- | -------------------------------------------------- |
| `json-to-md`  | spec.json → spec.md 変換                           |
| `replace-env` | spec.json 内の `${ENV_VAR}` を実際の環境変数で置換 |
| `scenarios`   | spec.json からシナリオ実行一覧を出力               |

---

## json-to-md

中間 JSON 表現（spec.json）を試験項目書 Markdown（spec.md）に変換する。

```sh
deno task json-to-md [--input <path>] [--output <path>]
```

| オプション | 説明                       | デフォルト |
| ---------- | -------------------------- | ---------- |
| `--input`  | 入力 JSON ファイルパス     | stdin      |
| `--output` | 出力 Markdown ファイルパス | stdout     |

### 例

```sh
# ファイル指定
deno task json-to-md --input spec.json --output spec.md

# stdin → stdout
cat spec.json | deno task json-to-md
```

---

## replace-env

spec.json 内のすべての文字列値に含まれる `${ENV_VAR}` パターンを、実際の環境変数の値に置き換える。

対象フィールド: `title`/`description`/`case.columns`/`case.rows[*][*]`/`scenarios[*].name`/`scenarios[*].description`/`scenarios[*].steps[*]`/`scenarios[*].case.*`

未定義の環境変数は `${ENV_VAR}` のままプレースホルダーを保持する。

```sh
deno task replace-env [--input <path>] [--output <path>]
```

| オプション | 説明                        | デフォルト |
| ---------- | --------------------------- | ---------- |
| `--input`  | 入力 spec.json ファイルパス | stdin      |
| `--output` | 出力 JSON ファイルパス      | stdout     |

### 例

```sh
# ファイル指定
FRONTEND_URL=https://example.com deno task replace-env --input spec.json

# stdin → ファイル
cat spec.json | FRONTEND_URL=https://example.com deno task replace-env --output spec.replaced.json

# .env ファイルと組み合わせる
env $(cat .env | xargs) deno task replace-env --input spec.json
```

---

## scenarios

spec.json の case/scenario/step をもとに、実行される全項目（step 単位）の一覧を出力する。

no. の形式は `{scenario_index}.{case_index}.{step_index}` の 3 桁。桁順の正本は `references/appendix/target-specification.md`。

- `scenario_index`: `spec.scenarios` の 1-indexed 番号。
- `case_index`: 当該 scenario の `case.rows` の行番号 (1〜M)。scenario に case がなければグローバル `spec.case.rows` の行番号 (1〜N)。どちらもなければ 1 固定。
- `step_index`: `scenarios[*].steps` の 1-indexed 番号。

```sh
deno task scenarios [--input <path>] [--target <target>] [--format text|json] [--output <path>]
```

| オプション | 説明                                            | デフォルト |
| ---------- | ----------------------------------------------- | ---------- |
| `--input`  | 入力 spec.json ファイルパス                     | stdin      |
| `--target` | 実行対象の絞り込み（target-specification 参照） | -          |
| `--format` | 出力フォーマット: `text` \| `json`              | `text`     |
| `--output` | 出力ファイルパス                                | stdout     |

### 例

```sh
# 全シナリオ一覧（text）
deno task scenarios --input spec.json

# stdin → stdout
cat spec.json | deno task scenarios

# JSON 形式で出力
deno task scenarios --input spec.json --format json

# ターゲット絞り込み（case 1 の全シナリオ）
deno task scenarios --input spec.json --target "1.*.*"

# 複合指定
deno task scenarios --input spec.json --target "1.1.*,2.2.1:2.2.3"
```

### 出力例

**text:**

```
1.1.1 ログイン画面にアクセスする
1.1.2 メールアドレスを入力する
1.1.3 パスワードを入力してログインボタンをクリックする
```

**json:**

```json
[
  {
    "no": "1.1.1",
    "scenario": "ログイン画面にアクセスする"
  },
  {
    "no": "1.1.2",
    "scenario": "メールアドレスを入力する"
  },
  {
    "no": "1.1.3",
    "scenario": "パスワードを入力してログインボタンをクリックする"
  }
]
```

---

## エラー時の挙動

バリデーションエラー（構文エラー・スキーマ違反）は stderr に出力され、プロセスは exit code 1 で終了する。

```
Validation failed:
  /title: must NOT have fewer than 1 characters
```
