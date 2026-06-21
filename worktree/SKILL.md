---
name: worktree
description: メインの worktree (clone 直下) のブランチを切り替えず、別ブランチの作業を隔離 worktree で行う手順。ファイルを変更する作業で専用ブランチを切るとき、または main から切られた別ブランチを調べるときに git worktree でチェックアウトし branch description を付ける。現在のブランチに対する読み取りだけの調査には使わない。
---

# Worktree

メインの worktree (clone 直下) のブランチを切り替えずに、タスクを別ブランチの worktree へ隔離するための手順。ファイルを変更する作業だけでなく、別ブランチを対象にする読み取り専用の調査にも適用する。

worktree 操作は素の `git worktree` コマンドで行う。

## 原則

- MUST: メインの worktree (clone 直下) が今いるブランチを切り替えない。別のブランチで作業する必要があるなら、そのブランチを worktree でチェックアウトして行う。これはファイル変更か読み取りかを問わない。
- worktree が必要なのは、メインの worktree の現在のブランチとは別のブランチを使うとき。具体的には次の 2 つ。
  - ファイルを変更する作業 (専用ブランチを新規に切る)。メインの worktree で直接編集・コミットしない。
  - 読み取りのみでも、別ブランチを対象にする調査。例として、調査用にブランチを新規に切る場合や、既に main から切られた既存ブランチの状態を調べる場合がある。メインのブランチを切り替えず、その別ブランチを worktree でチェックアウトして調べる。
- worktree が不要なのは、メインの worktree が現在いるブランチに対する読み取りのみの調査・質問への回答・情報収集 (ブランチを変えないため)。
- 既に当該タスク専用の worktree 上にいる場合は新規に切らない。その worktree で続行する。
- この手順が縛るのは worktree のセットアップ (用意 + description 設定) まで。その後のコミット・push・PR は対象外で、通常の Git 運用 (コミット規約等) に従う。

## 作成手順

1. worktree を用意する。`<main>` はメインの worktree の絶対パス。
   - 新しいブランチを切る場合: `git worktree add <main>/.claude/worktrees/<name> -b <branch>`。
   - 既存ブランチ (例として既に main から切られたブランチ) を調べる、または続ける場合: `git worktree add <main>/.claude/worktrees/<name> <branch>` (`-b` を付けない。既存ブランチをそのままチェックアウトする)。
   - path 規約: リポジトリ内の `.claude/worktrees/<name>` に置く。例としてメインが `~/dev/foo` なら worktree は `~/dev/foo/.claude/worktrees/<name>` になる。この path はグローバル gitignore (`~/.config/git/ignore` の `**/.claude/worktrees/*` 等) で除外されていることが多いが、前提にせず、これから作る worktree のパス自体 (`<main>/.claude/worktrees/<name>`) を配置前に `git check-ignore -q` で確認する。除外されていれば (終了コード 0) そのままリポジトリ内に置いてよい。メインの `git status` を汚さない。除外されていなければ (終了コード 1) リポジトリ内に置くと `git status` を汚すため、無視されるパスにするか worktree をリポジトリ外 (例として親ディレクトリ) に置く。
   - `git worktree add` の path 引数は絶対パスで渡す。どの cwd から実行しても所定のディレクトリへ確実に置くため。
   - `<name>` / `<branch>` はタスク内容がわかる短い名前にする。
2. ローカル設定を持ち込む (任意)。`git-worktree-include` コマンドが利用できる環境なら、`git worktree add` で作った path を渡して実行し、`.worktreeinclude` に記載されたローカル未追跡ファイル (`.env` 等) をメインから複製する。コマンドが無い環境では何もしない。
   - MUST: メイン worktree の中をカレントディレクトリにして実行する。`git-worktree-include` はメイン worktree をカレントディレクトリから解決し (引数の path はコピー先にしか使わない)、cwd がメイン worktree の外だと別リポジトリを見て黙って no-op する。手順 1 の `git worktree add` は絶対 path で cwd 非依存だが、この手順は絶対 path を渡しても cwd 非依存にはならない。
   - 例: `(cd <main> && command -v git-worktree-include >/dev/null && git-worktree-include <main>/.claude/worktrees/<name>)`。
   - コマンドはあるが `.worktreeinclude` が無い場合、`git-worktree-include` 自体が何もせず正常終了する。そのため `command -v` のガードだけでよく、`.worktreeinclude` の有無を確認するガードを別途足す必要は無い。
3. その branch に description を設定する (下記「branch description」)。

## branch description

- MUST: 作業対象の worktree は、常に 1 行の branch description を持つこと。これは作成時の一手順ではなく、worktree の steady state に対する不変条件として扱う。調査 (read) 用でも変更 (write) 用でも区別しない。
  - worktree を新規に用意したとき (新ブランチ・既存ブランチを問わず): 着手前に設定する。既存ブランチに既に description があればそのまま使ってよい。
  - 既存の worktree で作業を続けるとき: description が未設定なら、その場で設定してから着手する (誰が作ったかに関係なく適用する)。
- 設定方法: `git config branch.<branch>.description "<作業概要>"`。
- 内容は、その worktree で何をするかが分かる作業概要を**1 行**で書く。文体はコミットメッセージの subject に準じ、日本語で書く。
- 1 行に収める理由: worktree の一覧表示ツールによっては `branch.<branch>.description` の先頭 1 行しか読まない (2 行目以降を捨てる) ため。複数行にすると一覧でタスクを識別できなくなる。
- 確認・一覧は非対話のコマンドを使う。description は `git config --get branch.<branch>.description`、worktree の一覧は `git worktree list` で引く。対話的な worktree セレクタはプログラム的に実行すると入力待ちでハングするため使わない。
