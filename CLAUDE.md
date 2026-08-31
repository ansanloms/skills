# CLAUDE.md

自前の Agent Skills を管理するリポジトリ。各 skill を `<name>/SKILL.md` で分割管理し、ここで追加・修正する。

## このリポジトリの役割

- skill の source of truth。skill の編集はこのリポジトリでのみ行う。
- クライアントにはコピーされた実体が入る (vendor 方式)。両者で内容は重複するが、編集点はこのリポジトリに一本化する。

## 構成

- `<name>/SKILL.md` を 1 skill = 1 ディレクトリで配置する。これがこのリポジトリの提供する skill。
- frontmatter は `name` と `description` が必須。`description` が skill の発動トリガになる。「何をするか + いつ発動するか」を具体的に書く。曖昧だと発動しない。
- `<name>/README.md` は各 skill の人間向け説明で、SKILL.md の frontmatter を情報源にする。SKILL.md とは別に用意し、新設・更新時に追随させる (後述のフロー参照)。
- `apm.yml` の `devDependencies` は skill を磨くための道具 (empirical-prompt-tuning)。配布対象ではない。
- コミットするのは `apm.yml`/`apm.lock.yaml` と各 `<name>/SKILL.md`・`<name>/README.md`、lint・plugin 構成。`apm_modules/`/`.claude/skills/` (依存 skill)/`index.js` (plugin の bundle)/`coverage/` は gitignore 済みで、それぞれ `apm install`/`deno task build`/`deno task test` で再生成する。

## クローン後のセットアップ

```sh
apm install     # devDependency (empirical-prompt-tuning) を .claude/skills/ に復元
```

## skill を追加・修正するフロー

1. `<name>/SKILL.md` を作成・編集し、frontmatter (`name`/`description`) と本文を書く。
2. `<name>/README.md` を同じ内容に合わせて作成・修正する。skill を新設したら必ず用意し、既存 skill の frontmatter や対象範囲を変えたら追随させる。
3. 外部 API やコマンドを叩く skill なら、レスポンスの実サンプルを本文に載せる (後述)。
4. empirical-prompt-tuning skill でブラッシュアップする (後述)。
5. lint を通す (後述)。
6. コミットする (Conventional Commits、日本語、絵文字なし)。

## レスポンスの実サンプル

外部 API やコマンドを叩き、その出力をパースして値を取り出す skill は、代表的なエンドポイント・コマンドについて**実際のレスポンスのサンプルを最低 1 つ**本文に載せる。キー名の表と散文の説明だけで代用しない。エラー時のレスポンスの形も同様に載せる。出力を人間がそのまま読むだけで機械処理しないものは対象外とする。

- サンプルは実際に叩いて得た実物を使う。記憶や推測から再構成しない。
- **サンプルの直上に、取得に使った完全なコマンドと取得日を書く。**実物であるという主張を後から検証できるようにするため。これが無いとレビュー時に毎回 API を叩き直すはめになり、対象が消えた後は検証不能になる。
- 長い場合は後続の処理に必要な構造が読み取れる範囲へ絞り、省略した旨をサンプル内に明記する。エントリの途中で切った場合も同様に明記する。
- 実行できない場合 (認証情報が無い、副作用がある等) は捏造せず、公式ドキュメントの該当箇所を出典 URL 付きで引用し、出所を本文に明記する。実測したものと引用したものを 1 つの見出しで括らない。

リクエストの完全な例だけがあってレスポンスの実サンプルが無いと、値の型・ネストの深さ・欠測時の形が本文から確定できず、パースが推測になる。しかも外れ方はエラーで止まる方向ではなく、黙って誤った値を返す方向へ倒れる。失敗として表面化しないぶん質が悪い。

書き手は API の応答を既に知っているため、この情報を書く必要を感じにくい。自明に見える情報ほど落ちる。

## ブラッシュアップ

skill/プロンプトを新規作成・大幅改訂したら、empirical-prompt-tuning skill を使って磨く。

バイアスを排した subagent に実際に skill を読ませて両面評価し、不明瞭点を潰すまで反復する手法。`description` と本文の整合、発動トリガの曖昧さの検出に効く。

## lint フロー

textlint (日本語の文章) と deno fmt/deno lint で検査する。

textlint の rule は `textlint-rule-preset-ansanloms` (jsDelivr の tag 付き URL を `deno.json` の import map で alias) をそのまま有効化している。rule の追加・変更・緩和は preset 側で行い、このリポジトリの `.textlintrc.js` では上書きしない。

preset への移行 (2026-08-31) で検出範囲が変わった点: `no-ai-list-formatting` は無効から `{ disableBoldListItems: true }` になり、箇条書き先頭の太字ラベルは許容、絵文字は検出される。JTF の `1.1.1.本文` (`no-mix-dearu-desumasu` と矛盾する指摘を出していた) と `2.1.5.カタカナ` (旧設定では有効化が効いていなかった) は無効。各 rule の設定理由は preset の README に書く。

preset を jsDelivr の URL で参照しているため、このリポジトリの Dependabot は textlint の rule パッケージの更新を追えない。rule パッケージの更新は preset リポジトリ側の Dependabot が行い、preset の新しいタグが出たら `deno.json` の alias のタグを手で上げ、`rm -f deno.lock` の後に `deno install` と `deno task fix && deno task lint` を実行して `deno.lock` を再生成し、両方をコミットする。

textlint は preset を裸の名前 (`preset-ansanloms`) で解決するため、`textlint/textlint-rule-preset-ansanloms/index.js` に import map の alias を re-export する 1 行のラッパーを置き、`deno.json` の `textlint` task で `--rules-base-directory` にそのディレクトリを渡している。`No rules found` が出たら、この 2 点 (alias の URL が到達可能か、`--rules-base-directory` が絶対パスか) を疑う。

- 検査: `deno task lint`
- 自動修正: `deno task fix`

textlint と markdown 記法が衝突しやすい点は次のとおり。

- インラインコード・リンクの前後、全角文字と半角文字の間にスペースを入れる (ja-spacing)。詰めると検出される。
- リストの継続行が `「` などの括弧で始まると jtf-style に引っかかる。1 行にまとめるか、括弧始まりを避ける。

## 注意

- skill 化した内容を元の always-on rule (例: dotfiles の `.claude/rules/`) にも残すと、常時ロードとオンデマンドで二重に効く。冗長なら元 rule を整理すること。
