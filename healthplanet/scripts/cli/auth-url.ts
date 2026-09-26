import { cli, define } from "gunshi";
import { loadAuthUrlConfig } from "../lib/config.ts";
import { buildAuthUrl } from "../lib/oauth.ts";

const command = define({
  name: "auth-url",
  description:
    "Health Planet の /oauth/auth の認可 URL を組み立てて出力する (ブラウザで開いて認可コードを取得する)",
  args: {
    scope: {
      type: "string",
      short: "s",
      default: "innerscan",
      description:
        "取得スコープ (innerscan/pedometer/sphygmomanometer/smug をカンマ区切り)",
    },
  },
  run: (ctx) => {
    const { scope } = ctx.values;
    try {
      const config = loadAuthUrlConfig();
      console.log(
        buildAuthUrl({
          clientId: config.clientId,
          redirectUri: config.redirectUri,
          scopes: scope,
        }),
      );
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      Deno.exit(1);
    }
  },
});

if (import.meta.main) {
  await cli(Deno.args, command);
}
