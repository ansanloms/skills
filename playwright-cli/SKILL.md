---
name: playwright-cli
description: playwright-cli でブラウザを駆動し Web 画面をブラックボックスで検証する際の操作リファレンス。ページを開く・スナップショットで要素 ref を得る・クリック / 入力 / セレクト操作・スクリーンショット取得・コンソール / ネットワーク確認・SP(モバイル)エミュレーション・セッション分離・操作に対応する Playwright コードの収集 (テストへの転写) を扱う。バグ再現や画面の動作確認をコードを読まずに実操作で行う時に使う。
---

# playwright-cli によるブラウザ操作

Web 画面をブラウザ越しに検証する際は `playwright-cli`(`@playwright/cli`)を使う。バグ再現・修正後の動作確認・画面の挙動確認は、コードを読んで推論するのではなくブラウザでの実操作(ブラックボックス)で行う。

公式ドキュメント: <https://github.com/microsoft/playwright-cli>

## `e2e` skill との役割分担

- `e2e` skill: 試験項目書(spec)の作成・生成・Excel 出力・spec 駆動のテスト実行という上位ワークフロー。
- 本 skill: その下層で使う playwright-cli そのものの操作リファレンス。spec を介さない ad-hoc な画面検証(再現確認など)はこちらを直接使う。

## 前提

- playwright-cli 本体がインストール済みであること。`playwright-cli --version` で確認できる。npm パッケージは `@playwright/cli`。
- ブラウザ本体がインストール済みであること。未導入なら `playwright-cli install-browser chromium`(導入先は `--dry-run` で確認できる)。
- MUST: コンテナ等 sandbox が使えない環境では `launchOptions.args` に `--no-sandbox` を付ける(下記 config 参照)。これが無いと chromium が起動できないことがある。環境が sandbox を使えるか不明な場合の既定は「付ける」(起動が失敗する方向の害はない。信頼できないサイトを開く時だけサンドボックス保護が無くなる点に注意)。
- MUST: ローカル HTTPS(自己署名・社内 CA など、ブラウザが信頼しない証明書のホスト)を開く場合は `contextOptions.ignoreHTTPSErrors` を `true` にする(下記 config 参照)。これが無いと navigate が `net::ERR_CERT_AUTHORITY_INVALID` で失敗する。curl は OS の証明書ストアを使うため 200 を返すが、playwright の chromium は独自プロファイルで起動し別系統で弾く。「curl は 200 なのにブラウザが繋がらない/別 URL に飛んだ」と見えたら、まず証明書(ignoreHTTPSErrors 未設定)を疑うこと。DNS やリダイレクトと誤診しやすい。証明書の信頼状態が不明な検証対象での既定は「付ける」(証明書エラーの検証を素通しするだけで、信頼済み証明書のサイトでも動作に害はない)。

スナップショット等の出力は作業ディレクトリ直下の `.playwright-cli/` に書かれる。VCS で追跡しないよう `.gitignore` に加える。

## 基本フロー

ref ベースで操作する。`snapshot` で各要素の参照(`e15` 等)を得て、その ref を click/fill/select に渡す。

```bash
# 1. ブラウザを開いてページへ遷移
playwright-cli open "https://example.com/"

# 2. スナップショットで要素 ref を得る(コマンド実行後も自動でスナップショットが付く)
playwright-cli snapshot

# 3. ref を使って操作
playwright-cli fill e5 "user@example.com"
playwright-cli fill e6 "password"
playwright-cli click e7

# 4. 画面状態を確認(スナップショット or スクリーンショット)
playwright-cli snapshot
playwright-cli screenshot --filename=/tmp/check.png

# 5. 終了
playwright-cli close
```

バグ再現・不具合調査では、失敗が起きる操作の直後に `console error` と `requests` を実行して JS エラー・失敗リクエストの手がかりを採る(確認系の合否判定とは別の補助情報。snapshot/eval での合否確認を先に済ませてからでよい)。

スナップショットの出力例は次の通り。各要素に `[ref=eN]` が付く。

```
### Page
- Page URL: https://example.com/login
- Page Title: ログイン
### Snapshot
- textbox "メールアドレス" [ref=e20]
- textbox "パスワード" [ref=e26]
- button "ログイン" [ref=e29]
```

ref は `snapshot` を取った時点の DOM に対応する。同じ snapshot の ref は DOM が変わるまで有効で、上の例のように 1 回の snapshot で複数操作(fill/fill/click)に使える。MUST: ナビゲーション・クリックによる再描画など DOM が変わる操作の後は `snapshot` を取り直す。取り直すと ref は振り直されるため、取り直し前の古い ref は使わない。操作コマンドの出力末尾にも操作後のスナップショットが付くが、インラインではなく `.playwright-cli/` 内ファイルへのリンクで出ることがある。ref がインラインで読める場合のみ取り直しの MUST をそれで満たしてよく、リンクのみの場合は明示的に `snapshot` を取り直す。

実行せずに手順書だけを提示する場合、ref は snapshot 実出力に基づくプレースホルダとして書き、実行時に実際の出力の ref へ読み替える旨を明記する(ref・セッション ID・テストデータ(認証情報・入力値)等、実行前に確定しない値はすべて同様)。テストデータのプレースホルダには何を意図した値かを注記する(例: 認証失敗を起こす値)。前提確認(`--version` 等)を手順に含めるかは任意。含める場合は「未導入時のみ実行」等の条件を明記する。

ref が分からない場合は CSS セレクタや Playwright ロケータも target に使える。

```bash
playwright-cli click "#submit"
playwright-cli click "getByRole('button', { name: '確定する' })"
playwright-cli click "getByTestId('submit-button')"
```

## 主要コマンド

| 分類       | コマンド                                                               | 用途                                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core       | `open [url]` / `goto <url>` / `close`                                  | ブラウザ起動・遷移・終了                                                                                                                                                                     |
| Core       | `snapshot [target]`                                                    | 要素 ref を得る(`--filename` で保存)                                                                                                                                                         |
| Core       | `click` / `dblclick` / `fill` / `type` / `select`                      | クリック・入力・セレクト選択                                                                                                                                                                 |
| Core       | `check` / `uncheck` / `hover` / `press <key>`                          | チェック・ホバー・キー入力                                                                                                                                                                   |
| Core       | `drag <from-ref> <to-ref>`                                             | ドラッグ＆ドロップ                                                                                                                                                                           |
| Core       | `eval <func> [target]`                                                 | ページ / 要素上で JS を評価                                                                                                                                                                  |
| Save as    | `screenshot [target]`                                                  | スクショ(`--filename` / `--full-page`)                                                                                                                                                       |
| Navigation | `go-back` / `go-forward` / `reload` / `resize`                         | 履歴・リロード・ビューポート                                                                                                                                                                 |
| DevTools   | `console [min-level]`                                                  | コンソールメッセージ一覧(level は `error`/`warning`/`info`/`debug`、既定 `info`。各レベルはより重大なレベルを含む)                                                                           |
| DevTools   | `requests` / `request <n>` / `response-body <n>`                       | ネットワーク要求・応答の確認(番号はページ読み込み以降の 1-based 連番。`requests --filter=<regexp>` で URL を絞り込める。ナビゲーション / リロード後は `requests` を取り直してから番号を使う) |
| DevTools   | `run-code [code]`                                                      | 任意の Playwright コードを実行                                                                                                                                                               |
| Dialog     | `dialog-accept [text]` / `dialog-dismiss`                              | ダイアログの承認 / 拒否                                                                                                                                                                      |
| Storage    | `cookie-*` / `localstorage-*` / `sessionstorage-*` / `state-save/load` | Cookie・ストレージ・認証状態の保存 / 復元                                                                                                                                                    |
| Tabs       | `tab-new` / `tab-list` / `tab-select <i>`                              | タブ操作                                                                                                                                                                                     |
| Sessions   | `list` / `close-all` / `kill-all`                                      | セッション一覧・全終了・強制 kill                                                                                                                                                            |

各コマンドの詳細は `playwright-cli <command> --help` で確認できる。

グローバルオプションは次の通り。

- `--raw`: ステータス・生成コード・スナップショット部を除き結果値のみ出力。パイプ向き。
- `--json`: 応答全体を JSON で出力。
- `-s=<session>`: 名前付きセッションを分離(下記)。

```bash
# 例: 要素のテキストや属性を取り出す
playwright-cli --raw eval "el => el.textContent" e5
playwright-cli --raw eval "el => el.getAttribute('data-testid')" e5

# 例: 取り出した値を期待値と比較して合否にする
[ "$(playwright-cli --raw eval "el => el.textContent.trim()" e5)" = "期待値" ] && echo OK || echo NG
```

## 生成コードの収集

playwright-cli は各操作の実行時に対応する Playwright TypeScript コードを `### Ran Playwright code` 見出しの下の ```js フェンス内に出力する。

````bash
playwright-cli fill e1 "user@example.com"
# 出力(抜粋):
# ### Ran Playwright code
# ```js
# await page.getByRole('textbox', { name: 'メールアドレス' }).fill('user@example.com');
# ```
````

この出力を各ステップごとに集めると、動作確認済みの Playwright コードをテストへ転写できる。`snapshot`/`eval` での確認系操作はコードを出力しないため、必要なアサーションは自前で構築する。

## SP(モバイル)エミュレーション

SP 画面の検証は `--config` に設定ファイルを渡して viewport/touch/UA を指定する(`open --config=<path>`)。

MUST: viewport は `contextOptions.viewport` のみで指定する。`deviceScaleFactor` や `isMobile` を併記すると viewport 指定が無視され、意図しない幅でレンダリングされる(SP のメディアクエリ分岐がズレて誤った検証結果を生む)。`device` 名(例 `"Pixel 7"`)の指定キーは存在せず無視される。

viewport 412x915/タッチ有効/モバイル UA の例は次の通り。例の viewport/UA は汎用の既定としてそのまま流用してよい。対象サイトが UA 判定で表示を分岐する仕様の場合のみ、その仕様に合わせて UA を差し替える。タップ操作は `click` で行う(`tap` コマンドは無い)。例中の `--no-sandbox` と `ignoreHTTPSErrors` は SP 指定とは独立な環境依存項目で、前提の条件(sandbox 不可・信頼されない証明書)に該当しなければ外してよい。

```json
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": { "headless": true, "args": ["--no-sandbox"] },
    "contextOptions": {
      "ignoreHTTPSErrors": true,
      "viewport": { "width": 412, "height": 915 },
      "hasTouch": true,
      "userAgent": "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    }
  }
}
```

```bash
# 上記を /tmp/pw-sp.json に保存して使う例
playwright-cli -s=sp open "https://example.com/" --config=/tmp/pw-sp.json
playwright-cli -s=sp --raw eval "JSON.stringify({w:innerWidth,h:innerHeight,touch:navigator.maxTouchPoints})"
# -> {"w":412,"h":915,"touch":1}
# 合格条件: w/h が config の viewport と等値、かつ touch >= 1。不一致なら config を直すまで先へ進まない
playwright-cli -s=sp close
```

PC 画面でも、コンテナや信頼されない証明書のローカル HTTPS を検証する場合は `--no-sandbox` と `ignoreHTTPSErrors` を含む config が要る(前提の MUST 参照)。viewport 指定が不要なだけで、素の `open` では起動・証明書エラーになる。次の最小 config を使う。

```json
{
  "browser": {
    "browserName": "chromium",
    "launchOptions": { "headless": true, "args": ["--no-sandbox"] },
    "contextOptions": { "ignoreHTTPSErrors": true }
  }
}
```

```bash
# 上記を /tmp/pw-pc.json に保存して使う例
playwright-cli open "https://example.com/" --config=/tmp/pw-pc.json
```

## セッション分離(複数画面の並行検証)

`-s=<name>` で Cookie・ストレージ・タブが独立したセッションを並行起動できる。管理画面とフロント画面を同時に検証する場合などに使う。

```bash
playwright-cli -s=front open "https://www.example.com/"
playwright-cli -s=admin open "https://admin.example.com/"
playwright-cli list          # セッション一覧
playwright-cli -s=front snapshot
playwright-cli -s=admin snapshot
playwright-cli close-all      # 全セッション終了
playwright-cli kill-all       # 残留プロセスを強制終了
```

## 落とし穴・注意

- 要素操作は基本 ref を使う。ref は snapshot 時点の DOM に対応し、DOM が変わるまで複数操作に使える。DOM が変わったら snapshot を取り直し、取り直し前の古い ref は使わない。
- スクショだけでは「描画が遅延しているだけ」と「要素が DOM に存在しない」を区別できないことがある。要素の有無まで断定したい場合は `snapshot`(accessibility tree)や `eval` で DOM を直接確認する。合否の読み替えは「snapshot に要素が現れる = accessibility tree 上に存在する(表示されている)」を基準にし、`display:none` 等の非表示要素は snapshot に現れない。モーダルやメニューの開閉など状態変化の検証は、操作前後の snapshot を比較し「何が現れる/消えるはずか」を操作前に言語化しておく。CSS だけで隠すメニュー等、開閉しても snapshot に差分が出ない実装では、`aria-expanded` 等の属性や computed style を `eval` で確認する。「DOM に無い」と「DOM にはあるが非表示」の切り分けは次の eval で機械的に行える。

  ```bash
  playwright-cli --raw eval "() => ({ inDom: document.body.outerHTML.includes('対象テキスト'), visible: document.body.innerText.includes('対象テキスト') })"
  ```
- 動的 ID(`#v-0-N` 等、Vue/React が実行時に生成する ID)はセッションをまたぐと壊れる。生成コードをテストへ転写する際は `getByRole()`/`getByLabel()`/`[name="..."]` 等の安定したセレクタへ書き直す。
- 操作が終わったら `close`(または `close-all`)でブラウザを閉じる。残留したら `kill-all`。

## 網羅リファレンス

本 skill は日常利用に必要な範囲を抽出したもの。全コマンド・全オプションは playwright-cli 同梱の公式 SKILL.md を一次リファレンスとする。

- 同梱公式 SKILL.md: `playwright-cli --help` の冒頭に表示される `Agent skill:` のパス(`@playwright/cli` パッケージ内の `.../skill/SKILL.md`)。`references/` に request mocking・tracing・video・running-code 等の個別ガイドがある。
- npm パッケージ: `@playwright/cli`。
- 各コマンドの詳細は `playwright-cli <command> --help` で確認できる。
