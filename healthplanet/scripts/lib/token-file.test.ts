import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import {
  isExpired,
  readTokenFile,
  type StoredToken,
  toStoredToken,
  writeTokenFile,
} from "./token-file.ts";
import type { TokenResponse } from "./oauth.ts";

const SAMPLE: StoredToken = {
  access_token: "at",
  refresh_token: "rt",
  expires_in: 2592000,
  obtained_at: "2026-09-01T00:00:00.000Z",
};

Deno.test("writeTokenFile/readTokenFile: 往復で同じ内容が読める (親ディレクトリは既存)", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const path = join(dir, "token.json");
    await writeTokenFile(path, SAMPLE);
    const read = await readTokenFile(path);
    assertEquals(read, SAMPLE);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("writeTokenFile: 親ディレクトリが無ければディレクトリ作成を促す例外 (mkdir はしない)", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const path = join(dir, "nested", "token.json");
    await assertRejects(
      () => writeTokenFile(path, SAMPLE),
      Error,
      "事前に作成しておく",
    );
    const nestedExists = await Deno.stat(join(dir, "nested")).then(
      () => true,
      () => false,
    );
    assertEquals(nestedExists, false);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("writeTokenFile: 既存ファイル (0o644) を上書きすると 0o600 になる", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const path = join(dir, "token.json");
    await Deno.writeTextFile(path, "{}", { mode: 0o644 });
    await writeTokenFile(path, SAMPLE);
    const stat = await Deno.stat(path);
    assertEquals((stat.mode ?? 0) & 0o777, 0o600);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("writeTokenFile: パーミッションが 0o600", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const path = join(dir, "token.json");
    await writeTokenFile(path, SAMPLE);
    const stat = await Deno.stat(path);
    assertEquals((stat.mode ?? 0) & 0o777, 0o600);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("readTokenFile: 存在しないファイルは例外", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await assertRejects(() => readTokenFile(join(dir, "missing.json")), Error);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("isExpired: margin 込みでちょうど期限切れの境界", () => {
  const obtainedAt = new Date("2026-09-01T00:00:00.000Z");
  const token: StoredToken = {
    ...SAMPLE,
    obtained_at: obtainedAt.toISOString(),
    expires_in: 100,
  };
  // 100 - 60 = 40 秒後がちょうど境界。
  const justBefore = new Date(obtainedAt.getTime() + 39_000);
  const atBoundary = new Date(obtainedAt.getTime() + 40_000);
  const justAfter = new Date(obtainedAt.getTime() + 41_000);
  assertEquals(isExpired(token, justBefore, 60), false);
  assertEquals(isExpired(token, atBoundary, 60), true);
  assertEquals(isExpired(token, justAfter, 60), true);
});

Deno.test("isExpired: obtained_at が日時として解釈できなければ期限切れ扱い", () => {
  const token: StoredToken = { ...SAMPLE, obtained_at: "not-a-date" };
  assertEquals(isExpired(token), true);
});

Deno.test("isExpired: expires_in が有限数でなければ期限切れ扱い", () => {
  const token: StoredToken = {
    ...SAMPLE,
    obtained_at: new Date().toISOString(),
    expires_in: NaN,
  };
  assertEquals(isExpired(token), true);
});

Deno.test("toStoredToken: resp をそのまま StoredToken に写す", () => {
  const resp: TokenResponse = {
    access_token: "at",
    expires_in: 2592000,
    refresh_token: "rt",
  };
  const now = new Date("2026-09-26T00:00:00.000Z");
  assertEquals(toStoredToken(resp, now), {
    access_token: "at",
    refresh_token: "rt",
    expires_in: 2592000,
    obtained_at: "2026-09-26T00:00:00.000Z",
  });
});
