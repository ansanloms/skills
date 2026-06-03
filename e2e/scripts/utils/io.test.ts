import { assertEquals } from "@std/assert";
import { readFile, resolvePath, writeOutput } from "./io.ts";
import * as path from "@std/path";

const dir = path.dirname(path.fromFileUrl(import.meta.url));

// ---------------------------------------------------------------------------
// readFile
// ---------------------------------------------------------------------------

Deno.test("readFile: ファイルパスを渡すと内容を返す", async () => {
  const tmpFile = await Deno.makeTempFile();
  await Deno.writeTextFile(tmpFile, "hello");
  try {
    const result = await readFile(tmpFile);
    assertEquals(result, "hello");
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("readFile: undefined を渡すと stdin から読み込む", async () => {
  // stdin に書き込むためにサブプロセスを使う
  const proc = new Deno.Command("deno", {
    args: [
      "eval",
      `
import { readFile } from "${path.join(dir, "io.ts")}";
const result = await readFile(undefined);
console.log(result);
`,
    ],
    stdin: "piped",
    stdout: "piped",
  }).spawn();

  const writer = proc.stdin.getWriter();
  await writer.write(new TextEncoder().encode("from stdin"));
  await writer.close();

  const { stdout } = await proc.output();
  const output = new TextDecoder().decode(stdout).trim();
  assertEquals(output, "from stdin");
});

// ---------------------------------------------------------------------------
// writeOutput
// ---------------------------------------------------------------------------

Deno.test("writeOutput: ファイルパスを渡すとファイルに書き込む", async () => {
  const tmpFile = await Deno.makeTempFile();
  try {
    await writeOutput(tmpFile, "world");
    const result = await Deno.readTextFile(tmpFile);
    assertEquals(result, "world");
  } finally {
    await Deno.remove(tmpFile);
  }
});

Deno.test("writeOutput: undefined を渡すと stdout に書き込む", async () => {
  const proc = new Deno.Command("deno", {
    args: [
      "eval",
      `
import { writeOutput } from "${path.join(dir, "io.ts")}";
await writeOutput(undefined, "to stdout");
`,
    ],
    stdout: "piped",
  }).spawn();

  const { stdout } = await proc.output();
  const output = new TextDecoder().decode(stdout);
  assertEquals(output, "to stdout");
});

// ---------------------------------------------------------------------------
// resolvePath
// ---------------------------------------------------------------------------

Deno.test("resolvePath: import.meta.url を基準に絶対パスを返す", () => {
  const result = resolvePath(import.meta.url, "../schemas/spec.schema.json");
  assertEquals(result, path.join(dir, "..", "schemas", "spec.schema.json"));
});
