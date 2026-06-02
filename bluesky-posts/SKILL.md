---
name: bluesky-posts
description: >-
  指定ユーザ (主に自分自身) の Bluesky 直近の投稿を取得し、近況・動向を把握する手順。「最近何を投稿したか」「旅行の写真を見たい」など、特定アカウントの直近 (件数指定または期間指定) の投稿内容を確認したい際に使う。
  AT Protocol の公開 AppView (public.api.bsky.app) の app.bsky.feed.getAuthorFeed を認証なしで叩き、本文・投稿日時・画像・外部リンクを抽出する。画像はダウンロード後に ffmpeg でリサイズして表示する。
  対象は公開投稿のみ。非公開・認証必須のコンテンツの取得や、投稿の作成・削除はできない。
---

# Bluesky 投稿取得

指定ユーザの直近の投稿を取得し、本文・画像で近況や動向を把握する手順。AT Protocol の公開 AppView を認証なしで叩く。投稿の写真をその場で見たい用途を主目的とする。

## 情報源

- 公開 AppView エンドポイント (認証不要): `https://public.api.bsky.app/xrpc/...`
- API ドキュメント: <https://docs.bsky.app/docs/api/app-bsky-feed-get-author-feed>

## 引数

| 引数   | 既定値             | 説明                                                                                                                  |
| ------ | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| actor  | (必須)             | ハンドル (`<handle>`。bsky.social でもカスタムドメインでも可) または DID。ハンドルをそのまま渡せる (DID 解決は不要)。 |
| 範囲   | 直近 20 件         | 件数 (例: 直近 20 件) か期間 (例: 直近 3 日) のどちらか。指定が無ければ直近 20 件。                                   |
| filter | `posts_no_replies` | 投稿種別。既定はオリジナル + リポスト (リプライ除外)。画像目的なら `posts_with_media`。                               |

`filter` の取りうる値は `posts_with_replies` (全部) / `posts_no_replies` (既定) / `posts_with_media` (画像付きのみ) / `posts_and_author_threads` (投稿と自己スレッド)。

## 全体フロー

1. 投稿を取得する (件数指定はそのまま、期間指定は `cursor` で遡る)。
2. レスポンスから本文・日時・リポスト判定・embed を抽出する。
3. 画像付きならダウンロードしてリサイズし、表示する。
4. 整形してユーザに提示する (各投稿の Web URL を併記する)。

## 1. 投稿の取得

基本のコマンド。`actor` にハンドルを直接渡す。

```bash
curl -sS -G 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed' \
  --data-urlencode 'actor=<handle>' \
  --data-urlencode 'limit=20' \
  --data-urlencode 'filter=posts_no_replies'
```

- `<handle>` には対象アカウントのハンドルを入れる (自分の動向把握が主目的なら自分のハンドル)。bsky.social でもカスタムドメインでも可。
- `limit` は最大 100、既定 50。20 件程度の近況把握なら 1 リクエストで足りる。
- ハンドルの実在確認が要るときだけ `com.atproto.identity.resolveHandle` を使う (例: `?handle=<handle>` で `{"did":"did:plc:..."}` が返る)。通常は不要。
- ページネーションは、レスポンス末尾の `cursor` (タイムスタンプ文字列) を次回 `--data-urlencode "cursor=<値>"` に渡すと続きを取得できる。`cursor` が返らなくなったら終端である。
- 期間指定のときは `cursor` を辿りつつ各投稿の活動時刻を見て、閾値より古くなった時点で打ち切る。閾値は現在 UTC から N 日を引いた時刻 (rolling) とし、暦日境界で切る必要があればユーザに確認する。境界が初回ページ内に収まれば `cursor` を辿らず終了してよい。活動時刻はオリジナルは `post.indexedAt`、リポストは `reason.indexedAt` を使う。`record.createdAt` はリポストでは元投稿の時刻を指すため期間判定に使わない。
- 期間指定でページを辿る際は安全上限 (目安 5 ページ / 500 件) を設け、超えたら停止して「この範囲までしか確認していない」と明示する。値は捏造しない。

## 2. 抽出と整形

`jq` で各投稿の主要フィールドを取り出す。

```bash
curl -sS -G 'https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed' \
  --data-urlencode 'actor=<handle>' \
  --data-urlencode 'limit=20' \
  --data-urlencode 'filter=posts_no_replies' \
| jq -r '.feed[] | {
    is_repost: (.reason."$type" == "app.bsky.feed.defs#reasonRepost"),
    time: (.reason.indexedAt // .post.indexedAt),
    author: .post.author.handle,
    text: .post.record.text,
    rkey: (.post.uri | split("/") | last),
    embed: .post.embed."$type",
    images: [ (.post.embed.images // [])[] | {alt, fullsize} ],
    external: (if .post.embed.external then {uri: .post.embed.external.uri, title: .post.embed.external.title} else null end),
    counts: {like: .post.likeCount, repost: .post.repostCount, reply: .post.replyCount}
  }'
```

- `is_repost` が真なら本人による他者投稿のリポストである。`author` (= `post.author.handle`) が元投稿者なので「リポスト: @元投稿者」と区別して示す。`reason.by.handle` がリポストした本人 (= 取得対象アカウント)。
- embed は種別ごとに扱いを変える。
  - `app.bsky.embed.images#view` は画像。`images[]` の `fullsize` / `alt` を使う (ステップ 3 へ)。
  - `app.bsky.embed.external#view` は外部リンク。`external.uri` / `external.title` を添える。
  - `app.bsky.embed.record#view` は引用投稿。`.post.embed.record` に引用元の本文がある。
- Web URL へ変換するには、`rkey` (投稿 URI `at://{did}/app.bsky.feed.post/{rkey}` の末尾) を使い `https://bsky.app/profile/{author}/post/{rkey}` を組み立てて各投稿に併記する。リポストは元投稿者の URL になる (元投稿が `author` の下にあるため正しい)。

## 3. 画像の取得と表示

画像付き投稿は `fullsize` をダウンロードし、トークン削減のためリサイズしてから表示する。写真の閲覧がこの skill の主目的だが、ユーザが本文・日時のみを求めた場合 (期間まとめ等) はこのステップを省略してよい。

```bash
# 1. fullsize を取得 (rkey と連番でファイル名を一意化し、取り違えを防ぐ)
curl -sS -o "/tmp/bluesky-{rkey}-{n}.jpg" "{fullsize_url}"

# 2. ffmpeg で長辺を上限まで縮小 (アスペクト比保持)
ffmpeg -y -loglevel error -i "/tmp/bluesky-{rkey}-{n}.jpg" \
  -vf "scale='min(1024,iw)':'min(1024,ih)':force_original_aspect_ratio=decrease" \
  "/tmp/bluesky-{rkey}-{n}-resized.jpg"
```

- リサイズ後のファイルを `Read` ツールでインライン表示し、`fullsize` の URL を併記する。
- 長辺の既定は 1024px。総枚数が多くトークンが嵩む場合は長辺を 512 〜 768px へ下げる。
- 引数省略の一般的な依頼では、本文は取得分すべてを示し、画像は画像付き投稿ごとに代表 1 枚を新しい順で添える。表示枚数は既定で最大 12 枚程度までとし、超えるときは新しい順を優先する。打ち切ったら省略した旨を明示する。コストは解像度と枚数の 2 軸で縛る。
- 当環境に ImageMagick (`convert` / `magick`) は無い。リサイズは `ffmpeg` を使う。
- 複数枚は各画像を rkey と連番で個別に curl → ffmpeg する単発コマンドの繰り返しで処理する。ループを書く場合、既定シェルが zsh だと bash 連想配列構文 (`${!arr[@]}` 等) で失敗するため `bash -c '...'` でラップする。
- 一時ファイルは実行ごとに使い捨てディレクトリ (`mktemp -d`) を作りその中へ保存すると、過去実行の残骸と混ざらない。
- CDN は URL が `.jpg` でも実体は WebP を返すことがある。`ffmpeg` は拡張子でなく中身で判定するため出力を `.jpg` にすれば JPEG へ再エンコードされ問題ない。`invalid TIFF header in EXIF data` の警告は無害である。
- `alt` があれば説明として添える。
- 「旅行」「あの登山」のような特定の出来事の写真を求められた場合は、画像付き投稿を投稿時刻の近接 (おおむね同一日内、または前後数時間以内) で 1 つの出来事として束ね、束ねた中は出来事の進行順 (古い順) で見せる (束ねない通常の一覧は新しい順)。複数の出来事が見つかったら既定で最新クラスタを主に出し、他クラスタの存在は一行添えて追加取得の要否をユーザに委ねる。1 投稿に複数枚あるときの代表は先頭画像 (`images[0]`) を既定とする。束ねる手掛かりが無ければ直近の画像付き投稿をそのまま新しい順に提示する。

## 注意

- 公開投稿のみが対象。非公開・認証必須のコンテンツは取得できない。
- 0 件のとき: ハンドルの誤りか、当該アカウントが未投稿。`resolveHandle` で実在を確認する。値を捏造しない。
- `limit` に 100 を超える値を渡すとエラー。100 件超はページネーションで対応する。
- 公開 API にも緩いレート制限がある。期間指定でも過度なページングは避け、打ち切り条件を守る。
- 投稿日時はユーザに示す際 JST へ直すと分かりやすい (`indexedAt` / `createdAt` は UTC の ISO 8601)。
