import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);

type RuleOptions = Record<string, unknown>;
type Preset = { rules: Record<string, unknown> };

const config = JSON.parse(readFileSync(new URL("./.textlintrc.json", import.meta.url), "utf8")) as {
  rules: Record<string, unknown>;
};

// .textlintrc.json の preset キーと、それを提供するパッケージ。
const presets: Record<string, string> = {
  "preset-ja-technical-writing": "textlint-rule-preset-ja-technical-writing",
  "preset-ja-spacing": "textlint-rule-preset-ja-spacing",
  "preset-jtf-style": "textlint-rule-preset-jtf-style",
  "@textlint-ja/preset-ai-writing": "@textlint-ja/textlint-rule-preset-ai-writing",
};

// ai-writing は `{ default: { rules, rulesConfig } }` の形で出てくるため、あれば `.default` を剥がす。
function loadPreset(pkg: string): Preset {
  const mod = require(pkg) as Preset & { default?: Preset };
  return mod.default ?? mod;
}

const loaded = Object.entries(presets).map(([key, pkg]) => ({ key, preset: loadPreset(pkg) }));

// preset に無いキーは textlint が無視してエラーにしないため、typo を自前で検出する。
test("preset の下に書いた各ルール名が、その preset に実在する", () => {
  for (const { key, preset } of loaded) {
    const options = config.rules[key] as RuleOptions;
    assert.equal(typeof options, "object", `${key} の設定がオブジェクトでない`);
    for (const name of Object.keys(options)) {
      assert.equal(name in preset.rules, true, `${key} に存在しないルール: ${name}`);
    }
  }
});

test("4 preset のルール数の合計が 76 で、preset 間に同名ルールが無い", () => {
  const names = loaded.flatMap(({ preset }) => Object.keys(preset.rules));
  assert.equal(names.length, 76);
  assert.equal(new Set(names).size, names.length);
});

test("@proofdict/proofdict の options に dictURL がある", () => {
  const options = config.rules["@proofdict/proofdict"] as RuleOptions;
  assert.equal(typeof options.dictURL, "string");
});

test("package.json の依存が .textlintrc.json の参照先を含む", () => {
  const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
    dependencies: Record<string, string>;
  };
  const expected = [
    ...Object.values(presets),
    "@proofdict/textlint-rule-proofdict",
    "textlint-rule-jtf-style-heading-no-fix",
  ];
  for (const name of expected) {
    assert.equal(name in pkg.dependencies, true, `dependencies に ${name} が無い`);
  }
});
