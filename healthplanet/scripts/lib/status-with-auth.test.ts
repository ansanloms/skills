import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import type { TokenConfig } from "./config.ts";
import { writeTokenFile } from "./token-file.ts";
import { fetchStatusWithAuth } from "./status-with-auth.ts";

function makeConfig(tokenPath: string): TokenConfig {
  return {
    clientId: "cid",
    clientSecret: "secret",
    redirectUri: "https://example.com/cb",
    tokenPath,
  };
}

Deno.test("fetchStatusWithAuth: 401 を 1 回だけ refresh して再試行する", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const tokenPath = join(dir, "token.json");
    await writeTokenFile(tokenPath, {
      access_token: "at-old",
      refresh_token: "rt-old",
      expires_in: 2592000,
      obtained_at: new Date().toISOString(),
    });

    let statusCalls = 0;
    const fetchFn = (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input as string | URL);
      if (url.pathname === "/oauth/token") {
        const body = new URLSearchParams(init?.body as string);
        assertEquals(body.get("grant_type"), "refresh_token");
        assertEquals(body.get("refresh_token"), "rt-old");
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: "at-new",
              expires_in: 2592000,
              refresh_token: "rt-new",
            }),
            { status: 200 },
          ),
        );
      }
      statusCalls++;
      if (statusCalls === 1) {
        assertEquals(url.searchParams.get("access_token"), "at-old");
        return Promise.resolve(
          new Response("invalid access_token", { status: 401 }),
        );
      }
      assertEquals(url.searchParams.get("access_token"), "at-new");
      return Promise.resolve(new Response('{"data":[]}', { status: 200 }));
    };

    const body = await fetchStatusWithAuth(
      { config: makeConfig(tokenPath), kind: "innerscan", date: "1" },
      fetchFn as typeof fetch,
    );
    assertEquals(body, '{"data":[]}');
    assertEquals(statusCalls, 2);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("fetchStatusWithAuth: 401 以外はリトライしない", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const tokenPath = join(dir, "token.json");
    await writeTokenFile(tokenPath, {
      access_token: "at",
      refresh_token: "rt",
      expires_in: 2592000,
      obtained_at: new Date().toISOString(),
    });
    let statusCalls = 0;
    let refreshCalls = 0;
    const fetchFn = (input: string | URL | Request) => {
      const url = new URL(input as string | URL);
      if (url.pathname === "/oauth/token") {
        refreshCalls++;
        return Promise.resolve(new Response("{}", { status: 200 }));
      }
      statusCalls++;
      return Promise.resolve(new Response("server error", { status: 500 }));
    };
    await assertRejects(
      () =>
        fetchStatusWithAuth(
          { config: makeConfig(tokenPath), kind: "innerscan", date: "1" },
          fetchFn as typeof fetch,
        ),
      Error,
      "HTTP 500",
    );
    assertEquals(statusCalls, 1);
    assertEquals(refreshCalls, 0);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("fetchStatusWithAuth: 再試行も 401 なら例外", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const tokenPath = join(dir, "token.json");
    await writeTokenFile(tokenPath, {
      access_token: "at",
      refresh_token: "rt",
      expires_in: 2592000,
      obtained_at: new Date().toISOString(),
    });
    let statusCalls = 0;
    const fetchFn = (input: string | URL | Request) => {
      const url = new URL(input as string | URL);
      if (url.pathname === "/oauth/token") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: "at2",
              expires_in: 100,
              refresh_token: "rt2",
            }),
            { status: 200 },
          ),
        );
      }
      statusCalls++;
      return Promise.resolve(new Response("still invalid", { status: 401 }));
    };
    await assertRejects(
      () =>
        fetchStatusWithAuth(
          { config: makeConfig(tokenPath), kind: "innerscan", date: "1" },
          fetchFn as typeof fetch,
        ),
      Error,
      "HTTP 401",
    );
    assertEquals(statusCalls, 2);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
