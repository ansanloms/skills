---
name: google-health
description: >-
  Google Health API (旧 Fitbit Web API) から体重・体脂肪・歩数・睡眠・心拍などの身体情報を curl で取得する手順。OAuth 2.0 (Desktop アプリフロー) の初回セットアップ・アクセストークンの更新・データ型別の REST 呼び出しを扱う。ユーザが Google Health / Fitbit / Pixel Watch に記録された身体情報・健康データの取得や集計を求めた際に使う。取得 (read) 専用で、データの書き込み・削除には使わない。
---

# Google Health 身体情報取得

Google Health API (旧 Fitbit Web API) v4 の REST エンドポイントを curl で直接叩き、ユーザの身体情報を取得する手順。外部ツールには依存しない。

## 情報

- Google Health API 概要: <https://developers.google.com/health>
- データ型一覧: <https://developers.google.com/health/data-types>
- REST リファレンス: <https://developers.google.com/health/reference/rest>

## 前提

- データは Google アカウントに連携済みの Fitbit/Pixel Watch から Google Health API へ同期されていること。Health Connect (Android 端末内) にのみ存在するデータは対象外。
- 取得 (read) 専用。readonly scope のみ要求し、データを変更する呼び出し (POST/PATCH/DELETE によるデータ点の作成・更新・削除) は行わない。集計用の `:dailyRollUp` は POST だがデータを変更しない。
- JSON の抽出に `jq` を使う。無ければ導入するか、`python3 -m json.tool` 等で代用する。

## 認証情報の置き場所

`~/.config/google-health/` (chmod 700) に以下を置く。ディレクトリが無ければ先に作る。

```sh
mkdir -p ~/.config/google-health
chmod 700 ~/.config/google-health
```

- `client_secret.json` — GCP からダウンロードした OAuth クライアントシークレット (chmod 600)
- `token.json` — 認可コード交換のレスポンス。refresh_token を含む (chmod 600)

MUST: この配下のファイルをリポジトリへコミットしない。トークン・シークレットの値を会話やログへ貼り付けない。

## 初回セットアップ (一度だけ)

`token.json` が既にあれば不要。無ければ次の手順で行う。1〜3 は GCP Console での手作業で、ユーザに依頼する。

1. GCP プロジェクトを用意し、Google Health API を有効化する。
2. OAuth クライアント (種別: Desktop app) を作成し、クライアントシークレット JSON を `~/.config/google-health/client_secret.json` に置く。
3. OAuth 同意画面が未審査の間は、テストユーザに自分の Google アカウントを登録する。
4. 認可 URL を組み立て、ユーザにブラウザで開いて同意してもらう。

```sh
CLIENT_ID=$(jq -r .installed.client_id ~/.config/google-health/client_secret.json)
SCOPE="https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly%20https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly%20https://www.googleapis.com/auth/googlehealth.sleep.readonly"
echo "https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=http%3A%2F%2Flocalhost%3A8085&response_type=code&scope=${SCOPE}&access_type=offline&prompt=consent"
```

- MUST: scope は上記 readonly の 3 つのみ。write 系 scope を要求しない。
- 同意後、ブラウザは `http://localhost:8085/?code=...` へリダイレクトされ、接続エラー画面になる (それで正常)。アドレスバーの `code` パラメータの値を控えてもらう。認可コードの有効期間は短いので、すぐ次の手順で交換する。

5. 認可コードをトークンへ交換する。

```sh
CLIENT_SECRET=$(jq -r .installed.client_secret ~/.config/google-health/client_secret.json)
curl -s https://oauth2.googleapis.com/token \
  -d client_id="${CLIENT_ID}" \
  -d client_secret="${CLIENT_SECRET}" \
  -d code="<認可コード>" \
  -d grant_type=authorization_code \
  -d redirect_uri=http://localhost:8085 \
  -o ~/.config/google-health/token.json
chmod 600 ~/.config/google-health/token.json
```

- `token.json` に `refresh_token` が入っていることを `jq -e '.refresh_token != null' ~/.config/google-health/token.json >/dev/null` の終了コードで確認する (値そのものを画面やログへ出さない)。入っていない場合は認可 URL の `prompt=consent` が抜けていないか確認して 4 からやり直す。

## アクセストークンの取得 (セッションごと)

アクセストークンの有効期間は約 1 時間。作業のたびに refresh_token から取り直すのが簡単で確実。

```sh
ACCESS_TOKEN=$(curl -s https://oauth2.googleapis.com/token \
  -d client_id="$(jq -r .installed.client_id ~/.config/google-health/client_secret.json)" \
  -d client_secret="$(jq -r .installed.client_secret ~/.config/google-health/client_secret.json)" \
  -d refresh_token="$(jq -r .refresh_token ~/.config/google-health/token.json)" \
  -d grant_type=refresh_token | jq -r .access_token)
```

- API 呼び出しが 401 を返したら、このコマンドで取り直して再実行する。

## データ取得

### 共通事項

- エンドポイント: `https://health.googleapis.com/v4/users/me/dataTypes/<型名>/dataPoints`。型名は URL では kebab-case (`body-fat`)、filter 内では snake_case (`body_fat`)。
- ヘッダ: `Authorization: Bearer ${ACCESS_TOKEN}`。
- filter の比較演算子は `>=` と `<` のみ。`<=` と `>` は使えない。終端に指定日を含めたいときは「翌日 0 時 `<`」で書く。
- 時刻フィールドは型により 2 系統ある。取り違えると 400 になる。
  - physical_time (UTC 実時刻): 体重・体脂肪・心拍。値は UTC の `2026-07-01T00:00:00Z` 形式。ローカル日の境界を指定するときは 0 時を UTC へ換算する (例: JST の 2026-07-01 0 時 → `2026-06-30T15:00:00Z`。`date -u -d '2026-07-01T00:00:00+09:00' +%Y-%m-%dT%H:%M:%SZ` で求まる)。
  - civil time (ローカル日時): 歩数・睡眠。値は `2026-07-01T00:00:00` 形式で、`Z` やオフセットを付けるとエラーになる。
- ページング: レスポンスに `nextPageToken` があれば、同じリクエストに `pageToken` を付けて続きを取る。
- 並び順は仕様として保証を確認できていない。「最新 N 件」が欲しいときは期間を絞って取得し、`nextPageToken` が無くなるまで全ページを回収してから、タイムスタンプで整列して選ぶ。初期窓は直近 24 時間 (起点は `date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ` で算出) とし、件数が足りなければ窓を過去へ広げて再取得する。
- レスポンスの形: list は `{"dataPoints": [...], "nextPageToken": "..."}` (続きが無ければ `nextPageToken` は無い)。各データ点は `name`・`dataSource` と、型名 (camelCase。`weight`・`bodyFat`・`heartRate`・`steps`・`sleep`) のオブジェクトを持ち、値と時刻はその中にある。`:dailyRollUp` は `{"rollupDataPoints": [...]}` で、各点が `civilStartTime`・`civilEndTime` (それぞれ内側に `date` オブジェクト `{year, month, day}` を持つ) と型名オブジェクト内のメトリクスを持つ。抽出式は最初のレスポンスで実フィールドを確認してから確定する。

### 体重

```sh
curl -s -G 'https://health.googleapis.com/v4/users/me/dataTypes/weight/dataPoints' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  --data-urlencode 'filter=weight.sample_time.physical_time >= "2026-06-30T15:00:00Z" AND weight.sample_time.physical_time < "2026-07-31T15:00:00Z"' \
  --data-urlencode 'pageSize=100'
```

- 値は `weightGrams` (グラム単位)。ユーザへは kg へ換算して提示する。
- 抽出例: `jq '.dataPoints[].weight | {time: .sampleTime.physicalTime, weightGrams}'`
- 日毎の推移として提示する場合、`physicalTime` をユーザのローカルタイムゾーンへ変換してから日付へ割り当てる。同一日に複数測定があれば平均を代表値とし、測定回数を併記する。

### 体脂肪率

```sh
curl -s -G 'https://health.googleapis.com/v4/users/me/dataTypes/body-fat/dataPoints' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  --data-urlencode 'filter=body_fat.sample_time.physical_time >= "2026-06-30T15:00:00Z" AND body_fat.sample_time.physical_time < "2026-07-31T15:00:00Z"' \
  --data-urlencode 'pageSize=100'
```

- 値は `percentage` (パーセント値)。
- 抽出例: `jq '.dataPoints[].bodyFat | {time: .sampleTime.physicalTime, percentage}'`。日毎の扱いは体重と同じ。

### 歩数

日毎の合計は `:dailyRollUp` で取る。

```sh
curl -s -X POST 'https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"range":{"start":{"date":{"year":2026,"month":8,"day":3}},"end":{"date":{"year":2026,"month":8,"day":10}}},"windowSizeDays":1}'
```

- MUST: 歩数の合計に list (`GET .../dataPoints`) を使わない。1 分毎の interval が返るだけで歩数値が得られない。
- `range.end` は終端翌日を指定する (end は範囲に含まれない)。例は 2026-08-03 から 2026-08-09 までの 7 日分。
- 値の `countSum` は文字列で返る。集計時は数値へ変換する。`"0"` は「装着していたが 0 歩」の真のゼロで、日付ごと欠けているのは未装着・未同期。
- 抽出例: `jq '.rollupDataPoints[] | {date: .civilStartTime.date, countSum: .steps.countSum}'`

### 睡眠

```sh
curl -s -G 'https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  --data-urlencode 'filter=sleep.interval.civil_end_time >= "2026-08-03T00:00:00" AND sleep.interval.civil_end_time < "2026-08-10T00:00:00"' \
  --data-urlencode 'pageSize=25'
```

- 睡眠は `sleep.interval.civil_end_time` (起床側) でのみ絞れる。開始時刻のフィールドでは filter できない。
- 1 ページ最大 25 件。`nextPageToken` で辿る。
- レコードは睡眠セッション単位で、昼寝や分割睡眠があると同じ日に複数レコードになる。日毎の集計では起床側の日付でグループ化して `minutesAsleep` を合算する。
- filter の `civil_end_time` に対応するレスポンス側のフィールドは `interval.endTime` (UTC 実時刻)。`endUtcOffset` を足すとローカル時刻になるので、グループ化はローカルへ変換した日付で行う。
- 抽出例: `jq '.dataPoints[].sleep | {start: .interval.startTime, end: .interval.endTime, minutesAsleep: .summary.minutesAsleep}'`
- `minutesAsleep` の型 (数値か文字列か) は未確認。最初のレスポンスで確認してから計算する。

### 心拍

```sh
curl -s -G 'https://health.googleapis.com/v4/users/me/dataTypes/heart-rate/dataPoints' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  --data-urlencode 'filter=heart_rate.sample_time.physical_time >= "2026-08-08T15:00:00Z"' \
  --data-urlencode 'pageSize=100'
```

- 値の `beatsPerMinute` は文字列で返る。
- 抽出例: `jq '.dataPoints[].heartRate | {time: .sampleTime.physicalTime, beatsPerMinute}'`

### その他のデータ型

SpO2・HRV・血糖・栄養等、他のデータ型も同じエンドポイント形式で取れる。型名と scope は公式のデータ型一覧 (<https://developers.google.com/health/data-types>) で確認する。この skill が要求している scope の範囲外の型は、認可のやり直しが必要になる。やり直す場合も追加するのは readonly scope のみとする。

## 注意点

- 欠測日はゼロではなく欠落として返る。日毎集計で日付が抜けていても 0 と解釈せず、平均の分母にも入れない。
- 数値が文字列で返るフィールドがある。確認済みは歩数の `countSum` と心拍の `beatsPerMinute`。その他のフィールドも最初のレスポンスで型を確認してから計算する。
- civil time のフィールドはユーザのローカル日で記録されている。physical_time との混在集計をしない。
