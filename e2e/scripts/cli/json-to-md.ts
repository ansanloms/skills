/**
 * cli/json-to-md.ts
 * spec.json (中間 JSON 表現) → spec.md (Markdown) 変換 CLI
 *
 * Usage:
 *   deno task cli:json-to-md [--input <path>] [--output <path>]
 */

import { cli, define } from "@gunshi/gunshi";
import { readFile, writeOutput } from "../utils/io.ts";
import { parseSpecJson } from "../utils/json.ts";
import { toMarkdown } from "../utils/markdown.ts";
import { handleError } from "./handle-error.ts";

const command = define({
  name: "json-to-md",
  description: "spec.json を spec.md に変換する",
  args: {
    input: {
      type: "string",
      description: "入力 JSON ファイルパス（省略時: stdin）",
    },
    output: {
      type: "string",
      description: "出力 Markdown ファイルパス（省略時: stdout）",
    },
  },
  run: async (ctx) => {
    const { input, output } = ctx.values;
    let md: string;
    try {
      md = toMarkdown(parseSpecJson(await readFile(input)));
    } catch (e) {
      handleError(e);
    }
    await writeOutput(output, md);
  },
});

try {
  await cli(Deno.args, command, { renderValidationErrors: null });
} catch (e) {
  handleError(e);
}
