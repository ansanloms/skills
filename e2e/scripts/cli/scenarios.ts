/**
 * cli/scenarios.ts
 * spec.json のシナリオ実行一覧を出力する CLI
 *
 * Usage:
 *   deno task scenarios [--input <path>] [--macro <path>] [--target <target>] [--format text|json] [--output <path>]
 */

import { cli, define } from "@gunshi/gunshi";
import { readFile, writeOutput } from "../utils/io.ts";
import { parseMacrosJson, parseSpecJson } from "../utils/json.ts";
import { matchesTarget } from "../utils/step-number.ts";
import { type Spec } from "../types/spec.ts";
import { type Macros } from "../types/macros.ts";
import { type Result } from "../types/result.ts";
import { handleError } from "./handle-error.ts";

// ---------------------------------------------------------------------------
// マクロ読み込み・展開
// ---------------------------------------------------------------------------

/**
 * 複数の macro.json ファイルを読み込み、後指定優先でマージする。
 * 空配列の場合は空オブジェクトを返す。
 */
async function loadMacros(paths: string[]): Promise<Macros> {
  const merged: Macros = {};
  for (const path of paths) {
    const content = parseMacrosJson(await Deno.readTextFile(path));
    Object.assign(merged, content);
  }
  return merged;
}

/**
 * ステップテキストが `@macro-name` 形式の場合、macros の script 値に展開する。
 * 未定義のマクロ名の場合は元のテキストをそのまま返す。
 */
function expandMacro(step: string, macros: Macros): string {
  const m = step.match(/^@([a-zA-Z][a-zA-Z0-9\-]*)$/);
  if (!m) {
    return step;
  }
  return macros[m[1]]?.script ?? step;
}

/**
 * テキスト内の `<column>` プレースホルダーをケーステーブルの列値で置換する。
 * マクロ展開前後の両方に適用することで、マクロ名自体に <column> を使った
 * `@macro-<lang>` 形式と、マクロ script 内の <column> の両方が置換対象になる。
 */
function applyColumnValues(
  text: string,
  caseRow: Record<string, string>,
): string {
  return Object.entries(caseRow).reduce(
    (acc, [key, value]) => acc.replaceAll(`<${key}>`, value),
    text,
  );
}

// ---------------------------------------------------------------------------
// リスト生成
// ---------------------------------------------------------------------------

/**
 * spec から全実行項目（step 単位）のリストを生成する。
 *
 * no. の形式: `{scenario_index}.{case}.{step_index}`
 *   - scenario_index: spec.scenarios の 1-indexed 番号。
 *   - case          : 当該 scenario の `case.rows` の行番号 (1〜M)。
 *                     scenario に case がなければグローバル `spec.case.rows` の行番号 (1〜N)。
 *                     どちらもなければ 1 固定。
 *   - step_index    : scenario.steps の 1-indexed 番号。
 */
function generateScenarioList(spec: Spec, macros: Macros): Result {
  const globalCaseRows = spec.case?.rows;
  const items: Result = [];

  for (let s = 0; s < spec.scenarios.length; s++) {
    const scenario = spec.scenarios[s];
    // scenario.case が存在する場合は spec.case より優先する
    const caseRows = scenario.case?.rows ?? globalCaseRows;
    const caseCount = caseRows?.length ?? 1;

    for (let c = 1; c <= caseCount; c++) {
      const caseRow: Record<string, string> = caseRows?.[c - 1] ?? {};
      for (let st = 0; st < scenario.steps.length; st++) {
        items.push({
          no: `${s + 1}.${c}.${st + 1}`,
          scenario: applyColumnValues(
            expandMacro(
              applyColumnValues(scenario.steps[st], caseRow),
              macros,
            ),
            caseRow,
          ),
        });
      }
    }
  }

  // no. の昇順（数値比較）で並べ替え
  items.sort((a, b) => {
    const [as_, ac, ast] = a.no.split(".").map(Number);
    const [bs_, bc, bst] = b.no.split(".").map(Number);
    if (as_ !== bs_) {
      return as_ - bs_;
    }
    if (ac !== bc) {
      return ac - bc;
    }
    return ast - bst;
  });

  return items;
}

// ---------------------------------------------------------------------------
// 出力フォーマット
// ---------------------------------------------------------------------------

/**
 * シナリオ一覧をテキスト形式（`{no} {scenario}` 1 行 1 エントリ）に変換する。
 */
function formatText(items: Result): string {
  return (
    items.map(({ no, scenario }) => `${no} ${scenario}`).join("\n") +
    (items.length > 0 ? "\n" : "")
  );
}

/**
 * シナリオ一覧を JSON 配列形式に変換する。
 */
function formatJson(items: Result): string {
  return JSON.stringify(items, null, 2) + "\n";
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const command = define({
  name: "scenarios",
  description: "spec.json のシナリオ実行一覧を出力する",
  args: {
    input: {
      type: "string",
      description: "入力 spec.json ファイルパス（省略時: stdin）",
    },
    macro: {
      type: "string",
      multiple: true,
      description: "マクロ定義 JSON ファイルのパス（複数指定可、後指定優先）",
    },
    target: {
      type: "string",
      description: "実行対象の絞り込み",
    },
    format: {
      type: "enum",
      choices: ["text", "json"] as const,
      default: "text",
      description: "出力フォーマット: text | json (デフォルト: text)",
    },
    output: {
      type: "string",
      description: "出力ファイルパス（省略時: stdout）",
    },
  },
  run: async (ctx) => {
    const { input, macro, target, format, output } = ctx.values;
    let result: string;
    try {
      const spec = parseSpecJson(await readFile(input));
      const macros = await loadMacros(macro ?? []);
      let items = generateScenarioList(spec, macros);
      if (target !== undefined) {
        items = items.filter((item) => matchesTarget(item.no, target));
      }
      result = format === "json" ? formatJson(items) : formatText(items);
    } catch (e) {
      handleError(e);
    }
    await writeOutput(output, result);
  },
});

try {
  await cli(Deno.args, command, { renderValidationErrors: null });
} catch (e) {
  handleError(e);
}
