// このファイルは google-health/scripts/lib と mountain-weather/scripts/lib に複製している
// (各 skill は単体で配布するため共有できない)。両方を同一に保つこと
// (lib/cli.test.ts が相手側の複製が存在すれば内容の一致を検査する)。
import { parseArgs } from "node:util";

/** 1 オプションの定義。number は文字列として受け取り整数へ変換する。 */
export type OptionSpec = {
  type: "string" | "number" | "boolean";
  short?: string;
  multiple?: boolean;
  default?: string | number | boolean;
  /** number のみ。許容する最小値・最大値 (含む)。範囲外は使い方エラー。 */
  min?: number;
  max?: number;
  description: string;
};

type BaseValue<S extends OptionSpec> = S["type"] extends "number"
  ? number
  : S["type"] extends "boolean"
    ? boolean
    : string;

type OptionValue<S extends OptionSpec> =
  | (S extends { multiple: true } ? BaseValue<S>[] : BaseValue<S>)
  | (S extends { default: unknown } ? never : undefined);

export type Values<O extends Record<string, OptionSpec>> = {
  [K in keyof O]: OptionValue<O[K]>;
};

export type CommandSpec<O extends Record<string, OptionSpec>> = {
  description: string;
  /** `usage: ` の後ろに出す 1 行の使い方。 */
  usage: string;
  options: O;
  /** 位置引数を受け付けるか。 */
  allowPositionals?: boolean;
};

export type ParseResult<O extends Record<string, OptionSpec>> =
  | { kind: "ok"; values: Values<O>; positionals: string[] }
  | { kind: "help"; text: string }
  | { kind: "error"; message: string; usage: string };

/** `--help` の出力 (使い方 1 行 + オプションごとの説明)。 */
export function formatHelp<O extends Record<string, OptionSpec>>(
  spec: CommandSpec<O>,
): string {
  const rows: [string, string][] = Object.entries(spec.options).map(
    ([key, o]) => {
      const short = o.short === undefined ? "    " : `-${o.short}, `;
      const value = o.type === "boolean" ? "" : ` <${o.type}>`;
      const def =
        o.default === undefined || (o.type === "boolean" && o.default === false)
          ? ""
          : ` (既定: ${String(o.default)})`;
      return [`${short}--${key}${value}`, `${o.description}${def}`];
    },
  );
  rows.push(["-h, --help", "このヘルプを表示する"]);
  const width = Math.max(...rows.map(([label]) => label.length));
  const lines = rows.map(
    ([label, desc]) => `  ${label.padEnd(width)}  ${desc}`,
  );
  return [
    `usage: ${spec.usage}`,
    "",
    spec.description,
    "",
    "options:",
    ...lines,
    "",
  ].join("\n");
}

/** argv を解釈する。終了処理は行わず結果を返す (テスト用に分離)。 */
export function parseCommand<O extends Record<string, OptionSpec>>(
  spec: CommandSpec<O>,
  argv: string[],
): ParseResult<O> {
  const entries = Object.entries(spec.options);
  const options: Record<
    string,
    { type: "string" | "boolean"; short?: string; multiple?: boolean }
  > = {
    help: { type: "boolean", short: "h" },
  };
  for (const [key, o] of entries) {
    options[key] = {
      type: o.type === "boolean" ? "boolean" : "string",
      ...(o.short === undefined ? {} : { short: o.short }),
      ...(o.multiple === true ? { multiple: true } : {}),
    };
  }

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options,
      strict: true,
      allowPositionals: spec.allowPositionals === true,
    });
  } catch (e) {
    return {
      kind: "error",
      message: e instanceof Error ? e.message : String(e),
      usage: spec.usage,
    };
  }

  if (parsed.values.help === true) {
    return { kind: "help", text: formatHelp(spec) };
  }

  const values: Record<string, unknown> = {};
  for (const [key, o] of entries) {
    const raw = parsed.values[key];
    if (raw === undefined) {
      if (o.default !== undefined) {
        values[key] = o.default;
      }
      continue;
    }
    if (o.type === "number") {
      const converted = (Array.isArray(raw) ? raw : [raw]).map((v) =>
        toInteger(String(v)),
      );
      if (converted.some((n) => n === undefined)) {
        return {
          kind: "error",
          message: `--${key} は整数で指定する: ${String(raw)}`,
          usage: spec.usage,
        };
      }
      const nums = converted as number[];
      if (
        nums.some(
          (n) =>
            (o.min !== undefined && n < o.min) ||
            (o.max !== undefined && n > o.max),
        )
      ) {
        return {
          kind: "error",
          message: `--${key} は ${rangeText(o)}で指定する: ${String(raw)}`,
          usage: spec.usage,
        };
      }
      values[key] = o.multiple === true ? nums : nums[0];
      continue;
    }
    values[key] = raw;
  }

  return {
    kind: "ok",
    values: values as Values<O>,
    positionals: parsed.positionals,
  };
}

function toInteger(value: string): number | undefined {
  if (!/^[+-]?\d+$/.test(value)) {
    return undefined;
  }
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : undefined;
}

function rangeText(o: OptionSpec): string {
  if (o.min !== undefined && o.max !== undefined) {
    return `${o.min} 以上 ${o.max} 以下の整数`;
  }
  return o.min !== undefined ? `${o.min} 以上の整数` : `${o.max} 以下の整数`;
}

/**
 * process.argv を解釈して run を実行する。--help は使い方を標準出力へ出して exit 0、
 * 解釈エラー (未知のフラグ・値の欠落・不正な数値) は message と使い方を標準エラーへ出して exit 1。
 */
export async function runCli<O extends Record<string, OptionSpec>>(
  spec: CommandSpec<O> & {
    run: (ctx: { values: Values<O>; positionals: string[] }) => unknown;
  },
  argv: string[] = process.argv.slice(2),
): Promise<void> {
  const result = parseCommand(spec, argv);
  if (result.kind === "help") {
    process.stdout.write(result.text);
    process.exit(0);
  }
  if (result.kind === "error") {
    console.error(result.message);
    console.error(`usage: ${result.usage}`);
    process.exit(1);
  }
  await spec.run({ values: result.values, positionals: result.positionals });
}
