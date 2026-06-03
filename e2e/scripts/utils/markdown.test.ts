import { assertEquals, assertStringIncludes } from "@std/assert";
import { toMarkdown } from "./markdown.ts";
import { type Spec } from "../types/spec.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function samplePath(filename: string): string {
  return new URL(`../samples/${filename}`, import.meta.url).pathname;
}

async function readSpec(filename: string): Promise<Spec> {
  return JSON.parse(await Deno.readTextFile(samplePath(filename))) as Spec;
}

// ---------------------------------------------------------------------------
// toMarkdown: 最小構成
// ---------------------------------------------------------------------------

Deno.test("toMarkdown: 最小構成", async () => {
  const spec = await readSpec("spec-login-minimal.json");
  const md = toMarkdown(spec);

  assertStringIncludes(md, "# ログインテスト");
  assertStringIncludes(md, "## S1");
  assertStringIncludes(md, "1. ページを開く");
});

// ---------------------------------------------------------------------------
// toMarkdown: 全フィールド
// ---------------------------------------------------------------------------

Deno.test("toMarkdown: 全フィールド", async () => {
  const spec = await readSpec("spec-to-md-full.json");
  const md = toMarkdown(spec);

  assertStringIncludes(md, "# 購入テスト");
  assertStringIncludes(md, "EC サイトの購入フローを確認する。");
  assertStringIncludes(md, "| lang");
  assertStringIncludes(md, "currency |");
  assertStringIncludes(md, "| /ja");
  assertStringIncludes(md, "---");
  assertStringIncludes(md, "## 1. カート追加");
  assertStringIncludes(md, "商品をカートに追加する。");
  assertStringIncludes(md, "| itemId |");
  assertStringIncludes(md, "1. トップページを開く");
  assertStringIncludes(md, "2. 商品をカートに追加する");
  assertEquals(md.includes("no."), false);
});

// ---------------------------------------------------------------------------
// toMarkdown: description の markdown 記法
// ---------------------------------------------------------------------------

Deno.test("toMarkdown: description の markdown 記法がエスケープされない", () => {
  const spec: Spec = {
    title: "テスト",
    description: "**注意**: `code` を確認する。",
    scenarios: [{ name: "S1", steps: ["ステップ1"] }],
  };
  const md = toMarkdown(spec);
  assertStringIncludes(md, "**注意**");
  assertStringIncludes(md, "`code`");
});

Deno.test("toMarkdown: scenario.description の markdown 記法がエスケープされない", () => {
  const spec: Spec = {
    title: "テスト",
    scenarios: [{
      name: "S1",
      description: "**前提**: *ログイン済み* であること。",
      steps: ["ステップ1"],
    }],
  };
  const md = toMarkdown(spec);
  assertStringIncludes(md, "**前提**");
  assertStringIncludes(md, "*ログイン済み*");
});

// ---------------------------------------------------------------------------
// toMarkdown: ${ENV_VAR} / <column> エスケープ除去
// ---------------------------------------------------------------------------

Deno.test("toMarkdown: テーブルセル内 ${ENV_VAR} の _ がエスケープされない", () => {
  const spec: Spec = {
    title: "テスト",
    case: {
      columns: ["case", "path"],
      rows: [{ case: "1", path: "/shop/${SHOP_URL}/product/${PRODUCT_CODE}" }],
    },
    scenarios: [{ name: "S1", steps: ["ステップ1"] }],
  };
  const md = toMarkdown(spec);
  assertStringIncludes(md, "${SHOP_URL}");
  assertStringIncludes(md, "${PRODUCT_CODE}");
  assertEquals(md.includes("\\_"), false);
});

Deno.test("toMarkdown: ステップ内の識別子 _ がエスケープされない（product_1 等）", () => {
  const spec: Spec = {
    title: "テスト",
    scenarios: [{
      name: "S1",
      steps: ["product_1 `${TEST_ID}` が含まれることを確認する"],
    }],
  };
  const md = toMarkdown(spec);
  assertStringIncludes(md, "product_1");
  assertEquals(md.includes("\\_"), false);
});

Deno.test("toMarkdown: ステップ内 <column-name> は \\< にエスケープされる（HTML タグと区別するため）", () => {
  const spec: Spec = {
    title: "テスト",
    scenarios: [{ name: "S1", steps: ["@login-frontend-<lang>"] }],
  };
  const md = toMarkdown(spec);
  assertStringIncludes(md, "@login-frontend-\\<lang>");
});

// ---------------------------------------------------------------------------
// toMarkdown: インラインコード
// ---------------------------------------------------------------------------

Deno.test("toMarkdown: ステップ内のインラインコードを正しく出力する", async () => {
  const spec = await readSpec("spec-inline-code-step.json");
  const md = toMarkdown(spec);
  assertStringIncludes(md, "`${FRONTEND_URL}/`");
});

// ---------------------------------------------------------------------------
// toMarkdown: devices
// ---------------------------------------------------------------------------

Deno.test("toMarkdown: devices を含む spec は先頭に YAML フロントマターを出力する", () => {
  const spec: Spec = {
    title: "デバイステスト",
    devices: {
      pc: { viewport: { width: 1920, height: 1080 } },
      mobile: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent: "Mozilla/5.0 (iPhone)",
      },
    },
    scenarios: [{ name: "S1", steps: ["ステップ1"] }],
  };
  const md = toMarkdown(spec);
  // YAML フロントマターが先頭に出力される
  assertStringIncludes(md, "---\n");
  assertStringIncludes(md, "devices:");
  assertStringIncludes(md, "pc:");
  assertStringIncludes(md, "1920");
  assertStringIncludes(md, "mobile:");
  assertStringIncludes(md, "isMobile: true");
  assertStringIncludes(md, "Mozilla/5.0 (iPhone)");
  // Markdown 本文はフロントマターの後
  assertStringIncludes(md, "# デバイステスト");
});
