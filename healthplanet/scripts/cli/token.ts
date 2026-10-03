import { cli, define } from "gunshi";
import { loadTokenConfig } from "../lib/config.ts";
import { exchangeCode } from "../lib/oauth.ts";
import { toStoredToken, writeTokenFile } from "../lib/token-file.ts";

const command = define({
  name: "token",
  description:
    "認可コードをアクセストークン・リフレッシュトークンに交換し、トークンファイルへ保存する (/oauth/auth から 10 分以内に実行する)",
  args: {},
  run: async (ctx) => {
    const code = ctx.positionals[0];
    if (code === undefined) {
      console.error("usage: token <code>");
      Deno.exit(1);
    }

    try {
      const config = loadTokenConfig();
      const token = await exchangeCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        code,
      });
      const stored = toStoredToken(token, new Date());
      await writeTokenFile(config.tokenPath, stored);
      console.log(
        JSON.stringify(
          {
            token_path: config.tokenPath,
            expires_in: stored.expires_in,
            obtained_at: stored.obtained_at,
          },
          null,
          2,
        ),
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
