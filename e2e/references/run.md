# run: テスト実行（playwright-cli）

> **このファイルはサブエージェント（Task ツールで起動された `general-purpose` エージェント）が読む実行手順書。**
> メインセッションからの委譲で実行される。作業宣言・承認確認は不要。即座にテストを実行すること。

## 引数仕様

```bash
/e2e run --workspace <string>                    # generate 済みワークスペース（必須）
                   [--screenshot <all|scenario|none>]       # スクリーンショット取得モード（デフォルト: all）
```

> **実行対象の絞り込みは `/e2e generate` の `--target` で行うこと。** `steps.json` に含まれる全項目を実行する。

## 前提条件

- `playwright-cli` がインストール済みであること
  - playwright-cli コマンドの詳細仕様は [appendix/playwright-cli-usage.md](appendix/playwright-cli-usage.md) を参照
- `/e2e generate` で生成済みのワークスペースが必要。ワークスペースには次のファイルが存在する:
  - `spec.replaced.json` — 環境変数置換済み spec
  - `steps.json` — テスト項目一覧（status なし）
  - `macro.{N}.replaced.json` — 環境変数置換済み macro（0 個以上）

## 実行フロー

### 1. 引数解析・バリデーション

`--workspace` で指定されたディレクトリの存在と、内部の `spec.replaced.json`、`steps.json` の存在を確認する。

実行ディレクトリ `RUN_DIR` を `{WORKSPACE}/run_{YYYYMMDDHHMMSS}` として作成する。

```bash
RUN_DIR=${WORKSPACE}/run_$(date '+%Y%m%d%H%M%S')
mkdir -p ${RUN_DIR}/screenshots
cp ${WORKSPACE}/steps.json ${RUN_DIR}/result.json
echo "[]" > ${RUN_DIR}/playwright-code.json
```

### 2. ブラウザ起動

```bash
# MUST: --browser=chromium を指定すること（system chrome は sandbox 制限で起動できない）
# ブラウザ起動前にリポジトリルートに cd すること（.playwright/cli.config.json を読ませるため）
cd $(git rev-parse --show-toplevel)
playwright-cli open --browser=chromium
```

### 3. テスト実行

`spec.replaced.json` からデバイス定義を読み取る。steps.json の各項目を項番順に実行する。

**MUST: 各ステップ実行前に、次のコマンドでステップ番号と内容を標準出力すること。**

```bash
echo "[${no}] ${scenario}"
```

**MUST: 1 ステップ実行するたびに、即座に result.json を更新すること。**

```bash
# status 更新
jq --arg no "1.1.1" --arg s "OK" '(.[] | select(.no == $no) | .status) = $s' ${RUN_DIR}/result.json > /tmp/r.json && \cp -f /tmp/r.json ${RUN_DIR}/result.json
jq --arg no "1.1.2" --arg s "NG" --arg r "理由" '(.[] | select(.no == $no)) |= . + {"status": $s, "remark": $r}' ${RUN_DIR}/result.json > /tmp/r.json && \cp -f /tmp/r.json ${RUN_DIR}/result.json
```

#### 3.1. シナリオ切り替え時の初期化

シナリオ番号（項番の 1 桁目、`{scenario}.*.*` の scenario 部分）が変わるタイミングで以下を実行する。

```bash
playwright-cli cookie-clear
playwright-cli localstorage-clear
playwright-cli sessionstorage-clear
```

#### 3.2. ステップテキスト → playwright-cli コマンド対応表

**ブラウザ設定**

| ステップテキスト                      | コマンド                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------ |
| `` `<device>` でブラウザを設定する `` | `playwright-cli resize <width> <height>`（spec の devices 定義から取得） |

**ナビゲーション**

| ステップテキスト                         | コマンド                       |
| ---------------------------------------- | ------------------------------ |
| `` `<url>` にアクセスする ``             | `playwright-cli goto <url>`    |
| `ブラウザの戻るボタンで前のページに戻る` | `playwright-cli go-back`       |
| `別のタブで <url> にアクセスする`        | `playwright-cli tab-new <url>` |

**確認系（アサーション）**

| ステップテキスト                                                       | コマンド                                                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `URL が <url> であることを確認する`                                    | `playwright-cli eval "window.location.href"` → 結果が期待値と一致するか確認    |
| `URL が <url> に遷移することを確認する`                                | 同上                                                                           |
| `URL が <url> のままであることを確認する`                              | 同上                                                                           |
| `URL に <pattern> が含まれることを確認する`                            | `playwright-cli eval "window.location.href"` → 結果に pattern が含まれるか確認 |
| `ページタイトルが <title> であることを確認する`                        | `playwright-cli eval "document.title"` → 結果を比較                            |
| `見出し <text> が表示されることを確認する`                             | `playwright-cli snapshot` → snapshot 内に text が含まれるか確認                |
| `<text> が表示されることを確認する`                                    | `playwright-cli snapshot` → snapshot 内に text が含まれるか確認                |
| `<text> リンクが表示されることを確認する`                              | 同上                                                                           |
| `エラーメッセージ <text> が表示されることを確認する`                   | `playwright-cli snapshot` → snapshot 内に text が含まれるか確認                |
| `バリデーションメッセージ <text> が表示されることを確認する`           | 同上                                                                           |
| `エラーモーダルが表示されることを確認する`                             | `playwright-cli snapshot` → role=dialog 要素が含まれるか確認                   |
| `モーダルタイトルが <text> であることを確認する`                       | `playwright-cli snapshot` → dialog 内に text が含まれるか確認                  |
| `エラーメッセージに <text> が含まれることを確認する`                   | 同上                                                                           |
| `エラーモーダルが非表示になることを確認する`                           | `playwright-cli snapshot` → role=dialog が消えているか確認                     |
| `<field> 入力欄に <value> が保持されていることを確認する`              | `playwright-cli eval "document.querySelector('input[name=...]').value"`        |
| `ログイン状態が維持されており見出し <text> が表示されることを確認する` | `playwright-cli snapshot` → text が含まれるか確認                              |

**操作系**

操作前は必ず `playwright-cli snapshot` で最新の ref を取得してから実行する。

**セレクタの優先順位**

playwright-cli の出力コードをそのまま使うのではなく、次の優先順位で安定したセレクタに書き直すこと。動的 ID（`#v-0-N` 等、Vue/React が実行時に生成する ID）は CI で壊れるため使用禁止。

1. `getByRole()` — ARIA ロールベース（最優先）
2. `getByLabel()` — `<label for>` / `aria-label` がある場合のみ有効
3. `locator('[name="..."]')` — フォームの `name` 属性
4. `getByPlaceholder()` / `getByText()` — プレースホルダー・テキスト
5. `locator('dl input[type="text"]')` 等の構造的 CSS セレクタ — label もないが DOM 構造が安定している場合

**ただしトレードオフ**: 上記のいずれも使えず、要素を一意に特定するには動的 ID 以外に手段がない場合は CSS セレクタを使う。その際は `// FIXME: 動的IDのため不安定` コメントを添えること。

| ステップテキスト                            | コマンド                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `メールアドレス入力欄に <value> を入力する` | `playwright-cli snapshot` → ref 取得 → `playwright-cli fill <ref> "<value>"` |
| `パスワード入力欄に <value> を入力する`     | 同上                                                                         |
| `<field> 入力欄に <value> を入力する`       | 同上（value が空文字の場合は fill 後に内容が空であることを確認する）         |
| `` `<text>` ボタンをクリックする ``         | `playwright-cli snapshot` → ref 取得 → `playwright-cli click <ref>`          |
| `` `<text>` リンクをクリックする ``         | 同上                                                                         |
| `OK ボタンをクリックする`                   | `playwright-cli snapshot` → ref 取得 → `playwright-cli click <ref>`          |

**マクロ（`@macro-name` 形式）**

`macro.{N}.replaced.json` から該当マクロの `script` を取得し、その内容を展開して実行する。
マクロの script は `/e2e --spec ... --target ...` 形式のため、その spec の該当ステップを順次実行する。

#### 3.3. playwright_code の記録

各ステップの Playwright コードを `${RUN_DIR}/playwright-code.json` に記録する。

**操作系ステップ**（`playwright-cli fill` / `click` / `goto` / `resize` / `go-back` / `tab-new` 等）は playwright-cli の出力に `Ran Playwright code:` ブロックが含まれる。これを抽出して記録する。

````bash
# playwright-cli コマンドの出力からコードを抽出する例
OUTPUT=$(playwright-cli fill e5 "value@example.com" 2>&1)
PW_CODE=$(echo "$OUTPUT" | awk '/```js/{flag=1; next} /```/{flag=0} flag' | tr '\n' ' ')

# playwright-code.json に追記
jq --arg no "${no}" --arg code "${PW_CODE}" \
  '. += [{"no": $no, "code": $code}]' \
  ${RUN_DIR}/playwright-code.json > /tmp/pc.json && \cp -f /tmp/pc.json ${RUN_DIR}/playwright-code.json
````

**確認系ステップ**（`playwright-cli eval`, `playwright-cli snapshot` での確認）は playwright-cli がコードを出力しないため、対応する Playwright アサーションコードを手動で構築して記録する。

```bash
# URL 確認の例
PW_CODE="await expect(page).toHaveURL('${expected_url}');"

# テキスト表示確認の例
PW_CODE="await expect(page.getByText('${text}')).toBeVisible();"

# ページタイトル確認の例
PW_CODE="await expect(page).toHaveTitle('${title}');"

# エラーモーダル確認の例
PW_CODE="await expect(page.getByRole('dialog')).toBeVisible();"
```

### 4. スクリーンショットの取得

`--screenshot` の値に応じて取得する。

| モード     | 取得タイミング                       |
| ---------- | ------------------------------------ |
| `all`      | 各 step の実行完了後                 |
| `scenario` | 各 scenario の最終 step の実行完了後 |
| `none`     | 取得しない                           |

```bash
playwright-cli screenshot --filename=${RUN_DIR}/screenshots/${no}.png
```

### 5. ブラウザ終了

```bash
playwright-cli close
```

### 6. result.md の生成

```bash
TITLE=$(jq -r '.title' ${WORKSPACE}/spec.replaced.json)
DATE=$(date '+%Y-%m-%d %H:%M:%S')

{
  echo "# ${TITLE} - テスト結果"
  echo ""
  echo "**実行日時**: ${DATE}"
  echo ""
  echo "| no. | scenario | status | remark |"
  echo "| :--- | :--- | :---: | :--- |"
  jq -r '.[] | "| \(.no) | \(.scenario) | \(if .status == "OK" then "✅" elif .status == "NG" then "❌" elif .status == "SKIP" then "➖" else "" end) | \(.remark // "") |"' \
    ${RUN_DIR}/result.json
} > ${RUN_DIR}/result.md
```

### 7. フォーマット

```bash
deno fmt --no-config --prose-wrap preserve ${RUN_DIR}/result.json
deno fmt --no-config --prose-wrap preserve ${RUN_DIR}/result.md
deno fmt --no-config --prose-wrap preserve ${RUN_DIR}/playwright-code.json
```
