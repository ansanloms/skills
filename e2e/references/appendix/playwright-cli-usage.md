# playwright-cli 規約

playwright-cli（`@playwright/cli`）を使ったブラウザ自動化の操作規約。

公式ドキュメント: <https://github.com/microsoft/playwright-cli>

## 主要コマンド

### ブラウザ起動・終了

```bash
# MUST: --browser=chromium を常に指定すること（system chrome は sandbox 制限で起動できないため）
playwright-cli open --browser=chromium                        # ブラウザを起動
playwright-cli open --browser=chromium https://example.com    # 起動と同時に URL へ遷移
playwright-cli close                       # ブラウザを終了
playwright-cli close-all                   # 全ブラウザを終了
playwright-cli kill-all                    # プロセスを強制終了（ゾンビ対策）
```

### ナビゲーション

```bash
playwright-cli goto https://example.com    # URL へ遷移
playwright-cli go-back                     # ブラウザ戻る
playwright-cli go-forward                  # ブラウザ進む
playwright-cli reload                      # ページリロード
playwright-cli resize 1920 1080            # ビューポートサイズ設定
```

### スナップショット（操作前に必須）

```bash
playwright-cli snapshot                               # ページスナップショット取得
playwright-cli snapshot --filename=before-click.yaml  # ファイルに保存
```

**MUST**: 各ブラウザ操作前に必ず `playwright-cli snapshot` を実行して最新の `ref`（要素参照）を取得すること。操作のたびに `ref` は変わるため、古い `ref` を再利用しない。

スナップショットの出力例は次の通り。

```
### Page
- Page URL: https://example.com/login
- Page Title: ログイン - A!-Gate
### Snapshot
- textbox "メールアドレス" [ref=e20]
- textbox "パスワード" [ref=e26]
- button "ログイン" [ref=e29]
```

### 要素操作

```bash
playwright-cli click <ref>                 # クリック
playwright-cli dblclick <ref>              # ダブルクリック
playwright-cli fill <ref> "<value>"        # フォーム入力
playwright-cli type "<text>"               # テキスト入力（フォーカス中の要素）
playwright-cli check <ref>                 # チェックボックスを ON
playwright-cli uncheck <ref>               # チェックボックスを OFF
playwright-cli select <ref> "<value>"      # セレクトボックスで選択
playwright-cli hover <ref>                 # ホバー
playwright-cli press Enter                 # キー操作（Enter / ArrowDown 等）
playwright-cli drag <from-ref> <to-ref>    # ドラッグ＆ドロップ
```

### JavaScript 実行・アサーション

```bash
playwright-cli eval "document.title"       # JS 式を評価して結果を返す
playwright-cli eval "el => el.textContent" <ref>   # 要素を引数として評価

# Playwright コードを直接実行（複雑な操作・アサーション用）
playwright-cli run-code "async page => {
  await expect(page.locator('h1')).toBeVisible();
}"
```

### スクリーンショット

```bash
playwright-cli screenshot                              # スクリーンショット取得
playwright-cli screenshot --filename=<path>            # 保存先を指定
playwright-cli screenshot <ref>                        # 特定要素のスクリーンショット
```

### ストレージ操作

```bash
# Cookie
playwright-cli cookie-clear                            # 全 Cookie クリア
playwright-cli cookie-list                             # Cookie 一覧
playwright-cli cookie-get <name>                       # Cookie 取得
playwright-cli cookie-set <name> <value>               # Cookie 設定

# localStorage
playwright-cli localstorage-clear                      # localStorage クリア
playwright-cli localstorage-get <key>                  # 取得
playwright-cli localstorage-set <key> <value>          # 設定

# sessionStorage
playwright-cli sessionstorage-clear                    # sessionStorage クリア

# 認証状態の保存・復元
playwright-cli state-save auth.json                    # ストレージ状態を保存
playwright-cli state-load auth.json                    # ストレージ状態を復元
```

### タブ操作

```bash
playwright-cli tab-list                                # タブ一覧
playwright-cli tab-new https://example.com             # 新しいタブを開く
playwright-cli tab-select 0                            # タブを選択（0-indexed）
playwright-cli tab-close                               # 現在のタブを閉じる
```

### ダイアログ操作

```bash
playwright-cli dialog-accept                           # ダイアログを承認
playwright-cli dialog-accept "テキスト"                # テキスト入力付きで承認
playwright-cli dialog-dismiss                          # ダイアログを拒否
```

## セッション管理

`-s=<名前>` フラグで名前付きセッションを使い、複数のブラウザを独立して管理できる。

```bash
playwright-cli -s=admin open https://admin.local.example.com
playwright-cli -s=admin goto https://admin.local.example.com/login
playwright-cli -s=admin fill e1 "user@example.com"
playwright-cli -s=admin close
```

## シナリオ開始時の初期化手順

各シナリオ開始時に次の順で実行すること。

1. ビューポートサイズを設定する
2. ストレージを一括クリア（Cookie / localStorage / sessionStorage）
3. ログアウト URL へ遷移してサーバー側のセッションを破棄する
4. テスト対象ページへ遷移する

```bash
# 1. ビューポート設定
playwright-cli resize 1920 1080

# 2. ストレージクリア
playwright-cli cookie-clear
playwright-cli localstorage-clear
playwright-cli sessionstorage-clear

# 3. ログアウト（サーバー側セッション破棄）
playwright-cli goto https://admin.local.example.com/login/out
```

## テストコードの自動生成

**playwright-cli は各操作実行時に対応する Playwright TypeScript コードを出力する。**

```bash
playwright-cli fill e1 "user@example.com"
# 出力:
# Ran Playwright code:
# await page.getByRole('textbox', { name: 'メールアドレス' }).fill('user@example.com');

playwright-cli click e3
# 出力:
# Ran Playwright code:
# await page.getByRole('button', { name: 'ログイン' }).click();
```

この出力を各ステップごとに収集することで、動作確認済みの Playwright コードを spec.ts に転写できる。
