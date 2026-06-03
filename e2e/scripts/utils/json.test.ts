import { assertEquals, assertThrows } from "@std/assert";
import { parseSpecJson, toSpecJson } from "./json.ts";
import { ValidationError } from "../types/validation-error.ts";
import { type Spec } from "../types/spec.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function samplePath(filename: string): string {
  return new URL(`../samples/${filename}`, import.meta.url).pathname;
}

function readSample(filename: string): Promise<string> {
  return Deno.readTextFile(samplePath(filename));
}

async function readSpec(filename: string): Promise<Spec> {
  return JSON.parse(await Deno.readTextFile(samplePath(filename))) as Spec;
}

// ---------------------------------------------------------------------------
// parseSpecJson: 正常系
// ---------------------------------------------------------------------------

Deno.test("parseSpecJson: 最小構成の valid JSON を返す", async () => {
  const spec = parseSpecJson(await readSample("spec-minimal.json"));

  assertEquals(spec.title, "テスト");
  assertEquals(spec.scenarios.length, 1);
  assertEquals(spec.scenarios[0].name, "S1");
  assertEquals(spec.scenarios[0].steps, ["ステップ1"]);
});

Deno.test("parseSpecJson: 全フィールドを含む valid JSON を返す", async () => {
  const spec = parseSpecJson(await readSample("spec-parse-json-full.json"));

  assertEquals(spec.title, "購入テスト");
  assertEquals(spec.description, "購入フロー。");
  assertEquals(spec.case?.columns, ["lang"]);
  assertEquals(spec.case?.rows, [{ lang: "/ja" }]);
  assertEquals(spec.scenarios[0].case?.columns, ["itemId"]);
  assertEquals(spec.scenarios[0].steps, ["ページを開く"]);
});

// ---------------------------------------------------------------------------
// parseSpecJson: 異常系
// ---------------------------------------------------------------------------

Deno.test("parseSpecJson: 不正な JSON 文字列は ValidationError を throw する", () => {
  const err = assertThrows(() => parseSpecJson("not json"), ValidationError);
  assertEquals(err.issues[0].path, "/");
  assertEquals(err.issues[0].message.startsWith("invalid JSON:"), true);
});

Deno.test("parseSpecJson: title が空文字は ValidationError を throw する", () => {
  const input = JSON.stringify({
    title: "",
    scenarios: [{ name: "S1", steps: ["ステップ1"] }],
  });

  const err = assertThrows(() => parseSpecJson(input), ValidationError);
  assertEquals(err.issues[0].path, "/title");
});

Deno.test("parseSpecJson: required フィールド title がない場合は ValidationError を throw する", () => {
  const input = JSON.stringify({
    scenarios: [{ name: "S1", steps: ["ステップ1"] }],
  });

  const err = assertThrows(() => parseSpecJson(input), ValidationError);
  assertEquals(err.issues[0].path, "/");
});

Deno.test("parseSpecJson: $schema フィールドを含む入力を正常にパースする", () => {
  const input = JSON.stringify({
    $schema: "../../../.claude/skills/e2e/scripts/schemas/spec.schema.json",
    title: "テスト",
    scenarios: [{ name: "S1", steps: ["ステップ1"] }],
  });

  const spec = parseSpecJson(input);
  assertEquals(spec.title, "テスト");
  assertEquals(spec.scenarios[0].steps, ["ステップ1"]);
});

Deno.test("parseSpecJson: steps のアイテムが空文字は ValidationError を throw する", () => {
  const input = JSON.stringify({
    title: "テスト",
    scenarios: [{ name: "S1", steps: [""] }],
  });

  const err = assertThrows(() => parseSpecJson(input), ValidationError);
  assertEquals(err.issues[0].path, "/scenarios/0/steps/0");
});

// ---------------------------------------------------------------------------
// toSpecJson
// ---------------------------------------------------------------------------

Deno.test("toSpecJson: 最小構成を整形 JSON 文字列で返す", async () => {
  const spec = await readSpec("spec-minimal.json");
  const json = toSpecJson(spec);
  const parsed = JSON.parse(json);

  assertEquals(parsed.title, "テスト");
  assertEquals(parsed.scenarios[0].name, "S1");
  assertEquals(parsed.scenarios[0].steps, ["ステップ1"]);
});

Deno.test("toSpecJson: 末尾に改行を付与する", async () => {
  const spec = await readSpec("spec-minimal.json");
  const json = toSpecJson(spec);

  assertEquals(json.endsWith("\n"), true);
});

Deno.test("toSpecJson: インデント 2 スペースで整形される", async () => {
  const spec = await readSpec("spec-minimal.json");
  const json = toSpecJson(spec);
  const expected = JSON.stringify(spec, null, 2) + "\n";

  assertEquals(json, expected);
});

Deno.test("toSpecJson: schema を指定すると $schema が先頭に出力される", async () => {
  const spec = await readSpec("spec-minimal.json");
  const json = toSpecJson(spec, "../schemas/spec.schema.json");
  const parsed = JSON.parse(json) as Record<string, unknown>;

  assertEquals(parsed.$schema, "../schemas/spec.schema.json");
  // $schema が先頭キーになっていることを確認
  assertEquals(Object.keys(parsed)[0], "$schema");
});

Deno.test("toSpecJson: schema 未指定のとき $schema が含まれない", async () => {
  const spec = await readSpec("spec-minimal.json");
  const json = toSpecJson(spec);
  const parsed = JSON.parse(json) as Record<string, unknown>;

  assertEquals("$schema" in parsed, false);
});

Deno.test("toSpecJson: description が undefined のとき JSON に含まれない", async () => {
  const spec = await readSpec("spec-minimal.json");
  const json = toSpecJson(spec);
  const parsed = JSON.parse(json);

  assertEquals("description" in parsed, false);
});

Deno.test("toSpecJson: 全フィールドを正しく出力する", async () => {
  const spec = await readSpec("spec-to-json-full.json");
  const json = toSpecJson(spec);
  const parsed = JSON.parse(json);

  assertEquals(parsed.title, "購入テスト");
  assertEquals(parsed.description, "EC サイトの購入フロー。");
  assertEquals(parsed.case.columns, ["lang"]);
  assertEquals(parsed.scenarios[0].case.columns, ["itemId"]);
});
