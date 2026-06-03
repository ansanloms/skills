import { assertEquals } from "@std/assert";
import { resolvePath } from "../utils/io.ts";

const CLI = resolvePath(import.meta.url, "./scenarios.ts");
const SAMPLE_DIR = resolvePath(import.meta.url, "../samples");

const dec = (b: Uint8Array) => new TextDecoder().decode(b);

async function run(
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  const { code, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", CLI, ...args],
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
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

async function withTempMacro(
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

// -----------------------------------------------------------------------
// text フォーマット
// -----------------------------------------------------------------------

Deno.test("scenarios: case なし・1 シナリオ・1 ステップ → 1.1.1 のみ出力（scenario フィールドはステップテキスト）", async () => {
  const { code, stdout, stderr } = await run([
    "--input",
    `${SAMPLE_DIR}/spec-minimal.json`,
  ]);
  assertEquals(code, 0, `stderr: ${stderr}`);
  assertEquals(stdout.trim(), "1.1.1 ステップ1");
});

Deno.test("scenarios: 共通テーブル 2 行・2 シナリオ（各 1 ステップ）→ 4 エントリ", async () => {
  const spec = JSON.stringify({
    title: "テスト",
    case: {
      columns: ["no.", "lang"],
      rows: [{ "no.": "1", lang: "" }, { "no.": "2", lang: "/en" }],
    },
    scenarios: [
      { name: "S1", steps: ["ステップ1"] },
      { name: "S2", steps: ["ステップ1"] },
    ],
  });
  await withTempSpec(spec, async (specPath) => {
    const { code, stdout, stderr } = await run(["--input", specPath]);
    assertEquals(code, 0, `stderr: ${stderr}`);
    const lines = stdout.trim().split("\n");
    assertEquals(lines.length, 4);
    assertEquals(lines[0], "1.1.1 ステップ1");
    assertEquals(lines[1], "1.2.1 ステップ1");
    assertEquals(lines[2], "2.1.1 ステップ1");
    assertEquals(lines[3], "2.2.1 ステップ1");
  });
});

Deno.test("scenarios: シナリオ独自テーブル 2 行・1 ステップ → case が 2桁目（1.2.1）に", async () => {
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [
      {
        name: "S1",
        case: {
          columns: ["no.", "email"],
          rows: [
            { "no.": "1", email: "a@b.com" },
            { "no.": "2", email: "c@d.com" },
          ],
        },
        steps: ["ステップ1"],
      },
    ],
  });
  await withTempSpec(spec, async (specPath) => {
    const { code, stdout, stderr } = await run(["--input", specPath]);
    assertEquals(code, 0, `stderr: ${stderr}`);
    const lines = stdout.trim().split("\n");
    assertEquals(lines.length, 2);
    assertEquals(lines[0], "1.1.1 ステップ1");
    assertEquals(lines[1], "1.2.1 ステップ1");
  });
});

// -----------------------------------------------------------------------
// json フォーマット
// -----------------------------------------------------------------------

Deno.test("scenarios: --format json → JSON 配列で出力（scenario フィールドはステップテキスト）", async () => {
  const { code, stdout, stderr } = await run([
    "--input",
    `${SAMPLE_DIR}/spec-minimal.json`,
    "--format",
    "json",
  ]);
  assertEquals(code, 0, `stderr: ${stderr}`);
  const arr = JSON.parse(stdout);
  assertEquals(arr.length, 1);
  assertEquals(arr[0].no, "1.1.1");
  assertEquals(arr[0].scenario, "ステップ1");
});

// -----------------------------------------------------------------------
// --target フィルタ
// -----------------------------------------------------------------------

Deno.test("scenarios: --target 1.1.1 → 単一エントリ", async () => {
  const { code, stdout } = await run([
    "--input",
    `${SAMPLE_DIR}/spec-minimal.json`,
    "--target",
    "1.1.1",
  ]);
  assertEquals(code, 0);
  assertEquals(stdout.trim(), "1.1.1 ステップ1");
});

Deno.test("scenarios: --target 2.*.* → シナリオ 2 のみ", async () => {
  const spec = JSON.stringify({
    title: "テスト",
    case: {
      columns: ["no.", "lang"],
      rows: [{ "no.": "1", lang: "" }, { "no.": "2", lang: "/en" }],
    },
    scenarios: [
      { name: "S1", steps: ["ステップ1"] },
      { name: "S2", steps: ["ステップ1"] },
    ],
  });
  await withTempSpec(spec, async (specPath) => {
    const { code, stdout } = await run([
      "--input",
      specPath,
      "--target",
      "2.*.*",
    ]);
    assertEquals(code, 0);
    const lines = stdout.trim().split("\n");
    assertEquals(lines.length, 2);
    assertEquals(lines[0], "2.1.1 ステップ1");
    assertEquals(lines[1], "2.2.1 ステップ1");
  });
});

Deno.test("scenarios: --target 1.1.1-2（範囲）→ scenario1/case1 のステップ1〜2", async () => {
  // per-scenario case 3 行・2 ステップ → 全体: 1.1.1, 1.1.2, 1.2.1, 1.2.2, 1.3.1, 1.3.2
  // --target 1.1.1-2 は scenario=1, case=1, step=1〜2 にマッチ → 1.1.1, 1.1.2
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [
      {
        name: "S1",
        case: {
          columns: ["no.", "val"],
          rows: [
            { "no.": "1", val: "a" },
            { "no.": "2", val: "b" },
            { "no.": "3", val: "c" },
          ],
        },
        steps: ["ステップ1", "ステップ2"],
      },
    ],
  });
  await withTempSpec(spec, async (specPath) => {
    const { code, stdout } = await run([
      "--input",
      specPath,
      "--target",
      "1.1.1-2",
    ]);
    assertEquals(code, 0);
    const lines = stdout.trim().split("\n");
    assertEquals(lines.length, 2);
    assertEquals(lines[0], "1.1.1 ステップ1");
    assertEquals(lines[1], "1.1.2 ステップ2");
  });
});

Deno.test("scenarios: --target 1.1.1:2.1.1（コロン複数指定）", async () => {
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [
      { name: "S1", steps: ["step"] },
      { name: "S2", steps: ["step"] },
    ],
  });
  await withTempSpec(spec, async (specPath) => {
    const { code, stdout } = await run([
      "--input",
      specPath,
      "--target",
      "1.1.1:2.1.1",
    ]);
    assertEquals(code, 0);
    const lines = stdout.trim().split("\n");
    assertEquals(lines.length, 2);
    assertEquals(lines[0], "1.1.1 step");
    assertEquals(lines[1], "2.1.1 step");
  });
});

Deno.test("scenarios: 存在しない --target → 空出力", async () => {
  const { code, stdout } = await run([
    "--input",
    `${SAMPLE_DIR}/spec-minimal.json`,
    "--target",
    "9.*.*",
  ]);
  assertEquals(code, 0);
  assertEquals(stdout, "");
});

// -----------------------------------------------------------------------
// マクロ展開（--macro ファイル指定）
// -----------------------------------------------------------------------

Deno.test("scenarios: --macro ファイルの @macro-name がステップテキストに展開される", async () => {
  const macros = JSON.stringify({
    "login-frontend": {
      script: "deno task e2e --spec tests/specs/frontend-login/spec.json",
    },
  });
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [{ name: "S1", steps: ["@login-frontend"] }],
  });
  await withTempMacro(macros, async (macroPath) => {
    await withTempSpec(spec, async (specPath) => {
      const { code, stdout, stderr } = await run([
        "--input",
        specPath,
        "--macro",
        macroPath,
      ]);
      assertEquals(code, 0, `stderr: ${stderr}`);
      assertEquals(
        stdout.trim(),
        "1.1.1 deno task e2e --spec tests/specs/frontend-login/spec.json",
      );
    });
  });
});

Deno.test("scenarios: --macro に定義のない @unknown はそのまま出力", async () => {
  const macros = JSON.stringify({
    "login-frontend": { script: "ログインする" },
  });
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [{ name: "S1", steps: ["@unknown-macro"] }],
  });
  await withTempMacro(macros, async (macroPath) => {
    await withTempSpec(spec, async (specPath) => {
      const { code, stdout, stderr } = await run([
        "--input",
        specPath,
        "--macro",
        macroPath,
      ]);
      assertEquals(code, 0, `stderr: ${stderr}`);
      assertEquals(stdout.trim(), "1.1.1 @unknown-macro");
    });
  });
});

Deno.test("scenarios: --macro 未指定でもエラーにならない", async () => {
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [{ name: "S1", steps: ["@some-macro", "通常のステップ"] }],
  });
  await withTempSpec(spec, async (specPath) => {
    const { code, stdout, stderr } = await run(["--input", specPath]);
    assertEquals(code, 0, `stderr: ${stderr}`);
    const lines = stdout.trim().split("\n");
    assertEquals(lines[0], "1.1.1 @some-macro");
    assertEquals(lines[1], "1.1.2 通常のステップ");
  });
});

Deno.test("scenarios: --macro 複数指定で後指定が優先される", async () => {
  const macros1 = JSON.stringify({
    "login-frontend": { script: "first" },
    "logout": { script: "共通ログアウト" },
  });
  const macros2 = JSON.stringify({
    "login-frontend": { script: "second (overrides)" },
  });
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [
      { name: "S1", steps: ["@login-frontend", "@logout"] },
    ],
  });
  await withTempMacro(macros1, async (macroPath1) => {
    await withTempMacro(macros2, async (macroPath2) => {
      await withTempSpec(spec, async (specPath) => {
        const { code, stdout, stderr } = await run([
          "--input",
          specPath,
          "--macro",
          macroPath1,
          "--macro",
          macroPath2,
        ]);
        assertEquals(code, 0, `stderr: ${stderr}`);
        const lines = stdout.trim().split("\n");
        assertEquals(lines[0], "1.1.1 second (overrides)");
        assertEquals(lines[1], "1.1.2 共通ログアウト");
      });
    });
  });
});

Deno.test("scenarios: マクロ script 内の <column> がケーステーブルの値で置換される", async () => {
  const macros = JSON.stringify({
    "login-frontend": {
      script: "`/e2e --spec spec.json --target 1.<case>.1-7` でログインする",
    },
  });
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [
      {
        name: "S1",
        case: {
          columns: ["case", "lang-prefix"],
          rows: [
            { case: "1", "lang-prefix": "" },
            { case: "2", "lang-prefix": "/en" },
          ],
        },
        steps: ["@login-frontend"],
      },
    ],
  });
  await withTempMacro(macros, async (macroPath) => {
    await withTempSpec(spec, async (specPath) => {
      const { code, stdout, stderr } = await run([
        "--input",
        specPath,
        "--macro",
        macroPath,
      ]);
      assertEquals(code, 0, `stderr: ${stderr}`);
      const lines = stdout.trim().split("\n");
      assertEquals(lines.length, 2);
      assertEquals(
        lines[0],
        "1.1.1 `/e2e --spec spec.json --target 1.1.1-7` でログインする",
      );
      assertEquals(
        lines[1],
        "1.2.1 `/e2e --spec spec.json --target 1.2.1-7` でログインする",
      );
    });
  });
});

Deno.test("scenarios: マクロ名に <column> を含む @macro-<lang> 形式でマクロ名が動的に解決される", async () => {
  const macros = JSON.stringify({
    "login-frontend-ja": { script: "JA でログインする" },
    "login-frontend-en": { script: "EN でログインする" },
  });
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [
      {
        name: "S1",
        case: {
          columns: ["case", "lang"],
          rows: [
            { case: "1", lang: "ja" },
            { case: "2", lang: "en" },
          ],
        },
        steps: ["@login-frontend-<lang>"],
      },
    ],
  });
  await withTempMacro(macros, async (macroPath) => {
    await withTempSpec(spec, async (specPath) => {
      const { code, stdout, stderr } = await run([
        "--input",
        specPath,
        "--macro",
        macroPath,
      ]);
      assertEquals(code, 0, `stderr: ${stderr}`);
      const lines = stdout.trim().split("\n");
      assertEquals(lines.length, 2);
      assertEquals(lines[0], "1.1.1 JA でログインする");
      assertEquals(lines[1], "1.2.1 EN でログインする");
    });
  });
});

Deno.test("scenarios: マクロ名の <column> 解決後、script 内の <column> も置換される", async () => {
  const macros = JSON.stringify({
    "login-frontend-ja": {
      script: "`/e2e --target 1.1.2-6` でログインする（<device>）",
    },
    "login-frontend-en": {
      script: "`/e2e --target 1.2.2-6` でログインする（<device>）",
    },
  });
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [
      {
        name: "S1",
        case: {
          columns: ["case", "device", "lang"],
          rows: [
            { case: "1", device: "pc", lang: "ja" },
            { case: "2", device: "mobile", lang: "en" },
          ],
        },
        steps: ["@login-frontend-<lang>"],
      },
    ],
  });
  await withTempMacro(macros, async (macroPath) => {
    await withTempSpec(spec, async (specPath) => {
      const { code, stdout, stderr } = await run([
        "--input",
        specPath,
        "--macro",
        macroPath,
      ]);
      assertEquals(code, 0, `stderr: ${stderr}`);
      const lines = stdout.trim().split("\n");
      assertEquals(lines.length, 2);
      assertEquals(
        lines[0],
        "1.1.1 `/e2e --target 1.1.2-6` でログインする（pc）",
      );
      assertEquals(
        lines[1],
        "1.2.1 `/e2e --target 1.2.2-6` でログインする（mobile）",
      );
    });
  });
});

Deno.test("scenarios: 通常ステップの <column> もケーステーブルの値で置換される", async () => {
  const spec = JSON.stringify({
    title: "テスト",
    scenarios: [
      {
        name: "S1",
        case: {
          columns: ["case", "lang"],
          rows: [
            { case: "1", lang: "" },
            { case: "2", lang: "/en" },
          ],
        },
        steps: ["`https://example.com<lang>/login` にアクセスする"],
      },
    ],
  });
  await withTempSpec(spec, async (specPath) => {
    const { code, stdout, stderr } = await run(["--input", specPath]);
    assertEquals(code, 0, `stderr: ${stderr}`);
    const lines = stdout.trim().split("\n");
    assertEquals(lines.length, 2);
    assertEquals(lines[0], "1.1.1 `https://example.com/login` にアクセスする");
    assertEquals(
      lines[1],
      "1.2.1 `https://example.com/en/login` にアクセスする",
    );
  });
});

// -----------------------------------------------------------------------
// エラー
// -----------------------------------------------------------------------

Deno.test("scenarios: 不正な --format → exit 2", async () => {
  const { code, stderr } = await run([
    "--input",
    `${SAMPLE_DIR}/spec-minimal.json`,
    "--format",
    "csv",
  ]);
  assertEquals(code, 2);
  assertEquals(stderr.includes("should be chosen from"), true);
});

Deno.test("scenarios: 不正な JSON → exit 1", async () => {
  await withTempSpec("not json", async (specPath) => {
    const { code, stderr } = await run(["--input", specPath]);
    assertEquals(code, 1);
    assertEquals(stderr.includes("Validation failed:"), true);
  });
});
