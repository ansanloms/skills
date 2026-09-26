---
name: healthplanet
description: >-
  タニタの Health Planet API (OAuth2) から、体重・体脂肪率・歩数・血圧などの記録を取得する手順。
  「体重の推移」「最近の体重」「体脂肪率」「今日の歩数」「血圧」「脈拍」「Health Planet」「タニタ」などを聞かれた際に使う。
  初回は認可コードの取得とトークン交換が必要で、以降はアクセストークンの期限切れを検出して自動でリフレッシュしながら計測データを取得する。
  データの登録・削除、食事ログ、筋トレメニューの管理、筋肉量・基礎代謝等 (innerscan で取得できるのは体重・体脂肪率のみ) は対象外。
---

# Health Planet のデータ取得

タニタの Health Planet API から体重・体脂肪率 (innerscan)・歩数 (pedometer)・血圧 (sphygmomanometer) の記録を取得する手順。

## scripts の絶対パスの確定

この skill のコマンド (`auth-url` ・ `token` ・ `status`、いずれも後述) は `healthplanet/scripts` を `--cwd` に指定して実行する。パスは変数に代入せず、最初に 1 度だけ次のコマンドで絶対パスを確定し、以降の各コマンド例ではその結果をそのままリテラルで書き下す。理由: エージェントのシェルはコール間で cwd・変数を失う。

```sh
for d in "$PWD/.claude/skills/healthplanet" "$HOME/.claude/skills/healthplanet" "$PWD/healthplanet"; do
  if [ -d "$d/scripts" ]; then
    echo "$d/scripts"
  fi
done
```

- 配布先 (`apm install` 後) では、プロジェクトローカルな配置の `$PWD/.claude/skills/healthplanet/scripts` またはユーザーレベルな配置の `$HOME/.claude/skills/healthplanet/scripts` がヒットする。
- この skill のリポジトリ本体 (`ansanloms/skills`) 内で作業している場合は `$PWD/healthplanet/scripts` がヒットする。
- 複数ヒットしたら先に見つかったものを使う。
- 0 件のときは実際のインストール先を確認してから進める (推測でパスを組み立てない)。
- 以降のコマンド例中の `<scripts の絶対パス>` は、ここで確定した絶対パスに読み替える。
- 内部動作 (モジュール構成・テスト) は `scripts/README.md` を参照。そのコマンド例はすべて `--cwd` 無しで、cwd が `scripts` ディレクトリ自身である前提で書かれている。この SKILL.md と併読するときも、実行時は必ずここで確定した絶対パスを `--cwd` に付ける。

## 前提: 環境変数

Health Planet にアプリを登録し (`client_id` ・ `client_secret` を取得、アプリケーションタイプは「クライアント」)、次の環境変数を用意する。

| 変数名                       | 必須                       | 意味                                                                                                                                                                                                                                   |
| ---------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HEALTHPLANET_CLIENT_ID`     | 必須                       | 登録したアプリの client_id                                                                                                                                                                                                             |
| `HEALTHPLANET_CLIENT_SECRET` | `token` ・ `status` で必須 | 登録したアプリの client_secret (`auth-url` では不要)                                                                                                                                                                                   |
| `HEALTHPLANET_REDIRECT_URI`  | 任意                       | 登録したアプリの redirect_uri。省略時は既定値 `https://www.healthplanet.jp/success.html` (クライアントアプリケーションタイプの既定)                                                                                                    |
| `HEALTHPLANET_TOKEN_PATH`    | `token` ・ `status` で必須 | トークン (access_token・refresh_token 等) を保存する JSON ファイルの絶対パス。**親ディレクトリはあらかじめ作成しておく** (`token` ・ `status` は自動作成しない。deno task の `--allow-write` はこのファイルパス自身にしか及ばないため) |

`HEALTHPLANET_TOKEN_PATH` が未設定のまま `token` ・ `status` を実行すると、CLI 自体に処理が渡る前に deno が `error: Empty path is not allowed` を出して終了する。このメッセージが出たら `HEALTHPLANET_TOKEN_PATH` の未設定を疑う。

## 初回認可

1. `auth-url` で認可 URL を組み立てる (`HEALTHPLANET_CLIENT_ID` ・ `HEALTHPLANET_REDIRECT_URI` のみ必要)。`--scope` は省略すると既定値 `innerscan` になる。

   ```sh
   # 体重・体脂肪率のみ (--scope 省略、既定値 innerscan)
   HEALTHPLANET_CLIENT_ID=<client_id> \
     deno task -q --cwd "<scripts の絶対パス>" auth-url

   # 歩数・血圧も含める場合
   HEALTHPLANET_CLIENT_ID=<client_id> \
     deno task -q --cwd "<scripts の絶対パス>" auth-url --scope=innerscan,pedometer,sphygmomanometer
   ```

   scope は認可時に固定され、後から追加するには `auth-url` からやり直して `token` で取り直す必要がある (同じトークンファイルが上書きされる)。

2. 出力された URL をユーザに提示し、ブラウザで開いてログイン・認可してもらう。認可後に発行される認可コード (`code`) をユーザから受け取る。
3. 認可コードは `/oauth/auth` へのアクセスから 10 分以内にトークン交換する必要がある。`token` コマンドへ渡す。

   ```sh
   HEALTHPLANET_CLIENT_ID=<client_id> \
     HEALTHPLANET_CLIENT_SECRET=<client_secret> \
     HEALTHPLANET_TOKEN_PATH=<トークンファイルの絶対パス> \
     deno task -q --cwd "<scripts の絶対パス>" token <認可コード>
   ```

   成功するとトークンファイル (`HEALTHPLANET_TOKEN_PATH`) に `access_token` ・ `refresh_token` ・ `expires_in` ・ `obtained_at` を書き込み、次を標準出力へ返す。トークン自体は出力しない。

   ```jsonc
   {
     "token_path": "...",
     "expires_in": 2592000,
     "obtained_at": "2026-09-26T00:00:00.000Z"
   }
   ```

## データ取得

`status` コマンドで種別ごとの計測データを取得する。

```sh
HEALTHPLANET_CLIENT_ID=<client_id> \
  HEALTHPLANET_CLIENT_SECRET=<client_secret> \
  HEALTHPLANET_TOKEN_PATH=<トークンファイルの絶対パス> \
  deno task -q --cwd "<scripts の絶対パス>" status innerscan
```

| 引数     | 必須 | 意味                                                                                |
| -------- | ---- | ----------------------------------------------------------------------------------- |
| 位置引数 | 必須 | 種別: `innerscan` (体重・体脂肪率) / `pedometer` (歩数) / `sphygmomanometer` (血圧) |
| `--date` | 任意 | `0` = 登録日、`1` = 測定日 (既定 `1`)                                               |
| `--from` | 任意 | 取得範囲の開始。14 桁 `yyyyMMddHHmmss`、3 か月以内                                  |
| `--to`   | 任意 | 取得範囲の終了。14 桁 `yyyyMMddHHmmss`、3 か月以内                                  |
| `--tag`  | 任意 | 絞り込むタグ (カンマ区切り)                                                         |

`--from` ・ `--to` を省略すると API 側の既定 (3 か月前から) が適用される。

仕様は `from` < `to` だけを定め、`to` を含むかは書かれていない。1 日分を取るときは `--to` を翌日の `000000` にする (例: 2026-09-26 の 1 日なら `--from 20260926000000 --to 20260927000000`)。

タグは種別ごとに固定。

| 種別               | タグ   | 意味         |
| ------------------ | ------ | ------------ |
| `innerscan`        | `6021` | 体重 (kg)    |
| `innerscan`        | `6022` | 体脂肪率 (%) |
| `pedometer`        | `6331` | 歩数         |
| `sphygmomanometer` | `622E` | 収縮期血圧   |
| `sphygmomanometer` | `622F` | 拡張期血圧   |
| `sphygmomanometer` | `6230` | 脈拍         |

実測 (2026-09-26): innerscan で取得できるのは体重 (6021) と体脂肪率 (6022) の 2 項目だけ。`--tag 6022` のように指定すればその項目だけが返る。筋肉量など OpenAPI の `EnumInnerscanTag` に無いタグ (`6023`〜`6029`) を指定すると API 側が無視し、既定の 2 項目が返る。エラーにはならない。

出力は Health Planet API のレスポンス JSON をそのまま (未加工で) 出力する。読み方は次のとおり。

- `data[].keydata` は数値の文字列。数値型ではない。
- `data[].date` は `yyyyMMddHHmm` の生文字列。タイムゾーンは API ドキュメントに明記が無いため、変換・解釈をせずそのまま扱う。
- アクセストークンの期限切れ (`obtained_at` + `expires_in` 秒 - 60 秒のマージンを過ぎた場合。`expires_in` の単位は秒と仮定) は `status` コマンドが自動検出し、リフレッシュトークンで更新してからデータ取得する。更新後のトークンはトークンファイルへ書き戻される。期限判定はローカル時刻で行うため、実際の期限とずれることがある。加えて `/status` が 401 を返したときは 1 回だけ refresh して再試行する (再試行後も 401 ならそのままエラーにする)。
  - 実測 (2026-09-26): `access_token` を壊したトークンファイルで `status innerscan` を実行すると 401 → refresh → 再試行の経路で成功し、トークンファイルの `obtained_at` が更新された。
  - 実測 (2026-09-26): refresh 応答の `access_token` ・ `refresh_token` は交換前と同じ値だった。有効期間内の refresh ではトークンをローテーションしないとみられる。仕様には記載が無い。

## 制約

- `from` ・ `to` は 3 か月以内の範囲でなければならず、API 側で自動補正されることがある。
- `/status/*` エンドポイントはレート制限 60 リクエスト/時間。
- `/oauth/*` (`auth` ・ `token`) にレート制限は無い。
- 取得できるのは `auth-url` で要求し、認可時にユーザが許可したスコープのデータのみ。

## レスポンスの実サンプル

### status innerscan (成功)

```sh
deno task -q --cwd "<scripts の絶対パス>" status innerscan --from 20260920000000 --to 20260927000000
```

出力例 (取得日 2026-09-26、JST)。上のコマンドを実際に実行して得た実物。個人データ保護のため `birth_date` ・ `height` ・ `keydata` の値は桁数を保った別の値に置き換えた。キーの並び・型・`data[]` の構造はそのまま。

```json
{
  "birth_date": "19900101",
  "data": [
    {
      "date": "202609260715",
      "keydata": "65.20",
      "model": "01000165",
      "tag": "6021"
    },
    {
      "date": "202609260715",
      "keydata": "20.80",
      "model": "01000165",
      "tag": "6022"
    }
  ],
  "height": "170.0",
  "sex": "male"
}
```

API はキーをアルファベット順 (`birth_date` ・ `data` ・ `height` ・ `sex`) で返しており、OpenAPI 定義のサンプルの並びとは異なる。`keydata` ・ `height` は数値の文字列。1 回の計測はタグ (6021 = 体重 kg、6022 = 体脂肪率 %) ごとに `data[]` の別要素になり、同じ `date` を共有する。

`status pedometer` ・ `status sphygmomanometer` の応答は OpenAPI 定義上 innerscan と同じ構造 (`birth_date` ・ `height` ・ `sex` ・ `data[]`) だが、この skill では実測していない (2026-09-26 時点で pedometer の scope を持つトークンが無い)。

### エラー応答

```sh
curl -s -w '\nHTTP %{http_code} content-type=%{content_type}\n' 'https://www.healthplanet.jp/status/innerscan.json?access_token=invalid&date=1'
```

出力例 (取得日 2026-09-26、JST)。上のコマンドを実際に実行して得た実物で、無効な `access_token` を渡した場合の応答。

```html
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
  <head>
    <title>Token invalid - Invalid AuthSub token.</title>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  </head>
  <body>
    <h1>Token invalid - Invalid AuthSub token.</h1>
    <h2>Error 401</h2>
  </body>
</html>
HTTP 401 content-type=text/html;charset=UTF-8
```

エラー時の body は JSON ではなく HTML。OpenAPI にはエラー応答の定義が無い。`status` は 401 のときだけ refresh を 1 回挟んで再試行し、それでも失敗すればこの body を stderr に出して exit 1 する。他のステータスは再試行しない。

実測 (2026-09-26): 認可時の scope に無い種別 (innerscan のみで認可したトークンで `status pedometer`) を取得すると、無効トークンと同じ HTTP 401 (`Token invalid - Invalid AuthSub token.`) が返る。body から scope 不足と無効トークンを区別できない。`status` は 401 で refresh を 1 回挟んで再試行するが、scope 不足なら再試行も 401 になる。取得したばかりのトークンで 401 が続く場合は scope を疑い、必要な scope を含めて認可し直す。

## エラー時の挙動

`/oauth/*` ・ `/status/*` のいずれも、非 2xx レスポンスは HTTP ステータスと生のレスポンスボディを stderr に出力し、exit code 1 で終了する。値を捏造しない。エラー応答の JSON 形式は OpenAPI 定義に無い (ダングリングな `{ "error": string }` スキーマのみ) ため、形式を決め打ちせず生のボディをそのまま報告する。

トークンファイルが存在しない場合は `status` コマンドが理由 (先に `token` コマンドを実行する必要がある旨) を添えて stderr に出力し、exit code 1 で終了する。
