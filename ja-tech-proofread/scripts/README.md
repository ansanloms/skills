# ja-tech-proofread scripts

ja-tech-proofread skill の機械層を実行する Node の薄い層。表記・文法の機械判定は textlint、markdown の整形は oxfmt が担う。textlint の rule は第三者の 4 preset (ja-technical-writing・ja-spacing・jtf-style・ai-writing) と proofdict を `.textlintrc.json` で直接有効化する。Node.js 24 以上が必要。

## ファイル構成

- `package.json`: `textlint`、`oxfmt`、rule パッケージを `dependencies` に固定する。テストと lint 用の道具は `devDependencies` に置く。`test`・`lint`・`fix` script はこのディレクトリ自身の検査用で、推敲対象には使わない。
- `package-lock.json`: 依存の固定。
- `.npmrc`: `engine-strict`、`ignore-scripts`、`audit`、`min-release-age=7`、`save-exact`、`fund=false`。
- `.textlintrc.json`: rule の有効・無効と options を定める。理由は下の「rule の設定」にある。
- `textlintrc.test.ts`: `.textlintrc.json` の検査。preset の下に書いた rule 名の実在、4 preset の rule 数と同名の有無、最上位キー、proofdict の `dictURL` を確かめる。
- `tsconfig.json`・`.oxlintrc.json`: `tsc --noEmit` と oxlint の設定。対象は `*.ts`。
- `.oxfmtrc.json`: oxfmt の設定。`proseWrap: preserve` (日本語の段落を折り返さない) と `embeddedLanguageFormatting: off` (コードフェンス内を整形しない)。推敲対象の markdown の整形にも使う。
- `.ignore-none`: 空ファイル。`--ignore-path` に渡して、呼び出し元 cwd の `.textlintignore`・`.prettierignore`・`.gitignore` が対象を黙って除外するのを防ぐ (これらを渡さないと、textlint は除外されても終了コード 0 で指摘 0 件に見え、oxfmt は終了コード 2 になる。2026-10-12 実測)。
- `.gitignore`: `node_modules/` と `.cache/` を除外する。
- `README.md`: この文書。

## rule の設定

rule の有効・無効と options は `.textlintrc.json` が定める。textlint は options を preset の既定へマージせず、rule 単位で置換する。書かなかった rule は preset の既定のままで、書いた rule は値を丸ごと書き直す必要がある。

| preset               | rule                                                                                                    | 値                                                                             | 理由 (導入時の記録がある分のみ)                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ja-technical-writing | `sentence-length`                                                                                       | `max: 600`                                                                     | 記録なし。                                                                                                                                                           |
| ja-technical-writing | `max-kanji-continuous-len`                                                                              | `max: 15`                                                                      | 記録なし。                                                                                                                                                           |
| ja-technical-writing | `no-mix-dearu-desumasu`                                                                                 | 本文・見出し・箇条書きとも「である」、`strict: true`                           | 文体を決める rule はこれ 1 つに絞る。                                                                                                                                |
| ja-technical-writing | `ja-no-weak-phrase`                                                                                     | 無効                                                                           | 機械判定では誤検出が出るため。skill の意味層 (S2) が扱う。                                                                                                           |
| ja-technical-writing | `no-doubled-joshi`                                                                                      | 無効                                                                           | 機械判定では誤検出が出るため。skill の意味層 (S3) が扱う。                                                                                                           |
| ja-technical-writing | `ja-no-mixed-period`                                                                                    | `forceAppendPeriod: true`                                                      | 記録なし。                                                                                                                                                           |
| ja-spacing           | `ja-space-between-half-and-full-width`                                                                  | `space: always`                                                                | 記録なし。                                                                                                                                                           |
| ja-spacing           | `ja-space-around-code`                                                                                  | `before: true`、`after: true`                                                  | 記録なし。                                                                                                                                                           |
| ja-spacing           | `ja-space-around-link`                                                                                  | `before: true`、`after: true`                                                  | 記録なし。                                                                                                                                                           |
| jtf-style            | `1.1.1.本文`                                                                                            | 無効                                                                           | 多数決で敬体を要求し、`no-mix-dearu-desumasu` と矛盾する指摘を出すため。                                                                                             |
| jtf-style            | `1.1.2.見出し`                                                                                          | 無効                                                                           | jtf-style のこの rule は検出と同時に autofix (句点の削除) を行い、検出だけにする設定が無い。autofix を避けるため無効にする。見出し末尾の句点は機械層では検出しない。 |
| jtf-style            | `1.1.3.箇条書き`                                                                                        | 無効                                                                           | 文体を決める rule は `no-mix-dearu-desumasu` 1 つに絞るため。                                                                                                        |
| jtf-style            | `3.1.1.全角文字と半角文字の間`                                                                          | 無効                                                                           | 記録なし。                                                                                                                                                           |
| jtf-style            | `4.2.6.ハイフン(-)`、`4.2.7.コロン(：)`、`4.3.1.丸かっこ（）`、`4.3.2.大かっこ［］`、`4.3.7.山かっこ<>` | 無効                                                                           | 記録なし。                                                                                                                                                           |
| ai-writing           | `no-ai-list-formatting`                                                                                 | `disableBoldListItems: true`                                                   | 「**ラベル**: 説明」の形の箇条書きを許容するため、太字ラベルの検出だけを止める。装飾絵文字の検出は残す。                                                             |
| proofdict            | (rule 全体)                                                                                             | `dictURL: https://azu.github.io/proof-dictionary/`、`autoUpdateInterval: 1000` | `dictURL` を渡さないと「Not found dictionary in Config」を報告する。                                                                                                 |

`2.1.5.カタカナ` は jtf-style の既定が無効で、`.textlintrc.json` には書かない。JTF の外来語辞書は「プラットフォーム → プラットホーム」「インタフェース → インターフェイス」のような表記を要求し、一般的な技術文書の表記と合わないため、無効のままにする。

preset に無い rule 名を書いても textlint は無視し、エラーにしない。`textlintrc.test.ts` が rule 名の実在を検査する。

## 起動方法

`node_modules` が無いときは `npm ci --omit=dev --prefix "<scripts の絶対パス>"` で入れる。以降は cwd を問わず、絶対パスで次のとおり呼ぶ。

```sh
npx --no --prefix "<scripts の絶対パス>" -- textlint --config "<scripts の絶対パス>/.textlintrc.json" --ignore-path "<scripts の絶対パス>/.ignore-none" [--fix] <対象ファイルの絶対パス...>
npx --no --prefix "<scripts の絶対パス>" -- oxfmt -c "<scripts の絶対パス>/.oxfmtrc.json" --ignore-path "<scripts の絶対パス>/.ignore-none" [--check] <対象ファイルの絶対パス...>
```

- `--` は必須。npm 11 は `--config` や `--fix` を npx 自身のフラグとして解釈するため、`--` で区切らないと textlint に届かない。
- `--prefix` は bin の解決先の指定で、cwd は呼び出し元のまま変わらない。相対パスの対象は呼び出し元の cwd 基準で解決される (2026-10-12 実測)。
- `--no` を付けて、未インストールの依存を npx が勝手に取得しないようにする。`node_modules` が無いと `npm error npx canceled due to missing packages and no YES option` を出して終了コード 1 になる。
  - 以下は `node_modules` を別名へ退避した状態で、cwd を `/` にして実行して得た実物の出力 (取得コマンドは次のとおり、取得日 2026-10-12、実行後に `node_modules` は戻した。パスはリポジトリ外の probe)。

    ```sh
    npx --no --prefix "<scripts の絶対パス>" -- textlint --config "<scripts の絶対パス>/.textlintrc.json" --ignore-path "<scripts の絶対パス>/.ignore-none" /home/ansanloms/.claude/jobs/4da019b2/tmp/jtp-r1/cwd/t.md
    ```

    ```
    npm error npx canceled due to missing packages and no YES option: ["textlint@15.8.0"]
    npm error A complete log of this run can be found in: /home/ansanloms/.npm/_logs/2026-10-12T13_19_00_893Z-debug-0.log
    ```
- oxfmt は `--prefix` 側の設定を見ないため、`-c` に絶対パスで設定を渡す。`..` を含むパスは受け付けない。
- `--fix` を付けると自動修正が効く rule (全角半角スペース等) だけをその場で直す。修正できない指摘が残っていても `--fix` の出力には載らず、終了コードは 0 になる。残りは `--fix` 無しで再実行して確認する。
- oxfmt の `--check` は整形差分ありで終了コード 1、対象が見つからないと 2。`--check` 無しの書き込みモードは変更の有無を出力せず、終了コードは変更なしでも変更ありでも 0。

## 依存が入っていないときの挙動

rule が解決できない状態 (`node_modules` に rule パッケージが無い、`.textlintrc.json` の rule 名が誤っている等) で実行すると、rule が 1 つも読み込めないまま textlint が終了する。1 つでも解決できない rule があると、残りの rule も有効にならない。`package-lock.json` が変わった後に `node_modules` を入れ直していない場合も、現行の `.textlintrc.json` の rule を解決できず同じ出力になる。この場合は `npm ci --omit=dev --prefix "<scripts の絶対パス>"` をやり直す。以下は `.textlintrc.json` の `@proofdict/proofdict` を存在しない名前 `@proofdict/proofdictx` に書き換えて得た実物の出力の先頭 3 行 (取得コマンドは次のとおり、取得日 2026-11-25、実行後に `.textlintrc.json` は戻した)。

```sh
npx --no --prefix "<scripts の絶対パス>" -- textlint --config "<scripts の絶対パス>/.textlintrc.json" --ignore-path "<scripts の絶対パス>/.ignore-none" /home/ansanloms/.claude/jobs/ce913ece/tmp/r2/v.md
```

```
== No rules found, textlint hasn’t done anything ==

Possible reasons:
```

終了コードは 1。rule の解決失敗が「rule が 0 件」という形で現れるため、SKILL.md の手順ではこの `No rules found` を「機械層: 実行不可 (理由)」として扱う。

## 開発

このディレクトリで次を実行する。

```sh
npm ci            # devDependencies も入れる
npm test          # node --test
npm run lint      # oxlint && oxfmt --check && tsc --noEmit
npm run fix       # oxlint --fix && oxfmt
```

テストは `.textlintrc.json` の内容 (rule 名の実在、最上位キー、`dictURL`、`package.json` の依存との対応) を検査する。

## 注意

- `.cache/`: proofdict の辞書キャッシュは `<scripts>/.cache/kvs-node-localstorage/` に作られる。呼び出し元の cwd には作られない (cwd を `/` や別ディレクトリにして実測、2026-10-12)。`.gitignore` で除外している。
- rule の options は書いた値で丸ごと置換され、preset の既定とマージされない。無効にした rule を再び有効にしたいときは、その rule の値を `true` (既定の options) か options のオブジェクトに置き換える。
