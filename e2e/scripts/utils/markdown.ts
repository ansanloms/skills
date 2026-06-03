/**
 * utils/markdown.ts
 * Spec 型 → Markdown 変換
 */

import * as yaml from "@std/yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";
import { type Spec } from "../types/spec.ts";

// ---------------------------------------------------------------------------
// AST 型 — remark の型パラメータから導出する
// ---------------------------------------------------------------------------

const processor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(remarkStringify);

type Root = ReturnType<(typeof processor)["parse"]>;
type RootContent = Root["children"][number];
type Heading = Extract<RootContent, { type: "heading" }>;
type Table = Extract<RootContent, { type: "table" }>;
type TableRow = Table["children"][number];
type TableCell = TableRow["children"][number];
type List = Extract<RootContent, { type: "list" }>;
type ListItem = List["children"][number];
type ThematicBreak = Extract<RootContent, { type: "thematicBreak" }>;
type PhrasingContent = Heading["children"][number];

/** remark-frontmatter が AST に追加する yaml ノード型 */
type YamlNode = { type: "yaml"; value: string };

// ---------------------------------------------------------------------------
// AST builders（Spec → Root）
// ---------------------------------------------------------------------------

function headingNode(depth: Heading["depth"], text: string): Heading {
  return {
    type: "heading",
    depth,
    children: [{ type: "text" as const, value: text }],
  };
}

function thematicBreakNode(): ThematicBreak {
  return { type: "thematicBreak" };
}

function makeCell(text: string): TableCell {
  return {
    type: "tableCell",
    children: [{ type: "text" as const, value: text }],
  };
}

function tableNode(columns: string[], rows: Record<string, string>[]): Table {
  const align: Table["align"] = columns.map(() => null);

  const headerRow: TableRow = {
    type: "tableRow",
    children: columns.map((col) => makeCell(col)),
  };

  const dataRows: TableRow[] = rows.map((row) => ({
    type: "tableRow" as const,
    children: columns.map((col) => makeCell(row[col] ?? "")),
  }));

  return {
    type: "table",
    align,
    children: [headerRow, ...dataRows],
  };
}

/**
 * ステップ文字列内のインラインコード `` `...` `` をパースして AST ノード列に変換する。
 * 例: "foo `bar` baz" → [text("foo "), inlineCode("bar"), text(" baz")]
 */
function parseInlineStep(step: string): PhrasingContent[] {
  const nodes: PhrasingContent[] = [];
  const regex = /`([^`]*)`/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(step)) !== null) {
    if (match.index > last) {
      nodes.push({
        type: "text" as const,
        value: step.slice(last, match.index),
      });
    }
    nodes.push({ type: "inlineCode" as const, value: match[1] });
    last = match.index + match[0].length;
  }

  if (last < step.length) {
    nodes.push({ type: "text" as const, value: step.slice(last) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text" as const, value: step }];
}

function orderedListNode(steps: string[]): List {
  return {
    type: "list",
    ordered: true,
    start: 1,
    spread: false,
    children: steps.map((step): ListItem => ({
      type: "listItem",
      spread: false,
      children: [
        {
          type: "paragraph" as const,
          children: parseInlineStep(step),
        },
      ],
    })),
  };
}

function specToAst(spec: Spec): Root {
  const children: RootContent[] = [];

  // devices がある場合は先頭に yaml ノードを配置する
  // remark-stringify + remark-frontmatter が ---\n...\n---\n を自動出力する
  if (spec.devices !== undefined && Object.keys(spec.devices).length > 0) {
    const yamlNode: YamlNode = {
      type: "yaml",
      // yaml.stringify は末尾 \n を付与するため trimEnd で除去する
      value: yaml.stringify({ devices: spec.devices }).trimEnd(),
    };
    children.push(yamlNode as unknown as RootContent);
  }

  children.push(headingNode(1, spec.title));

  if (spec.description) {
    children.push(
      ...(processor.parse(spec.description).children as RootContent[]),
    );
  }

  if (spec.case) {
    children.push(tableNode([...spec.case.columns], [...spec.case.rows]));
  }

  children.push(thematicBreakNode());

  for (const scenario of spec.scenarios) {
    children.push(headingNode(2, scenario.name));

    if (scenario.description) {
      children.push(
        ...(processor.parse(scenario.description).children as RootContent[]),
      );
    }

    if (scenario.case) {
      children.push(
        tableNode([...scenario.case.columns], [...scenario.case.rows]),
      );
    }

    children.push(orderedListNode([...scenario.steps]));
  }

  return { type: "root", children };
}

// ---------------------------------------------------------------------------
// Post-process helpers
// ---------------------------------------------------------------------------

/**
 * remark-stringify が付与する不要なエスケープを除去する。
 *
 * 環境変数名 `${ENV_VAR}` 内の `\_` を `_` に戻す（`_` は Markdown の emphasis ではないため）。
 * `\<column-name>` の `\<` は HTML タグ扱いを避けるため unescape せず保持する。
 */
function unescapeSpecContent(md: string): string {
  // \_ → _ （識別子・変数名の _ は emphasis ではないため不要なエスケープを除去）
  // description は processor.parse() 経由で italic は *text* に変換済みなので
  // 残る \_ は全て識別子用であり全置換が安全。
  // NOTE: \< は Markdown 上 HTML タグと解釈されるため unescape しない。
  md = md.replace(/\\_/g, "_");
  return md;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Spec 型を Markdown テキストに変換する。
 * devices が定義されている場合は先頭に YAML フロントマターを出力する。
 */
export function toMarkdown(spec: Spec): string {
  return unescapeSpecContent(processor.stringify(specToAst(spec)) as string);
}
