# google-health

Google Health API (旧 Fitbit Web API) から体重・体脂肪・歩数・睡眠・心拍などの身体情報を curl で取得する skill。

## できること

- 体重・体脂肪・歩数・睡眠・心拍の取得と日毎集計
- OAuth 2.0 (Desktop アプリフロー、readonly scope のみ) の初回セットアップとトークン更新の案内
- その他のデータ型 (SpO2・HRV・血糖・栄養等) への同形式でのアクセス

## 対象外

- データの書き込み・更新・削除 (取得専用)
- Health Connect (Android 端末内) にのみ存在するデータ

## 発動する場面

Google Health/Fitbit/Pixel Watch に記録された身体情報・健康データの取得や集計を求められたとき。

## 導入

```sh
apm install ansanloms/skills/google-health --target claude
```

詳細は [SKILL.md](./SKILL.md) を参照。
