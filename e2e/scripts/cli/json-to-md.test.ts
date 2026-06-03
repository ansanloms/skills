import { assertEquals } from "@std/assert";
import { resolvePath } from "../utils/io.ts";

const CLI = resolvePath(import.meta.url, "./json-to-md.ts");
const SAMPLE_DIR = resolvePath(import.meta.url, "../samples");

const dec = (b: Uint8Array) => new TextDecoder().decode(b);

async function run(
  args: string[],
  stdin?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  if (stdin !== undefined) {
    const child = new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", CLI, ...args],
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(stdin));
    await writer.close();
    const { code, stdout, stderr } = await child.output();
    return { code, stdout: dec(stdout), stderr: dec(stderr) };
  }
  const { code, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", CLI, ...args],
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  }).output();
  return { code, stdout: dec(stdout), stderr: dec(stderr) };
}

Deno.test("json-to-md: stdin → stdout（最小構成）", async () => {
  const input = JSON.stringify({
    title: "タイトル",
    scenarios: [{ name: "S1", steps: ["ステップ1"] }],
  });
  const { code, stdout, stderr } = await run([], input);
  assertEquals(code, 0, `stderr: ${stderr}`);
  assertEquals(stdout.includes("# タイトル"), true);
  assertEquals(stdout.includes("## S1"), true);
  assertEquals(stdout.includes("1. ステップ1"), true);
});

Deno.test("json-to-md: --input ファイル → stdout", async () => {
  const { code, stdout, stderr } = await run([
    "--input",
    `${SAMPLE_DIR}/spec-minimal.json`,
  ]);
  assertEquals(code, 0, `stderr: ${stderr}`);
  assertEquals(stdout.includes("# テスト"), true);
  assertEquals(stdout.includes("## S1"), true);
});

Deno.test("json-to-md: --input → --output ファイル書き込み", async () => {
  const outPath = await Deno.makeTempFile({ suffix: ".md" });
  try {
    const { code } = await run([
      "--input",
      `${SAMPLE_DIR}/spec-minimal.json`,
      "--output",
      outPath,
    ]);
    assertEquals(code, 0);
    const content = await Deno.readTextFile(outPath);
    assertEquals(content.includes("# テスト"), true);
  } finally {
    await Deno.remove(outPath);
  }
});

Deno.test("json-to-md: 不正な JSON → exit 1 + stderr に ValidationError", async () => {
  const { code, stderr } = await run([], "not json");
  assertEquals(code, 1);
  assertEquals(stderr.includes("Validation failed:"), true);
  assertEquals(stderr.includes("invalid JSON:"), true);
});

Deno.test("json-to-md: スキーマ違反（title なし）→ exit 1", async () => {
  const input = JSON.stringify({ scenarios: [{ name: "S1", steps: ["s"] }] });
  const { code, stderr } = await run([], input);
  assertEquals(code, 1);
  assertEquals(stderr.includes("Validation failed:"), true);
});

Deno.test("json-to-md: 共通テーブルを含む JSON を Markdown に変換できる", async () => {
  const input = JSON.stringify({
    title: "テスト",
    case: {
      columns: ["no.", "lang"],
      rows: [{ "no.": "1", lang: "" }, { "no.": "2", lang: "/en" }],
    },
    scenarios: [{ name: "S1", steps: ["ステップ1"] }],
  });
  const { code, stdout, stderr } = await run([], input);
  assertEquals(code, 0, `stderr: ${stderr}`);
  assertEquals(stdout.includes("| no. |"), true);
  assertEquals(stdout.includes("## S1"), true);
});
