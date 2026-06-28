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

## 更新

```sh
cd <project> && apm update
```
