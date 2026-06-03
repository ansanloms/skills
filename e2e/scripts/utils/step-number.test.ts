import { assertEquals } from "@std/assert";
import { matchesTarget } from "./step-number.ts";

// ---------------------------------------------------------------------------
// matchesTarget: 完全一致
// ---------------------------------------------------------------------------

Deno.test("matchesTarget: 完全一致", () => {
  assertEquals(matchesTarget("1.1.1", "1.1.1"), true);
  assertEquals(matchesTarget("1.1.1", "1.1.2"), false);
  assertEquals(matchesTarget("2.3.4", "2.3.4"), true);
});

// ---------------------------------------------------------------------------
// matchesTarget: ワイルドカード
// ---------------------------------------------------------------------------

Deno.test("matchesTarget: * ワイルドカード", () => {
  assertEquals(matchesTarget("1.1.1", "*.*.*"), true);
  assertEquals(matchesTarget("2.3.4", "*.*.*"), true);
  assertEquals(matchesTarget("1.1.1", "1.*.*"), true);
  assertEquals(matchesTarget("2.1.1", "1.*.*"), false);
  assertEquals(matchesTarget("1.2.1", "*.2.*"), true);
  assertEquals(matchesTarget("1.3.1", "*.2.*"), false);
});

// ---------------------------------------------------------------------------
// matchesTarget: 範囲
// ---------------------------------------------------------------------------

Deno.test("matchesTarget: N-M 範囲", () => {
  assertEquals(matchesTarget("1.1.1", "1.1.1-3"), true);
  assertEquals(matchesTarget("1.1.2", "1.1.1-3"), true);
  assertEquals(matchesTarget("1.1.3", "1.1.1-3"), true);
  assertEquals(matchesTarget("1.1.4", "1.1.1-3"), false);
  assertEquals(matchesTarget("2.1.1", "1-2.*.*"), true);
  assertEquals(matchesTarget("3.1.1", "1-2.*.*"), false);
});

// ---------------------------------------------------------------------------
// matchesTarget: コロン OR
// ---------------------------------------------------------------------------

Deno.test("matchesTarget: コロン OR", () => {
  assertEquals(matchesTarget("1.1.1", "1.1.1:1.2.1"), true);
  assertEquals(matchesTarget("1.2.1", "1.1.1:1.2.1"), true);
  assertEquals(matchesTarget("1.3.1", "1.1.1:1.2.1"), false);
});

// ---------------------------------------------------------------------------
// matchesTarget: カンマ グループ OR
// ---------------------------------------------------------------------------

Deno.test("matchesTarget: カンマ グループ OR", () => {
  assertEquals(matchesTarget("1.1.1", "1.1.1,2.1.1"), true);
  assertEquals(matchesTarget("2.1.1", "1.1.1,2.1.1"), true);
  assertEquals(matchesTarget("3.1.1", "1.1.1,2.1.1"), false);
});

// ---------------------------------------------------------------------------
// matchesTarget: 存在しない項番
// ---------------------------------------------------------------------------

Deno.test("matchesTarget: マッチなし", () => {
  assertEquals(matchesTarget("9.9.9", "1.1.1"), false);
  assertEquals(matchesTarget("1.1.1", "9.*.*"), false);
});
