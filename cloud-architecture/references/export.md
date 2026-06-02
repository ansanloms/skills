# エクスポート

> [!NOTE]
>
> `--no-sandbox --disable-gpu` を付ければ、ディスプレイの無いヘッドレス環境（Docker / WSL2 など）でも多くの場合そのままレンダリングできる。実行中に標準エラーへ出る GPU / EGL / Vulkan 系の警告は無害な雑音であり、失敗ではない。成否は出力ファイルが生成されたかで判断する。
> `Missing X server or $DISPLAY` エラーで失敗する環境に限り、コマンド先頭に `xvfb-run -a` を付けて仮想ディスプレイで実行する。例: `xvfb-run -a drawio -x -f png ... --disable-gpu --no-sandbox`

> [!NOTE]
>
> `--disable-gpu` `--no-sandbox` は必ず末尾に付ける。
> @refs: https://github.com/jgraph/drawio-desktop/issues/1056

## 出力ファイルの規則

- SVG は `.drawio` と同一ディレクトリに出力する
- `.drawio` は任意の場所・任意のファイル名でよい
- 既存ファイルは上書きする

ファイル名の例を以下に示す。

```
diagram.png
diagram.svg
```

成果物は `.drawio` と `.svg`（または `.png`）の両方を残す。

## 確認用 PNG の出力

開発中の視覚的確認には PNG を使用する。

```bash
# 確認用 PNG（高解像度）
drawio -x -f png --scale 2.5 --border 10 -o diagram.png input.drawio --disable-gpu --no-sandbox

# 透過背景を使用
drawio -x -f png --scale 2.5 --transparent --border 10 -o diagram.png input.drawio --disable-gpu --no-sandbox
```

## 成果物用 SVG の出力

ドキュメントに埋め込む最終成果物には SVG を使用する。

```bash
# 成果物用 SVG
drawio -x -f svg --border 10 -o diagram.svg input.drawio --disable-gpu --no-sandbox

# 透過背景を使用
drawio -x -f svg --transparent --border 10 -o diagram.svg input.drawio --disable-gpu --no-sandbox

# 特定のページをエクスポート
drawio -x -f svg -p 0 --border 10 -o diagram.svg input.drawio --disable-gpu --no-sandbox
```

## 主要なオプション

- `-x`: XML モード（非対話的）
- `-f png|svg`: 出力形式
- `--scale 2.5`: 拡大率（PNG のみ）
- `--transparent`: 透過背景
- `--border 10`: ボーダー幅（ピクセル）
- `-p 0`: ページインデックス（0 から始まる）

## PNG と SVG の使い分け

### PNG(確認用)

- 高解像度で視覚的に確認しやすい
- 画像ビューアで即座に開ける
- レイアウトの微調整時に便利

### SVG(成果物用)

- ベクター形式なので拡大しても画質が劣化しない
- ファイルサイズが小さい
- テキストがそのまま残る
- ドキュメントに埋め込むのに最適
