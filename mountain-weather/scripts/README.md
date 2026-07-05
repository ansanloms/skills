# mountain-weather CLI ツール

てんくらの登山指数 HTML と Open-Meteo の山頂数値予報を取得・解析する CLI ツール。

## fetch-index

山のコード (`kad.html?code=` の数値) を渡すと、てんくらの登山指数ページを取得し、今日・明日 (時間帯別) と週間の登山指数・気温・風を JSON で返す。次を一括で行う。

- Shift_JIS の HTML を取得して UTF-8 にデコードする (iconv 不要)。
- キャッシュ回避クエリを付けて 2 回取得し fingerprint (日付・指数 gif・気圧面) を突き合わせる。不一致なら 3 回目で再現した版を採り、再現しなければ悪い側 (指数スコア最大 = 慎重側) を採る。CDN が別の山・古い版を返す事故への対策。
- 取得物が要求した山か検証する (`alt="登山指数"` の存在・`code=` の一致)。外れれば値を捏造せず exit 1 で停止する。
- 時間帯別・週間の各テーブルを列位置で対応づけて抽出する。過去時間帯 (`t_no`)・予報範囲外は `null`。同一見出しの分割版・麓の天気テーブルは正本にしない。

引数解析は [gunshi](https://gunshi.dev/) を使う。`--help` で使い方、各オプションに短縮形がある。

```sh
deno task fetch-index --code=<山のコード> [--type=15]   # -c / -t
deno task fetch-index --file=<iconv 済み UTF-8 HTML>    # -f。オフライン (取得済み HTML を解析)
deno task fetch-index --help                            # 使い方
```

`--code` は地域リスト `kasel.html` から引く (SKILL.md 参照)。`--type` は既定 15 (登山)。`--code` と `--file` のどちらも無ければ usage を出して exit 1。

### 出力 (JSON)

```jsonc
{
  "code": "01150271",
  "title": "青山の天気 | ...",
  "note": "2 回取得が一致", // どの版を採用したか
  "fingerprint": "7/3(金)|mnt1.gif|...",
  "tables": [
    {
      "kind": "timeband", // 時刻列 = timeband / 日付列 = weekly
      "heading": "今日7/3(金)",
      "columns": ["00", "03", "06", "09", "12", "15", "18", "21"],
      "index": [null, null, null, null, null, "A", "A", "A"], // 過去時間帯は null
      "levels": [
        {
          "alt": "高度760m付近",
          "hPa": 925,
          "temp": [null, null, null, null, null, 16, 15, 14],
          "wind": [/* ... */ { "dir": "SSW", "ms": 2 }]
        }
        // 950hPa ...
      ]
    }
    // 明日 (timeband) / 週間予報 (weekly) ...
  ]
}
```

- `index` は各列の登山指数 A/B/C。`null` は過去時間帯 (`t_no`) または予報範囲外 (週間の最も先)。指数と時刻・日付は同じ列インデックスで対応する。
- `levels` は気圧面ごとの気温 (℃) と風 (`dir` 16 方位、`ms` m/s)。低山は 925/950hPa、高山は 600/700hPa など。山頂標高に近い気圧面を選ぶのは呼び出し側の判断 (SKILL.md 参照)。

パース本体は `cli/parse.ts` の `parseDayTables` に分離してある (ネットワーク非依存でテスト可能)。HTML 構造が変わって抽出に失敗したらここを更新する。

## エラー時の挙動

`--code`/`--file` 未指定、取得物の検証失敗 (`alt="登山指数"` 0 件・`code=` 不一致)、テーブル抽出 0 件のいずれも stderr にメッセージを出力し exit code 1 で終了する。抽出 0 件は HTML 構造変化の可能性があるため、値を捏造せず停止する。

## fetch-openmeteo

山頂の緯度・経度・標高を渡すと、Open-Meteo forecast API (`api.open-meteo.com/v1/forecast`) から山頂標高指定の数値予報 (1 時間ごと) を取得し JSON で返す。次を一括で行う。

- `elevation` に山頂標高を渡して取得する。API 側で 90m DEM ベースの標高補正が適用される。timezone は Asia/Tokyo、風速単位は m/s、取得変数 (気温・湿度・風速・突風・降水量・降水確率・凍結高度・天気コード) は固定。
- レスポンスの `elevation` が指定値と一致することを検証する。Open-Meteo は指定した標高をそのまま echo するため、不一致は標高補正が指定標高で行われていないことを意味する。
- API の並列配列 (`hourly.time` と各変数の配列) を時刻 1 点 = 1 レコードに整形する。全変数の存在と時刻列との長さ一致を検証し、欠測 (`null`) はそのまま残す (補完しない)。
- `weather_code` は WMO コードの数値のまま出力する (和名変換はしない。読み方は SKILL.md)。

引数解析は fetch-index と同じく [gunshi](https://gunshi.dev/) を使う。`--help` で使い方、各オプションに短縮形がある。

```sh
deno task fetch-openmeteo --lat=<緯度> --lon=<経度> --elevation=<山頂標高 m> [--days=<1..7>]
# 短縮形: -a / -o / -e / -d。--days の既定は 3、最大 7
```

### 出力 (JSON)

```jsonc
{
  "source": "Open-Meteo (https://open-meteo.com/)",
  "license": "CC BY 4.0",
  "latitude": 35.375, // モデル格子に丸めた値が返る
  "longitude": 138.75,
  "elevation": 3776, // 指定値と一致することを検証済み
  "timezone": "Asia/Tokyo",
  "units": { "temperature_2m": "°C", "wind_speed_10m": "m/s" /* ... */ },
  "hourly": [
    {
      "time": "2026-07-06T00:00",
      "temperature_2m": -1.1,
      "relative_humidity_2m": 99,
      "wind_speed_10m": 1.9,
      "wind_gusts_10m": 6.5,
      "precipitation": 1.4,
      "precipitation_probability": 88,
      "freezing_level_height": 4860,
      "weather_code": 75
    }
    // 1 時間ごと × days 日分 ...
  ]
}
```

リクエスト構築・検証・整形の本体は `cli/openmeteo.ts` に分離してある (ネットワーク非依存でテスト可能)。API 構造が変わって検証に失敗したらここを更新する。

### エラー時の挙動

`--lat`/`--lon`/`--elevation` の未指定・数値でない・範囲外 (`--days` は 1〜7 の整数)、HTTP エラー、`error: true` のレスポンス、`elevation` の指定値との不一致、hourly の構造欠落・長さ不一致のいずれも stderr にメッセージを出力し exit code 1 で終了する。値の捏造・部分出力はしない。
