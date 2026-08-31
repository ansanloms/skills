# CLAUDE.md

自前の Agent Skills を管理するリポジトリ。各 skill を `<name>/SKILL.md` で分割管理し、ここで追加・修正する。

## このリポジトリの役割

- skill の source of truth。skill の編集はこのリポジトリでのみ行う。
- クライアントにはコピーされた実体が入る (vendor 方式)。両者で内容は重複するが、編集点はこのリポジトリに一本化する。

## 構成

- `<name>/SKILL.md` を 1 skill = 1 ディレクトリで配置する。これがこのリポジトリの提供する skill。
- frontmatter は `name` と `description` が必須。`description` が skill の発動トリガになる。「何をするか + いつ発動するか」を具体的に書く。曖昧だと発動しない。
- `<name>/README.md` は各 skill の人間向け説明で、SKILL.md の frontmatter を情報源にする。SKILL.md とは別に用意し、新設・更新時に追随させる (後述のフロー参照)。
- `apm.yml` の `devDependencies` は skill を磨く・使うための道具。empirical-prompt-tuning は外部由来で配布対象ではない。ja-tech-proofread は自リポジトリの配布 skill を自分でも使うための自己参照で、複製は remote main のスナップショット。
- コミットするのは `apm.yml`/`apm.lock.yaml`、各 skill の `SKILL.md`・`README.md`・`scripts/`・`references/`・`assets/`、`.github/`、`.gitignore`、`CLAUDE.md`。`apm_modules/`・`.claude/skills/` (依存 skill)・`coverage/` は gitignore 済みで、依存 skill は `apm install` で再生成する。

## クローン後のセットアップ

```sh
apm install     # 依存 skill (ja-tech-proofread、empirical-prompt-tuning) を .claude/skills/ に復元
```

## skill を追加・修正するフロー

1. `<name>/SKILL.md` を作成・編集し、frontmatter (`name`/`description`) と本文を書く。
2. `<name>/README.md` を同じ内容に合わせて作成・修正する。skill を新設したら必ず用意し、既存 skill の frontmatter や対象範囲を変えたら追随させる。
3. 外部 API やコマンドを叩く skill なら、レスポンスの実サンプルを本文に載せる (後述)。
4. empirical-prompt-tuning skill でブラッシュアップする (後述)。
5. 変更した md に ja-tech-proofread の fix を当てる (後述)。
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

## 推敲と検査

日本語の markdown は skill `ja-tech-proofread` で推敲する。機械層 (textlint-rule-preset-ansanloms + deno fmt) を含み、既定の fix モードは修正を skill 内で完結させる (著者の判断が要る箇所はその場で確認される)。変更したファイルを列挙して渡す。一括で見たい場合も対象ファイルを列挙する (ディレクトリ走査はしない)。

実行する時期: md を変更したら、コミット前にその md へ fix を当てる。skill の `scripts/` (TS・設定) を変更したら、そのディレクトリで `deno task lint` を通す。`.claude/skills/` の実体は apm が remote の main から解決したスナップショットで、ローカルの編集は反映されない。skill への変更は main に入った後に `apm install` で複製へ反映される。skill として実行される定義も複製側のため、探索順を含む定義の変更は main 反映後に効く。開発中に変更を検証するときは、リポジトリ内の `ja-tech-proofread/SKILL.md` をパス指定で実行者に読ませる。

機械層だけを直接使う場合は `deno task -q --cwd ja-tech-proofread/scripts textlint <絶対パス...>` (fmt は `fmt`/`fmt:check` task)。rule の正本は preset リポジトリで、このリポジトリでは上書きしない。preset の新しいタグが出たら `ja-tech-proofread/scripts/deno.json` の alias と `deno.lock` を更新する (手順は `ja-tech-proofread/scripts/README.md`)。機械層の正はリポジトリ内の `ja-tech-proofread/scripts`。preset を jsDelivr の URL で参照しているため、Dependabot は rule パッケージの更新を追えるが preset のタグ上げは追えない。タグ上げは手作業で行う。

TS を含む skill の `scripts/` は各ディレクトリの `deno.json` で自己完結しており、`deno task lint`/`deno task fix` をそのディレクトリで実行する。root に deno の設定・task は無い。

textlint と markdown 記法が衝突しやすい点は次のとおり。

- インラインコード・リンクの前後、全角文字と半角文字の間にスペースを入れる (ja-spacing)。詰めると検出される。
- リストの継続行が `「` などの括弧で始まると jtf-style に引っかかる。1 行にまとめるか、括弧始まりを避ける。

## 注意

- skill 化した内容を元の always-on rule (例: dotfiles の `.claude/rules/`) にも残すと、常時ロードとオンデマンドで二重に効く。冗長なら元 rule を整理すること。
