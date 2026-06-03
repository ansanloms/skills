import { assertEquals } from "@std/assert";
import { resolvePath } from "../utils/io.ts";

const CLI = resolvePath(import.meta.url, "./replace-env.ts");
const SAMPLE_DIR = resolvePath(import.meta.url, "../samples");

const dec = (b: Uint8Array) => new TextDecoder().decode(b);

async function run(
  args: string[],
  env?: Record<string, string>,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const { code, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", CLI, ...args],
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
    env: env !== undefined ? { ...Deno.env.toObject(), ...env } : undefined,
  }).output();
  return { code, stdout: dec(stdout), stderr: dec(stderr) };
}

async function withTempSpec(
  content: string,
  fn: (path: string) => Promise<void>,
): Promise<void> {
  const path = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(path, content);
    await fn(path);
  } finally {
    await Deno.remove(path);
  }
}

Deno.test("replace-env: 環境変数を含まない spec はそのまま出力", async () => {
  const { code, stdout, stderr } = await run([
    "--input",
    `${SAMPLE_DIR}/spec-minimal.json`,
  ]);
  assertEquals(code, 0, `stderr: ${stderr}`);
  const json = JSON.parse(stdout);
  assertEquals(json.title, "テスト");
  assertEquals(json.scenarios[0].steps[0], "ステップ1");
});

Deno.test("replace-env: ${VAR} を環境変数の値に置換する", async () => {
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [
      {
        name: "S1",
        steps: ["${BASE_URL} にアクセスする"],
      },
    ],
  });
  await withTempSpec(spec, async (specPath) => {
    const { code, stdout, stderr } = await run(["--input", specPath], {
      BASE_URL: "https://example.com",
    });
    assertEquals(code, 0, `stderr: ${stderr}`);
    const json = JSON.parse(stdout);
    assertEquals(
      json.scenarios[0].steps[0],
      "https://example.com にアクセスする",
    );
  });
});

Deno.test("replace-env: 未定義の ${VAR} はプレースホルダーをそのまま保持", async () => {
  const spec = JSON.stringify({
    title: "${UNDEFINED_VAR}",
    scenarios: [{ name: "S1", steps: ["ステップ1"] }],
  });
  await withTempSpec(spec, async (specPath) => {
    // UNDEFINED_VAR を意図的に設定しない
    const { code, stdout } = await run(["--input", specPath]);
    assertEquals(code, 0);
    const json = JSON.parse(stdout);
    assertEquals(json.title, "${UNDEFINED_VAR}");
  });
});

Deno.test("replace-env: scenarios[].name, description, case.rows も置換対象", async () => {
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [
      {
        name: "${SCENARIO_NAME}",
        case: {
          columns: ["no.", "url"],
          rows: [{ "no.": "1", url: "${BASE_URL}/path" }],
        },
        steps: ["ステップ1"],
      },
    ],
  });
  await withTempSpec(spec, async (specPath) => {
    const { code, stdout, stderr } = await run(["--input", specPath], {
      SCENARIO_NAME: "ログイン",
      BASE_URL: "https://example.com",
    });
    assertEquals(code, 0, `stderr: ${stderr}`);
    const json = JSON.parse(stdout);
    assertEquals(json.scenarios[0].name, "ログイン");
    assertEquals(
      json.scenarios[0].case.rows[0]["url"],
      "https://example.com/path",
    );
  });
});

Deno.test("replace-env: --output 指定時は $schema が含まれる", async () => {
  const outPath = await Deno.makeTempFile({ suffix: ".json" });
  try {
    const { code } = await run([
      "--input",
      `${SAMPLE_DIR}/spec-minimal.json`,
      "--output",
      outPath,
    ]);
    assertEquals(code, 0);
    const json = JSON.parse(await Deno.readTextFile(outPath)) as Record<
      string,
      unknown
    >;
    assertEquals(typeof json.$schema, "string");
    assertEquals((json.$schema as string).includes("spec.schema.json"), true);
  } finally {
    await Deno.remove(outPath);
  }
});

Deno.test("replace-env: --output ファイルに書き込む", async () => {
  const outPath = await Deno.makeTempFile({ suffix: ".json" });
  try {
    const { code } = await run([
      "--input",
      `${SAMPLE_DIR}/spec-minimal.json`,
      "--output",
      outPath,
    ]);
    assertEquals(code, 0);
    const json = JSON.parse(await Deno.readTextFile(outPath));
    assertEquals(json.title, "テスト");
  } finally {
    await Deno.remove(outPath);
  }
});

Deno.test("replace-env: devices.*.userAgent の ${ENV} が置換される", async () => {
  const spec = JSON.stringify({
    title: "テスト",
    devices: {
      mobile: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent: "${MOBILE_UA}",
      },
    },
    scenarios: [{ name: "S1", steps: ["ステップ1"] }],
  });
  await withTempSpec(spec, async (specPath) => {
    const { code, stdout, stderr } = await run(["--input", specPath], {
      MOBILE_UA: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)",
    });
    assertEquals(code, 0, `stderr: ${stderr}`);
    const json = JSON.parse(stdout);
    assertEquals(
      json.devices.mobile.userAgent,
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)",
    );
    // viewport・isMobile・hasTouch は変化しない
    assertEquals(json.devices.mobile.viewport.width, 390);
    assertEquals(json.devices.mobile.isMobile, true);
  });
});

Deno.test("replace-env: 不正な JSON → exit 1", async () => {
  await withTempSpec("not json", async (specPath) => {
    const { code, stderr } = await run(["--input", specPath]);
    assertEquals(code, 1);
    assertEquals(stderr.includes("Validation failed:"), true);
  });
});
