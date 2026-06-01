import { assertEquals } from "@std/assert";
import plugin from "./index.ts";

const { Processor } = plugin;

interface Str {
  type: string;
  value: string;
  range: [number, number];
  loc: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

interface Ast {
  type: string;
  range: [number, number];
  children: Array<{ type: string; children: Str[] }>;
}

function preProcess(text: string, keys?: string[]): Ast {
  const p = new Processor(keys ? { keys } : {});
  return p.processor(".yaml").preProcess(text) as unknown as Ast;
}

function items(text: string, keys?: string[]): Str[] {
  return preProcess(text, keys).children.map((p) => p.children[0]);
}

function values(text: string, keys?: string[]): string[] {
  return items(text, keys).map((s) => s.value);
}

Deno.test("availableExtensions は .yaml / .yml", () => {
  assertEquals(new Processor().availableExtensions(), [".yaml", ".yml"]);
});

Deno.test("キー未指定なら何も抽出しない", () => {
  assertEquals(values("description: hello\n"), []);
  assertEquals(values("description: hello\n", []), []);
});

Deno.test("ドット無しキーは任意の深さに再帰マッチする", () => {
  const text = "description: top\nnested:\n  description: deep\n";
  assertEquals(values(text, ["description"]), ["top", "deep"]);
});

Deno.test("ドット付きパスは完全一致のみ", () => {
  const text = "a:\n  b: x\n  c: y\nb: z\n";
  assertEquals(values(text, ["a.b"]), ["x"]);
});

Deno.test("* は任意のキー 1 段にマッチする", () => {
  const text = "foo:\n  description: a\nbar:\n  description: b\n";
  assertEquals(values(text, ["*.description"]), ["a", "b"]);
});

Deno.test("[].key は配列要素内のキーにマッチする", () => {
  const text = "list:\n  - name: a\n  - name: b\n";
  assertEquals(values(text, ["list[].name"]), ["a", "b"]);
});

Deno.test("マッチしないキーは空", () => {
  assertEquals(values("title: hello\n", ["description"]), []);
});

Deno.test("plain scalar は range が value と一致する(fix 安全の不変条件)", () => {
  const text = "description: hello world\n";
  const it = items(text, ["description"])[0];
  assertEquals(it.value, "hello world");
  assertEquals(text.slice(it.range[0], it.range[1]), it.value);
});

Deno.test("block scalar (|-) は生ソース(インデント込み)を抽出し range が value と一致する", () => {
  // fix の range 整合をソース座標で保つため、YAML デコード後の値ではなく
  // 生ソース本体 (インデント込み・末尾改行除外) を採取する。
  const text = "description: |-\n  line one\n  line two\n";
  const it = items(text, ["description"])[0];
  assertEquals(it.value, "  line one\n  line two");
  assertEquals(text.slice(it.range[0], it.range[1]), it.value);
});

Deno.test("quoted scalar は安全のため除外する", () => {
  assertEquals(values('description: "hello"\n', ["description"]), []);
});

Deno.test("loc は 1 始まりの行を持つ", () => {
  const text = "a: x\ndescription: hello\n";
  assertEquals(items(text, ["description"])[0].loc.start.line, 2);
});

Deno.test("AST ルートは Document、子は Paragraph > Str", () => {
  const ast = preProcess("description: hi\n", ["description"]);
  assertEquals(ast.type, "Document");
  assertEquals(ast.children[0].type, "Paragraph");
  assertEquals(ast.children[0].children[0].type, "Str");
});
