# healthplanet

タニタの Health Planet API (OAuth2) から、体重・体脂肪率・歩数・血圧などの記録を取得する skill。

## できること

- OAuth2 の認可コードフローで Health Planet と連携 (認可 URL の組み立て、認可コードのトークン交換)
- アクセストークンの期限切れを自動検出し、リフレッシュトークンで更新してからデータ取得
- 体重・体脂肪率 (innerscan)・歩数 (pedometer)・血圧 (sphygmomanometer) の記録を取得

## 限界

- innerscan で取得できるのは体重と体脂肪率だけで、筋肉量・基礎代謝等は取得できない。
- データの登録・削除、食事ログ、筋トレメニューの管理には対応しない (取得専用)。
- 初回はユーザ自身がブラウザで認可し、発行された認可コードを渡す必要がある (完全な自動化はできない)。
- `/status/*` はレート制限 60 リクエスト/時間。
- 計測データの日時 (`date`) はタイムゾーン変換をせず、API から返る生の文字列のまま扱う。

## 発動する場面

「体重の推移」「最近の体重」「体脂肪率」「今日の歩数」「血圧」「脈拍」「Health Planet」「タニタ」などを聞かれたとき。

## 導入

```sh
apm install ansanloms/skills/healthplanet --target claude
```

詳細は [SKILL.md](./SKILL.md) を参照。
