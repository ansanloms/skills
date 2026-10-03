import { assertEquals, assertRejects } from "@std/assert";
import { buildAuthUrl, exchangeCode, refreshToken } from "./oauth.ts";

Deno.test("buildAuthUrl: client_id・redirect_uri・scope・response_type=code を含む", () => {
  const url = new URL(
    buildAuthUrl({
      clientId: "cid",
      redirectUri: "https://example.com/cb",
      scopes: "innerscan,pedometer",
    }),
  );
  assertEquals(
    url.origin + url.pathname,
    "https://www.healthplanet.jp/oauth/auth",
  );
  assertEquals(url.searchParams.get("client_id"), "cid");
  assertEquals(url.searchParams.get("redirect_uri"), "https://example.com/cb");
  assertEquals(url.searchParams.get("scope"), "innerscan,pedometer");
  assertEquals(url.searchParams.get("response_type"), "code");
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

Deno.test("exchangeCode: 正常系は access_token・expires_in・refresh_token を返す", async () => {
  const fetchFn = (_url: string | URL | Request, init?: RequestInit) => {
    const body = new URLSearchParams(init?.body as string);
    assertEquals(body.get("grant_type"), "authorization_code");
    assertEquals(body.get("code"), "auth-code");
    return Promise.resolve(
      jsonResponse({
        access_token: "at",
        expires_in: 2592000,
        refresh_token: "rt",
      }),
    );
  };
  const token = await exchangeCode(
    {
      clientId: "cid",
      clientSecret: "secret",
      redirectUri: "https://example.com/cb",
      code: "auth-code",
    },
    fetchFn as typeof fetch,
  );
  assertEquals(token, {
    access_token: "at",
    expires_in: 2592000,
    refresh_token: "rt",
  });
});

Deno.test("exchangeCode: 非 2xx は HTTP ステータスとボディを含む例外", async () => {
  const fetchFn = () =>
    Promise.resolve(new Response("bad request body", { status: 400 }));
  await assertRejects(
    () =>
      exchangeCode(
        {
          clientId: "cid",
          clientSecret: "secret",
          redirectUri: "https://example.com/cb",
          code: "auth-code",
        },
        fetchFn as typeof fetch,
      ),
    Error,
    "HTTP 400",
  );
});

Deno.test("exchangeCode: フィールド欠落は例外", async () => {
  const fetchFn = () => Promise.resolve(jsonResponse({ access_token: "at" }));
  await assertRejects(
    () =>
      exchangeCode(
        {
          clientId: "cid",
          clientSecret: "secret",
          redirectUri: "https://example.com/cb",
          code: "auth-code",
        },
        fetchFn as typeof fetch,
      ),
    Error,
    "揃っていない",
  );
});

Deno.test("refreshToken: 正常系は grant_type=refresh_token で交換する", async () => {
  const fetchFn = (_url: string | URL | Request, init?: RequestInit) => {
    const body = new URLSearchParams(init?.body as string);
    assertEquals(body.get("grant_type"), "refresh_token");
    assertEquals(body.get("refresh_token"), "rt-old");
    return Promise.resolve(
      jsonResponse({
        access_token: "at2",
        expires_in: 2592000,
        refresh_token: "rt2",
      }),
    );
  };
  const token = await refreshToken(
    {
      clientId: "cid",
      clientSecret: "secret",
      redirectUri: "https://example.com/cb",
      refreshToken: "rt-old",
    },
    fetchFn as typeof fetch,
  );
  assertEquals(token.access_token, "at2");
});

Deno.test("refreshToken: レスポンスに refresh_token が無ければ直前の値を引き継ぐ", async () => {
  const fetchFn = () =>
    Promise.resolve(
      jsonResponse({
        access_token: "at2",
        expires_in: 2592000,
        // refresh_token を含めない。
      }),
    );
  const token = await refreshToken(
    {
      clientId: "cid",
      clientSecret: "secret",
      redirectUri: "https://example.com/cb",
      refreshToken: "rt-old",
    },
    fetchFn as typeof fetch,
  );
  assertEquals(token, {
    access_token: "at2",
    expires_in: 2592000,
    refresh_token: "rt-old",
  });
});

Deno.test("refreshToken: access_token・expires_in が欠けていれば refresh_token 省略でも例外", async () => {
  const fetchFn = () => Promise.resolve(jsonResponse({ expires_in: 100 }));
  await assertRejects(
    () =>
      refreshToken(
        {
          clientId: "cid",
          clientSecret: "secret",
          redirectUri: "https://example.com/cb",
          refreshToken: "rt-old",
        },
        fetchFn as typeof fetch,
      ),
    Error,
    "揃っていない",
  );
});

Deno.test("refreshToken: 非 2xx は HTTP ステータスとボディを含む例外", async () => {
  const fetchFn = () =>
    Promise.resolve(new Response("unauthorized", { status: 401 }));
  await assertRejects(
    () =>
      refreshToken(
        {
          clientId: "cid",
          clientSecret: "secret",
          redirectUri: "https://example.com/cb",
          refreshToken: "rt-old",
        },
        fetchFn as typeof fetch,
      ),
    Error,
    "HTTP 401",
  );
});
