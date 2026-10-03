# healthplanet CLI ツール

タニタの Health Planet API (OAuth2) と通信し、認可 URL の組み立て・トークン交換・計測データ取得する CLI ツール。

出力を `jq` 等で機械処理するときは `deno task -q <task>` で実行する。`-q` が無いとタスクランナーのバナー行が stdout に混ざる。

## 構成

内部動作はライブラリ (`lib/`) に分離してある。ネットワーク非依存部分はテスト可能。

- `lib/config.ts`: 環境変数の読み込み。
- `lib/oauth.ts`: `/oauth/auth` の URL 組み立て、`/oauth/token` の交換・リフレッシュ。
- `lib/token-file.ts`: トークンファイルの読み書き (パーミッション 0o600、既存ファイルも上書き時に揃える) と期限判定。
- `lib/status.ts`: `/status/{kind}.json` の取得と日時形式の検証。
- `lib/status-with-auth.ts`: `lib/status.ts` の取得にトークンの期限管理 (ローカル時刻判定 + 401 時の 1 回の再試行) を組み合わせたもの。`status` コマンドが使う。

## auth-url

`/oauth/auth` の認可 URL を組み立てて標準出力へ返す。`HEALTHPLANET_CLIENT_ID` ・ `HEALTHPLANET_REDIRECT_URI` (省略可) のみ使う。

```sh
deno task auth-url [--scope=<カンマ区切りスコープ>]   # -s。既定 innerscan
```

## token

認可コード (`/oauth/auth` から 10 分以内) をアクセストークン・リフレッシュトークンに交換し、`HEALTHPLANET_TOKEN_PATH` へ JSON で保存する。`HEALTHPLANET_TOKEN_PATH` の親ディレクトリはあらかじめ作成しておく (自動作成しない)。

```sh
deno task token <認可コード>
```

トークンファイルの形式。

```jsonc
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 2592000,
  "obtained_at": "2026-09-26T00:00:00.000Z" // ISO 8601 (UTC)
}
```

標準出力にはトークンそのものは出さず、保存先・有効期限・取得時刻のみ返す。

## status

`/status/{kind}.json` を取得し、レスポンスをそのまま (未加工で) 標準出力へ返す。取得前にトークンファイルを読み、期限切れ (`obtained_at` + `expires_in` 秒 - 60 秒のマージンを過ぎている、判定はローカル時刻) なら自動でリフレッシュしてから取得する。加えて、取得リクエストが 401 を返した場合は refresh_token で 1 回だけ更新して再試行する (401 以外のステータスは再試行しない。再試行後も失敗すればそのままエラーにする)。

```sh
deno task status <innerscan|pedometer|sphygmomanometer> [--date=0|1] [--from=<14桁>] [--to=<14桁>] [--tag=<タグ>]
```

- `--date` は既定 `1` (測定日)。`0` は登録日。
- `--from` ・ `--to` は 14 桁 `yyyyMMddHHmmss` (3 か月以内)。省略時は API 既定 (3 か月前から)。
- `--tag` は絞り込むタグ (カンマ区切り)。

## エラー時の挙動

`/oauth/*` ・ `/status/*` のいずれも非 2xx レスポンスは HTTP ステータスと生のレスポンスボディを stderr に出力し、exit code 1 で終了する。トークンファイルが読めない場合や書けない場合も、親ディレクトリを事前に作成する必要がある旨を添えて stderr にメッセージを出し、exit code 1 で終了する。読めない場合とは未生成・破損・親ディレクトリの欠如を、書けない場合とは親ディレクトリの欠如を指す。いずれも値を捏造して継続しない。

## 開発

```sh
deno task lint   # deno lint && deno check && deno fmt --check
deno task fix    # deno lint --fix && deno fmt
deno task test   # deno test -A --parallel --shuffle --coverage
```
