# CLAUDE.md

自前の Agent Skills を管理するリポジトリ。各 skill を `<name>/SKILL.md` で分割管理し、ここで追加・修正する。

## このリポジトリの役割

- skill の source of truth。skill の編集はこのリポジトリでのみ行う。
- クライアントにはコピーされた実体が入る (vendor 方式)。両者で内容は重複するが、編集点はこのリポジトリに一本化する。

## 構成

- `<name>/SKILL.md` を 1 skill = 1 ディレクトリで配置する。これがこのリポジトリの提供する skill。
- frontmatter は `name` と `description` が必須。`description` が skill の発動トリガになる。「何をするか + いつ発動するか」を具体的に書く。曖昧だと発動しない。
- `apm.yml` の `devDependencies` は skill を磨くための道具 (empirical-prompt-tuning)。配布対象ではない。
- コミットするのは `apm.yml` / `apm.lock.yaml` と各 `<name>/SKILL.md`、lint・plugin 構成。`apm_modules/` / `.claude/skills/` (依存 skill) / `index.js` (plugin の bundle) / `coverage/` は gitignore 済みで、それぞれ `apm install` / `deno task build` / `deno task test` で再生成する。

## クローン後のセットアップ

```sh
apm install     # devDependency (empirical-prompt-tuning) を .claude/skills/ に復元
```

## skill を追加・修正するフロー

1. `<name>/SKILL.md` を作成・編集し、frontmatter (`name` / `description`) と本文を書く。
2. empirical-prompt-tuning skill でブラッシュアップする (後述)。
3. lint を通す (後述)。
4. コミットする (Conventional Commits、日本語、絵文字なし)。

## ブラッシュアップ

skill / プロンプトを新規作成・大幅改訂したら、empirical-prompt-tuning skill を使って磨く。

バイアスを排した subagent に実際に skill を読ませて両面評価し、不明瞭点を潰すまで反復する手法。`description` と本文の整合、発動トリガの曖昧さの検出に効く。

## lint フロー

textlint (日本語の文章) と deno fmt / deno lint で検査する。

- 検査: `deno task lint`
- 自動修正: `deno task fix`

textlint と markdown 記法が衝突しやすい点は次のとおり。

- インラインコード・リンクの前後、全角文字と半角文字の間にスペースを入れる (ja-spacing)。詰めると検出される。
- リストの継続行が `「` などの括弧で始まると jtf-style に引っかかる。1 行にまとめるか、括弧始まりを避ける。

## 注意

- skill 化した内容を元の always-on rule (例: dotfiles の `.claude/rules/`) にも残すと、常時ロードとオンデマンドで二重に効く。冗長なら元 rule を整理すること。
