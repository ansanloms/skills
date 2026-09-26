import { cli, define } from "gunshi";
import { loadTokenConfig } from "../lib/config.ts";
import { fetchStatusWithAuth } from "../lib/status-with-auth.ts";
import { type StatusKind, validateDateTime } from "../lib/status.ts";

const KINDS: readonly StatusKind[] = [
  "innerscan",
  "pedometer",
  "sphygmomanometer",
];

function isStatusKind(value: string): value is StatusKind {
  return (KINDS as readonly string[]).includes(value);
}

const command = define({
  name: "status",
  description:
    "Health Planet の /status/{kind}.json を取得し、レスポンスをそのまま出力する (期限切れならリフレッシュしてから取得する)",
  args: {
    from: {
      type: "string",
      description: "取得範囲の開始 (14 桁 yyyyMMddHHmmss、3 か月以内)",
    },
    to: {
      type: "string",
      description: "取得範囲の終了 (14 桁 yyyyMMddHHmmss、3 か月以内)",
    },
    date: {
      type: "string",
      short: "d",
      default: "1",
      description: "0 = 登録日、1 = 測定日 (既定 1)",
    },
    tag: {
      type: "string",
      description: "絞り込むタグ (カンマ区切り。例: 6021,6022)",
    },
  },
  run: async (ctx) => {
    const kind = ctx.positionals[0];
    if (kind === undefined || !isStatusKind(kind)) {
      console.error(
        `usage: status <innerscan|pedometer|sphygmomanometer> [--from=<14桁>] [--to=<14桁>] [--date=0|1] [--tag=<タグ>]`,
      );
      Deno.exit(1);
    }

    const { from, to, date, tag } = ctx.values;
    if (date !== "0" && date !== "1") {
      console.error(`--date は 0 または 1 で指定する: ${date}`);
      Deno.exit(1);
    }
    try {
      if (from !== undefined) {
        validateDateTime(from);
      }
      if (to !== undefined) {
        validateDateTime(to);
      }

      const config = loadTokenConfig();
      const body = await fetchStatusWithAuth({
        config,
        kind,
        date,
        from,
        to,
        tag,
      });
      console.log(body);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  },
});

if (import.meta.main) {
  await cli(Deno.args, command);
}
