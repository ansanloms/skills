// このファイルは google-health/scripts/lib と mountain-weather/scripts/lib に複製している
// (各 skill は単体で配布するため共有できない)。両方を同一に保つこと (起動する CLI のパスのみ異なる)。
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatHelp, parseCommand, type CommandSpec } from "./cli.ts";

const options = {
  port: {
    type: "number",
    short: "p",
    default: 8765,
    min: 1,
    max: 65535,
    description: "port",
  },
  depth: { type: "number", description: "depth" },
  scope: {
    type: "string",
    short: "s",
    multiple: true,
    description: "scope",
  },
  "update-mask": { type: "string", description: "mask" },
  reconcile: { type: "boolean", default: false, description: "reconcile" },
  verbose: { type: "boolean", short: "v", description: "verbose" },
} as const;

const spec: CommandSpec<typeof options> = {
  description: "サンプル",
  usage: "sample [--port=<port>]",
  options,
  allowPositionals: true,
};

test("parseCommand: 既定値が入り、未指定の値は undefined になる", () => {
  const r = parseCommand(spec, []);
  assert.equal(r.kind, "ok");
  if (r.kind !== "ok") {
    return;
  }
  assert.equal(r.values.port, 8765);
  assert.equal(r.values.reconcile, false);
  assert.equal(r.values.scope, undefined);
  assert.equal(r.values["update-mask"], undefined);
  assert.equal(r.values.verbose, undefined);
  assert.deepEqual(r.positionals, []);
});

test("parseCommand: --flag=value と --flag value と短縮形が同じ結果になる", () => {
  for (const argv of [["--port=9000"], ["--port", "9000"], ["-p", "9000"]]) {
    const r = parseCommand(spec, argv);
    assert.equal(r.kind, "ok");
    if (r.kind === "ok") {
      assert.equal(r.values.port, 9000);
    }
  }
});

test("parseCommand: multiple は繰り返し指定を配列に集める", () => {
  const r = parseCommand(spec, ["-s", "a", "--scope=b", "--scope", "c"]);
  assert.equal(r.kind, "ok");
  if (r.kind === "ok") {
    assert.deepEqual(r.values.scope, ["a", "b", "c"]);
  }
});

test("parseCommand: kebab-case のオプションと boolean を解釈する", () => {
  const r = parseCommand(spec, ["--update-mask=a,b", "--reconcile", "-v"]);
  assert.equal(r.kind, "ok");
  if (r.kind !== "ok") {
    return;
  }
  assert.equal(r.values["update-mask"], "a,b");
  assert.equal(r.values.reconcile, true);
  assert.equal(r.values.verbose, true);
});

test("parseCommand: 位置引数を返す。-- 以降はそのまま位置引数", () => {
  const r = parseCommand(spec, ["x", "--port=1", "--", "--y"]);
  assert.equal(r.kind, "ok");
  if (r.kind === "ok") {
    assert.deepEqual(r.positionals, ["x", "--y"]);
  }
});

test("parseCommand: allowPositionals 未指定なら位置引数はエラー", () => {
  const r = parseCommand({ ...spec, allowPositionals: undefined }, ["x"]);
  assert.equal(r.kind, "error");
});

test("parseCommand: number は整数のみ受け付ける", () => {
  for (const bad of ["abc", "1.5", "", "1e3"]) {
    const r = parseCommand(spec, [`--port=${bad}`]);
    assert.equal(r.kind, "error", bad);
    if (r.kind === "error") {
      assert.match(r.message, /--port は整数/);
    }
  }
});

test("parseCommand: number は安全な整数の範囲外を拒否する", () => {
  for (const big of ["9007199254740993", "99999999999999999999"]) {
    const r = parseCommand(spec, [`--depth=${big}`]);
    assert.equal(r.kind, "error", big);
    if (r.kind === "error") {
      assert.match(r.message, /--depth は整数/);
    }
  }
  const neg = parseCommand(spec, ["--depth=-5"]);
  assert.equal(neg.kind, "ok");
  if (neg.kind === "ok") {
    assert.equal(neg.values.depth, -5);
  }
});

test("parseCommand: number は min / max の範囲外を使い方エラーにする", () => {
  for (const bad of ["0", "-1", "65536", "70000"]) {
    const r = parseCommand(spec, [`--port=${bad}`]);
    assert.equal(r.kind, "error", bad);
    if (r.kind === "error") {
      assert.equal(
        r.message,
        `--port は 1 以上 65535 以下の整数で指定する: ${bad}`,
      );
      assert.equal(r.usage, spec.usage);
    }
  }
  for (const ok of [1, 65535]) {
    const r = parseCommand(spec, [`--port=${ok}`]);
    assert.equal(r.kind, "ok", String(ok));
    if (r.kind === "ok") {
      assert.equal(r.values.port, ok);
    }
  }
});

test("parseCommand: 未知のフラグ・値の欠落・boolean への値指定・--no- 否定はエラー", () => {
  for (const argv of [
    ["--bogus"],
    ["--port"],
    ["--reconcile=x"],
    ["--no-reconcile"],
  ]) {
    const r = parseCommand(spec, argv);
    assert.equal(r.kind, "error", argv.join(" "));
    if (r.kind === "error") {
      assert.equal(r.usage, spec.usage);
    }
  }
});

test("parseCommand: --help / -h は解釈エラーが無ければ help を返す", () => {
  for (const argv of [["--help"], ["-h"], ["x", "--port=1", "-h"]]) {
    const r = parseCommand(spec, argv);
    assert.equal(r.kind, "help");
    if (r.kind === "help") {
      assert.equal(r.text, formatHelp(spec));
    }
  }
});

test("parseCommand: 解釈エラーは --help より優先される", () => {
  const r = parseCommand(spec, ["--bogus", "--help"]);
  assert.equal(r.kind, "error");
  if (r.kind === "error") {
    assert.match(r.message, /Unknown option '--bogus'/);
  }
});

test("formatHelp: usage 行と全オプションの説明を含む", () => {
  const text = formatHelp(spec);
  assert.match(text, /^usage: sample \[--port=<port>\]\n/);
  assert.match(text, /-p, --port <number>\s+port \(既定: 8765\)/);
  assert.match(text, /--depth <number>\s+depth\n/);
  assert.match(text, /--reconcile\s+reconcile\n/);
  assert.doesNotMatch(text, /既定: false/);
  assert.equal(text.match(/既定: 8765/g)?.length, 1);
  assert.match(text, /-s, --scope <string>\s+scope/);
  assert.match(text, /-h, --help/);
});

const TOKEN_STATUS = resolve(import.meta.dirname, "../cli/token-status.ts");

function run(args: string[]) {
  const r = spawnSync(process.execPath, [TOKEN_STATUS, ...args], {
    env: { PATH: process.env.PATH ?? "" },
    encoding: "utf-8",
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test("runCli: --help は usage を標準出力へ出して exit 0", () => {
  for (const flag of ["--help", "-h"]) {
    const r = run([flag]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^usage: token-status\n/);
    assert.equal(r.stderr, "");
  }
});

test("runCli: 未知のフラグはエラーと usage を標準エラーへ出して exit 1", () => {
  const r = run(["--bogus"]);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, "");
  assert.match(r.stderr, /Unknown option '--bogus'/);
  assert.match(r.stderr, /usage: token-status/);
});

const SIBLING = resolve(
  import.meta.dirname,
  "../../../mountain-weather/scripts/lib/cli.ts",
);

test(
  "cli.ts: 相手側 skill の複製と内容が一致する",
  { skip: !existsSync(SIBLING) && "相手側 skill が無い (単体配布)" },
  () => {
    assert.equal(
      readFileSync(resolve(import.meta.dirname, "./cli.ts"), "utf-8"),
      readFileSync(SIBLING, "utf-8"),
    );
  },
);
