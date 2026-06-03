/**
 * cli/export-excel.ts
 * spec.replaced.json を Excel Book に出力する CLI
 *
 * Usage:
 *   deno task export:excel --spec <path> [--macro <path>...] --output <path>
 */

import { cli, define } from "@gunshi/gunshi";
import { type Spec } from "../types/spec.ts";
import { type Macros } from "../types/macros.ts";
import { parseMacrosJson, parseSpecJson } from "../utils/json.ts";
import { handleError } from "./handle-error.ts";
import ExcelJS from "exceljs";

// ---------------------------------------------------------------------------
// 定数 / ユーティリティ
// ---------------------------------------------------------------------------

/** px → ExcelJS 列幅（文字数単位）変換 */
const px = (pixels: number): number => Math.round(pixels / 7);

/**
 * Win / Mac 双方にプリインストールされている游ゴシックをデフォルトフォントとして使用する。
 * - Windows 8.1+: 游ゴシック (Yu Gothic)
 * - macOS 10.9+ : 游ゴシック (Yu Gothic)
 */
const DEFAULT_FONT_NAME = "游ゴシック";
const DEFAULT_FONT_SIZE = 11;

const THIN_BORDER: ExcelJS.BorderStyle = "thin";
const CELL_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: THIN_BORDER },
  left: { style: THIN_BORDER },
  bottom: { style: THIN_BORDER },
  right: { style: THIN_BORDER },
};

/** 通常セルにデフォルトフォント + 罫線 + 折り返しを適用する */
function applyDataStyle(cell: ExcelJS.Cell): void {
  cell.font = { name: DEFAULT_FONT_NAME, size: DEFAULT_FONT_SIZE };
  cell.border = CELL_BORDER as ExcelJS.Borders;
  cell.alignment = { wrapText: true };
}

/** ヘッダーセルに装飾 + 罫線を適用する */
function applyHeaderStyle(cell: ExcelJS.Cell): void {
  cell.font = {
    name: DEFAULT_FONT_NAME,
    size: DEFAULT_FONT_SIZE,
    color: { argb: "FFFFFFFF" },
    bold: true,
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F6228" },
  };
  cell.border = CELL_BORDER as ExcelJS.Borders;
}

/**
 * ステップ文字列内の `@macroName` を macro の description（なければ script）に置換する。
 * macro が未定義の場合はそのまま返す。
 */
function resolveMacroStep(step: string, macros: Macros): string {
  if (!step.startsWith("@")) {
    return step;
  }
  const name = step.slice(1);
  const macro = macros[name];
  if (!macro) {
    return step;
  }
  return macro.description ?? macro.script;
}

// ---------------------------------------------------------------------------
// overview シート
// ---------------------------------------------------------------------------

function buildOverviewSheet(wb: ExcelJS.Workbook, spec: Spec): void {
  const ws = wb.addWorksheet("overview");

  // A1: タイトル（太字）
  ws.getCell("A1").value = spec.title;
  ws.getCell("A1").font = {
    name: DEFAULT_FONT_NAME,
    size: DEFAULT_FONT_SIZE,
    bold: true,
  };

  // A3: ヘッダー行
  const headers = ["scenario", "title", "overview", "case"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(3, 1 + i);
    cell.value = h;
    applyHeaderStyle(cell);
  });

  // 列幅設定
  ws.getColumn(1).width = px(120); // scenario
  ws.getColumn(2).width = px(460); // title
  ws.getColumn(3).width = px(800); // overview
  ws.getColumn(4).width = px(320); // case

  // A4 以降: データ行
  spec.scenarios.forEach((scenario, idx) => {
    const no = idx + 1;
    const row = 4 + idx;

    // case 列の値を構築（scenario.case が spec.case より優先）
    let caseValue = "";
    if (scenario.case) {
      caseValue = `#case-s${no}`;
    } else if (spec.case) {
      caseValue = `#case-common`;
    }

    const cells = [no, scenario.name, scenario.description ?? "", caseValue];
    cells.forEach((v, i) => {
      const cell = ws.getCell(row, 1 + i);
      cell.value = v;
      applyDataStyle(cell);
    });
  });
}

// ---------------------------------------------------------------------------
// case シート
// ---------------------------------------------------------------------------

function buildCaseSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  columns: string[],
  rows: Record<string, string>[],
): void {
  const ws = wb.addWorksheet(sheetName);

  // 列幅設定（各列 160px）
  columns.forEach((_, i) => {
    ws.getColumn(1 + i).width = px(160);
  });

  // ヘッダー行
  columns.forEach((col, i) => {
    const cell = ws.getCell(1, 1 + i);
    cell.value = col;
    applyHeaderStyle(cell);
  });

  // データ行
  rows.forEach((row, rowIdx) => {
    columns.forEach((col, colIdx) => {
      const cell = ws.getCell(2 + rowIdx, 1 + colIdx);
      cell.value = row[col] ?? "";
      applyDataStyle(cell);
    });
  });
}

// ---------------------------------------------------------------------------
// scenario シート
// ---------------------------------------------------------------------------

function buildScenarioSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  scenarioName: string,
  steps: string[],
  macros: Macros,
): void {
  const ws = wb.addWorksheet(sheetName);

  // A1: シナリオ名（太字）
  ws.getCell("A1").value = scenarioName;
  ws.getCell("A1").font = {
    name: DEFAULT_FONT_NAME,
    size: DEFAULT_FONT_SIZE,
    bold: true,
  };

  // A3: ヘッダー行
  const headers = ["no.", "step", "status", "remark"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(3, 1 + i);
    cell.value = h;
    applyHeaderStyle(cell);
  });

  // 列幅設定
  ws.getColumn(1).width = px(80); // no.
  ws.getColumn(2).width = px(800); // step
  ws.getColumn(3).width = px(120); // status
  ws.getColumn(4).width = px(640); // remark

  // A4 以降: データ行
  steps.forEach((step, idx) => {
    const rowNum = 4 + idx;

    const rowData: [number, string, string, string] = [
      idx + 1,
      resolveMacroStep(step, macros),
      "",
      "",
    ];
    rowData.forEach((v, i) => {
      const cell = ws.getCell(rowNum, 1 + i);
      cell.value = v;
      applyDataStyle(cell);
    });

    // status 列にドロップダウン（OK / NG）
    ws.getCell(rowNum, 3).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"OK,NG"'],
      showErrorMessage: false,
      showInputMessage: false,
    };
  });
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

async function exportExcel(opts: {
  spec: string;
  macro: string[];
  output: string;
}): Promise<void> {
  const specText = await Deno.readTextFile(opts.spec);
  const spec = parseSpecJson(specText);

  // macro の読み込み
  const macros: Macros = {};
  for (const macroPath of opts.macro) {
    const macroText = await Deno.readTextFile(macroPath);
    const parsed = parseMacrosJson(macroText);
    Object.assign(macros, parsed);
  }

  const wb = new ExcelJS.Workbook();

  // 1. overview シート
  buildOverviewSheet(wb, spec);

  // 2. case シート群
  //    spec.case     → "case-common"
  //    scenario.case → "case-s[no]"
  if (spec.case) {
    buildCaseSheet(
      wb,
      `case-common`,
      spec.case.columns,
      spec.case.rows,
    );
  }
  spec.scenarios.forEach((scenario, idx) => {
    if (scenario.case) {
      buildCaseSheet(
        wb,
        `case-s${idx + 1}`,
        scenario.case.columns,
        scenario.case.rows,
      );
    }
  });

  // 3. scenario シート群: "s[no]"
  spec.scenarios.forEach((scenario, idx) => {
    buildScenarioSheet(
      wb,
      `s${idx + 1}`,
      scenario.name,
      scenario.steps,
      macros,
    );
  });

  // 書き出し
  await wb.xlsx.writeFile(opts.output);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const command = define({
  name: "export:excel",
  description: "spec.replaced.json を Excel Book に出力する",
  args: {
    spec: {
      type: "string",
      required: true,
      description: "入力 spec.replaced.json ファイルパス",
    },
    macro: {
      type: "string",
      multiple: true,
      description: "マクロ定義 JSON ファイルのパス（複数指定可）",
    },
    output: {
      type: "string",
      required: true,
      description: "出力 Excel ファイルパス",
    },
  },
  run: async (ctx) => {
    const { spec, macro, output } = ctx.values;
    try {
      await exportExcel({ spec, macro: macro ?? [], output });
    } catch (e) {
      handleError(e);
    }
  },
});

try {
  await cli(Deno.args, command, { renderValidationErrors: null });
} catch (e) {
  handleError(e);
}
