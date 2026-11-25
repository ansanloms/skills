import assert from "node:assert/strict";
import { test } from "node:test";
import { TextlintKernel } from "@textlint/kernel";
import markdownPluginMod from "@textlint/textlint-plugin-markdown";
import rule, { withoutFix } from "./index.ts";

// CJS/ESM 相互運用で default export が `{ default: { Processor } }` の形で
// 1 段ネストされるため、テストでも `.default` を 1 段剥がす。
const markdownPlugin = (markdownPluginMod as { default?: unknown }).default ?? markdownPluginMod;

test("rule は linter だけを持ち、fixer を持たない", () => {
  assert.equal(typeof rule.linter, "function");
  assert.equal("fixer" in rule, false);
});

// 実際の @textlint/kernel の TextlintRuleContextImpl は fixer / Syntax を
// prototype 上の getter (アクセサ) として持ち、report はインスタンスの
// アロー関数フィールドとして持つ。その形を模した上で constructor 末尾で
// Object.freeze(this) する (実際の実装と同じ凍結の仕方)。プレーンなデータ
// プロパティのまま freeze すると、withoutFix の Proxy が fixer に別の値を
// 返す際に Proxy の不変条件 (frozen own data property は同じ値を返す必要が
// ある) に違反してしまうため、production の形に合わせる必要がある。
class StubContext {
  static syntax = {};
  static realFixer = { removeRange: () => "real" };
  report = () => {};
  constructor() {
    Object.freeze(this);
  }
  get fixer() {
    return StubContext.realFixer;
  }
  get Syntax() {
    return StubContext.syntax;
  }
}

test("withoutFix は options を linter に転送し、fixer を no-op にする", () => {
  let seen: { context: unknown; options: unknown } | undefined;
  const stub = (context: object, options?: unknown) => {
    seen = { context, options };
    return {};
  };
  const wrapped = withoutFix(stub);

  wrapped(new StubContext(), { dummy: true });

  assert.deepEqual(seen?.options, { dummy: true });
  const wrappedContext = seen?.context as {
    fixer: { removeRange: (...args: unknown[]) => unknown };
    Syntax: unknown;
    report: unknown;
  };
  assert.equal(wrappedContext.fixer.removeRange(0, 1), undefined);
  assert.equal(wrappedContext.Syntax, StubContext.syntax);
  assert.equal(typeof wrappedContext.report, "function");
});

test("@textlint/kernel での lint 統合", async (t) => {
  const kernel = new TextlintKernel();
  const dirtyText = `# 見出しである。

本文である。
`;
  const options = {
    ext: ".md",
    filePath: "test.md",
    plugins: [{ pluginId: "markdown", plugin: markdownPlugin as any }],
    rules: [{ ruleId: "jtf-style-heading-no-fix", rule: rule as any, options: true }],
  };

  await t.test("見出し末尾の句点が検出され、message に fix が無い", async () => {
    const result = await kernel.lintText(dirtyText, options);
    assert.equal(result.messages.length, 1);
    const [message] = result.messages;
    assert.equal(message.ruleId, "jtf-style-heading-no-fix");
    assert.equal(message.message.includes("句点"), true);
    assert.equal(message.fix, undefined);
  });

  await t.test("fixText でも本文が変わらない", async () => {
    const fixResult = await kernel.fixText(dirtyText, options);
    assert.equal(fixResult.output, dirtyText);
  });

  await t.test("句点の無い見出しは 0 件になる", async () => {
    const result = await kernel.lintText("# 見出し\n\n本文である。\n", options);
    assert.equal(result.messages.length, 0);
  });
});
