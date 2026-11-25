import jtfHeading from "textlint-rule-preset-jtf-style/lib/1.1.2.js";

type Linter = (context: object, options?: unknown) => unknown;

// jtf-style の 1.1.2.見出し は見出し末尾の句点を検出する。autofix は効かせず検出だけにするため、
// rule に渡す context の fixer を no-op に差し替えて fix 情報そのものを作らせない
// (fixer プロパティを外すだけでは message に fix が残り、フォーマッタが fixable と表示する)。
const noopFixer = new Proxy({}, { get: () => () => undefined });

export function withoutFix(linter: Linter): Linter {
  return (context, options) => {
    const wrapped = new Proxy(context, {
      // report 等はアロー関数フィールドで this を閉じ込めており、かつ Object.freeze
      // された own property なので bind すると Proxy の不変条件に違反する。getter
      // (Syntax / RuleError 等) は Reflect.get の第 3 引数 target で実 context を
      // this にして評価するため、関数値も含めそのまま返す。
      get(target, prop) {
        if (prop === "fixer") {
          return noopFixer;
        }
        return Reflect.get(target, prop, target);
      },
    });
    return linter(wrapped, options);
  };
}

// 上流の形が変わったときに診断しづらいエラーにならないよう、import 時に検証する。
const upstream: unknown = jtfHeading;
const linter =
  typeof upstream === "function"
    ? upstream
    : typeof upstream === "object" &&
        upstream !== null &&
        "linter" in upstream &&
        typeof upstream.linter === "function"
      ? upstream.linter
      : undefined;

if (linter === undefined) {
  throw new TypeError(
    "textlint-rule-preset-jtf-style/lib/1.1.2.js の形が想定と異なる ({ linter } を持つオブジェクトでも関数でもない)",
  );
}

export default { linter: withoutFix(linter as Linter) };
