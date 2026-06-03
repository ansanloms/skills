/**
 * utils/step-number.ts
 * シナリオ項番（no.）のパターン照合ユーティリティ
 */

/**
 * no. の一桁分をパターン部分文字列と照合する。
 *   `"*"`   → 常に一致
 *   `"N-M"` → N 以上 M 以下
 *   `"N"`   → 完全一致
 */
function matchesPart(value: number, part: string): boolean {
  if (part === "*") {
    return true;
  }
  const dashIdx = part.indexOf("-");
  if (dashIdx !== -1) {
    const lo = Number(part.slice(0, dashIdx));
    const hi = Number(part.slice(dashIdx + 1));
    return value >= lo && value <= hi;
  }
  return value === Number(part);
}

/**
 * `{s}.{c}.{sc}` 形式の項番が 3 桁パターン文字列に一致するか判定する。
 * 桁数が 3 でない場合は常に `false`。
 */
function matchesPattern(no: string, pattern: string): boolean {
  const noParts = no.split(".");
  const patParts = pattern.split(".");
  if (noParts.length !== 3 || patParts.length !== 3) {
    return false;
  }
  return (
    matchesPart(Number(noParts[0]), patParts[0]) &&
    matchesPart(Number(noParts[1]), patParts[1]) &&
    matchesPart(Number(noParts[2]), patParts[2])
  );
}

/**
 * target 文字列に no が一致するか判定する。
 *   カンマ `,` → グループ OR
 *   コロン `:` → 個別 OR
 */
export function matchesTarget(no: string, target: string): boolean {
  for (const group of target.split(",")) {
    for (const item of group.split(":")) {
      if (matchesPattern(no, item.trim())) {
        return true;
      }
    }
  }
  return false;
}
