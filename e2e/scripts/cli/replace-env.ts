/**
 * cli/replace-env.ts
 * spec.json 内の ${ENV_VAR} を実際の環境変数に置き換える CLI
 *
 * Usage:
 *   deno task replace-env [--input <path>] [--output <path>]
 */

import { cli, define } from "@gunshi/gunshi";
import { dirname, relative, resolve } from "@std/path";
import { readFile, writeOutput } from "../utils/io.ts";
import { parseSpecJson, toSpecJson } from "../utils/json.ts";
import { type Case, type Spec } from "../types/spec.ts";
import { handleError } from "./handle-error.ts";

// ---------------------------------------------------------------------------
// 環境変数置換
// ---------------------------------------------------------------------------

/**
 * 文字列内の ${VAR} を対応する環境変数の値に置き換える。
 * 未定義の変数はプレースホルダーをそのまま保持する。
 */
function replaceEnv(str: string): string {
  return str.replace(/\$\{([^}]+)\}/g, (placeholder, name: string) => {
    return Deno.env.get(name) ?? placeholder;
  });
}

function replaceEnvInCase(c: Case): Case {
  return {
    columns: c.columns.map(replaceEnv),
    rows: c.rows.map((row) => {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        result[replaceEnv(k)] = replaceEnv(v);
      }
      return result;
    }),
  };
}

function replaceEnvInSpec(spec: Spec): Spec {
  return {
    title: replaceEnv(spec.title),
    ...(spec.description !== undefined
      ? { description: replaceEnv(spec.description) }
      : {}),
    ...(spec.devices !== undefined
      ? {
        devices: Object.fromEntries(
          Object.entries(spec.devices).map(([k, v]) => [
            k,
            {
              ...v,
              ...(v.userAgent !== undefined
                ? { userAgent: replaceEnv(v.userAgent) }
                : {}),
            },
          ]),
        ),
      }
      : {}),
    ...(spec.case !== undefined ? { case: replaceEnvInCase(spec.case) } : {}),
    scenarios: spec.scenarios.map((scenario) => ({
      name: replaceEnv(scenario.name),
      ...(scenario.description !== undefined
        ? { description: replaceEnv(scenario.description) }
        : {}),
      ...(scenario.case !== undefined
        ? { case: replaceEnvInCase(scenario.case) }
        : {}),
      steps: scenario.steps.map(replaceEnv),
    })),
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

/** --output パスからスキーマへの相対パスを計算する。stdout 出力時は undefined を返す。 */
function schemaRelativePath(
  outputPath: string | undefined,
): string | undefined {
  if (outputPath === undefined) {
    return undefined;
  }
  const schemaAbsPath = resolve(
    import.meta.dirname!,
    "../schemas/spec.schema.json",
  );
  return relative(dirname(resolve(outputPath)), schemaAbsPath);
}

const command = define({
  name: "replace-env",
  description: "spec.json 内の ${ENV_VAR} を実際の環境変数に置き換える",
  args: {
    input: {
      type: "string",
      description: "入力 spec.json ファイルパス（省略時: stdin）",
    },
    output: {
      type: "string",
      description: "出力 JSON ファイルパス（省略時: stdout）",
    },
  },
  run: async (ctx) => {
    const { input, output } = ctx.values;
    let json: string;
    try {
      json = toSpecJson(
        replaceEnvInSpec(parseSpecJson(await readFile(input))),
        schemaRelativePath(output),
      );
    } catch (e) {
      handleError(e);
    }
    await writeOutput(output, json);
  },
});

try {
  await cli(Deno.args, command, { renderValidationErrors: null });
} catch (e) {
  handleError(e);
}
