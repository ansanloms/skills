# skills

自前の Agent Skills 集。

## 前提: apm

skill の取り込みには [apm](https://github.com/microsoft/apm) CLI を使う。

## 取り込み

### 任意のプロジェクトで使う

```sh
cd <project>
apm install ansanloms/skills/find-docs --target claude
# → <project>/.claude/skills/ にコピー + apm.yml / apm.lock.yaml に記録
```

`--target` は配置先ハーネス (claude/cursor/codex 等)。Claude Code なら `.claude/skills/` に入る。

## 依存を持つ skill

`scripts/package.json` に `dependencies` を持つ skill (google-health、mountain-weather、ja-tech-proofread) は、実行時に `scripts/node_modules` が要る。`apm install`/`apm update` はこれを入れず、`apm update` は既存の `node_modules` も消す。依存 skill 自身の `lifecycle:` も利用側では実行されない。そこで、利用側プロジェクトの `apm.yml` に次の `lifecycle:` を足す。

```yaml
lifecycle:
  post-install:
  - type: command
    description: npm ci
    command: 'rc=0; for d in .claude/skills/*/scripts; do [ -f "$d/package-lock.json" ] || continue; node -e ''const p=require(process.argv[1]);process.exit(Object.keys(p.dependencies||{}).length?0:1)'' "$PWD/$d/package.json" || continue; echo "npm ci: $d"; npm ci --omit=dev --prefix "$d" || rc=1; done; exit $rc'
    timeoutSec: 300
```

- スクリプトの cwd は利用側プロジェクトの root。`package-lock.json` があり、`dependencies` が空でない `scripts/` だけに `npm ci --omit=dev` を実行する。ある skill の `npm ci` が失敗しても残りの skill の処理は続ける。apm は失敗を表に出さない (`apm install` は何も出力せず exit 0 で終わる) ので、`ls -d .claude/skills/*/scripts/node_modules` で導入を確認する。
- 追加後と、このブロックを編集した後は `apm lifecycle trust` を実行する。順序は、ブロックの追加 → `apm lifecycle trust` → `apm install` にする。信頼前の `apm install` では lifecycle がスキップされる。skill を導入済みでも、信頼後にもう一度 `apm install` を実行すれば `post-install` が発火して `node_modules` が入る (変更が無い `apm install` でも入ることを確認した)。未信頼のままだと apm が `Skipped N untrusted project script(s). Run 'apm lifecycle trust' to enable them.` と出してスキップする。ブロックを編集すると信頼が外れるので再実行する。
- `apm update` は `post-install` と `post-update` の両方を発火し、`apm install` は `post-install` を発火する。`post-install` だけで足りる。
- スクリプトの失敗は無音。`apm install` は何も出さず exit 0 で終わり、スクリプトの標準出力も出ない。`ls -d .claude/skills/*/scripts/node_modules` で `node_modules` を確認する。
- 上のループは配置先が `.claude/skills` (`--target claude`) の前提。他のハーネスは `for` のパスを読み替える。
- apm 0.33.0 で 2026-10-13 に確認した。

## 更新

```sh
cd <project> && apm update
```

上の `lifecycle:` を入れていれば、更新時に依存も自動で入れ直される。
