import { assertEquals, assertThrows } from "@std/assert";
import { loadAuthUrlConfig, loadTokenConfig } from "./config.ts";

const VARS = [
  "HEALTHPLANET_CLIENT_ID",
  "HEALTHPLANET_CLIENT_SECRET",
  "HEALTHPLANET_REDIRECT_URI",
  "HEALTHPLANET_TOKEN_PATH",
] as const;

/** 対象の環境変数を退避し、テスト後に元へ戻す。 */
function withEnv(
  vars: Partial<Record<(typeof VARS)[number], string>>,
  fn: () => void,
): void {
  const saved = new Map<string, string | undefined>();
  for (const name of VARS) {
    saved.set(name, Deno.env.get(name));
  }
  try {
    for (const name of VARS) {
      Deno.env.delete(name);
    }
    for (const [name, value] of Object.entries(vars)) {
      if (value !== undefined) {
        Deno.env.set(name, value);
      }
    }
    fn();
  } finally {
    for (const name of VARS) {
      const v = saved.get(name);
      if (v === undefined) {
        Deno.env.delete(name);
      } else Deno.env.set(name, v);
    }
  }
}

Deno.test("loadAuthUrlConfig: HEALTHPLANET_CLIENT_ID 未設定は変数名を含む例外", () => {
  withEnv({}, () => {
    assertThrows(() => loadAuthUrlConfig(), Error, "HEALTHPLANET_CLIENT_ID");
  });
});

Deno.test("loadAuthUrlConfig: REDIRECT_URI 省略時は既定値", () => {
  withEnv({ HEALTHPLANET_CLIENT_ID: "cid" }, () => {
    const config = loadAuthUrlConfig();
    assertEquals(config.clientId, "cid");
    assertEquals(
      config.redirectUri,
      "https://www.healthplanet.jp/success.html",
    );
  });
});

Deno.test("loadAuthUrlConfig: REDIRECT_URI 指定時はその値", () => {
  withEnv(
    {
      HEALTHPLANET_CLIENT_ID: "cid",
      HEALTHPLANET_REDIRECT_URI: "https://example.com/cb",
    },
    () => {
      assertEquals(loadAuthUrlConfig().redirectUri, "https://example.com/cb");
    },
  );
});

Deno.test("loadTokenConfig: CLIENT_SECRET 未設定は変数名を含む例外", () => {
  withEnv({
    HEALTHPLANET_CLIENT_ID: "cid",
    HEALTHPLANET_TOKEN_PATH: "/tmp/t.json",
  }, () => {
    assertThrows(() => loadTokenConfig(), Error, "HEALTHPLANET_CLIENT_SECRET");
  });
});

Deno.test("loadTokenConfig: TOKEN_PATH 未設定は変数名を含む例外", () => {
  withEnv({
    HEALTHPLANET_CLIENT_ID: "cid",
    HEALTHPLANET_CLIENT_SECRET: "secret",
  }, () => {
    assertThrows(() => loadTokenConfig(), Error, "HEALTHPLANET_TOKEN_PATH");
  });
});

Deno.test("loadTokenConfig: 必須が揃えば読める (REDIRECT_URI は既定値)", () => {
  withEnv(
    {
      HEALTHPLANET_CLIENT_ID: "cid",
      HEALTHPLANET_CLIENT_SECRET: "secret",
      HEALTHPLANET_TOKEN_PATH: "/tmp/t.json",
    },
    () => {
      const config = loadTokenConfig();
      assertEquals(config.clientId, "cid");
      assertEquals(config.clientSecret, "secret");
      assertEquals(config.tokenPath, "/tmp/t.json");
      assertEquals(
        config.redirectUri,
        "https://www.healthplanet.jp/success.html",
      );
    },
  );
});
