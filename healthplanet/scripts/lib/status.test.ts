import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { fetchStatus, validateDateTime } from "./status.ts";

Deno.test("validateDateTime: 14 桁なら例外を投げない", () => {
  validateDateTime("20260901120000");
});

Deno.test("validateDateTime: 桁数・形式が違えば例外", () => {
  assertThrows(() => validateDateTime("2026090112"), Error);
  assertThrows(() => validateDateTime("2026-09-01120000"), Error);
  assertThrows(() => validateDateTime(""), Error);
});

Deno.test("fetchStatus: URL に access_token・date・from・to・tag を含む", async () => {
  let requested: URL | undefined;
  const fetchFn = (input: string | URL | Request) => {
    requested = new URL(input as string | URL);
    return Promise.resolve(new Response("{}", { status: 200 }));
  };
  await fetchStatus(
    {
      accessToken: "at",
      kind: "innerscan",
      date: "1",
      from: "20260801000000",
      to: "20260901000000",
      tag: "6021,6022",
    },
    fetchFn as typeof fetch,
  );
  const q = requested!.searchParams;
  assertEquals(requested!.pathname, "/status/innerscan.json");
  assertEquals(q.get("access_token"), "at");
  assertEquals(q.get("date"), "1");
  assertEquals(q.get("from"), "20260801000000");
  assertEquals(q.get("to"), "20260901000000");
  assertEquals(q.get("tag"), "6021,6022");
});

Deno.test("fetchStatus: from/to/tag 省略時はクエリに含めない", async () => {
  let requested: URL | undefined;
  const fetchFn = (input: string | URL | Request) => {
    requested = new URL(input as string | URL);
    return Promise.resolve(new Response("{}", { status: 200 }));
  };
  await fetchStatus(
    { accessToken: "at", kind: "pedometer", date: "0" },
    fetchFn as typeof fetch,
  );
  const q = requested!.searchParams;
  assertEquals(q.has("from"), false);
  assertEquals(q.has("to"), false);
  assertEquals(q.has("tag"), false);
});

Deno.test("fetchStatus: レスポンスをそのまま (未加工) 返す", async () => {
  const raw =
    '{"data":[{"date":"202609011200","keydata":"62.15","tag":"6021"}]}';
  const fetchFn = () => Promise.resolve(new Response(raw, { status: 200 }));
  const body = await fetchStatus(
    { accessToken: "at", kind: "innerscan", date: "1" },
    fetchFn as typeof fetch,
  );
  assertEquals(body, raw);
});

Deno.test("fetchStatus: 非 2xx は HTTP ステータスとボディを含む例外", async () => {
  const fetchFn = () =>
    Promise.resolve(new Response("invalid access_token", { status: 401 }));
  await assertRejects(
    () =>
      fetchStatus(
        { accessToken: "bad", kind: "sphygmomanometer", date: "1" },
        fetchFn as typeof fetch,
      ),
    Error,
    "HTTP 401",
  );
});
