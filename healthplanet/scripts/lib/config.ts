/**
 * 環境変数から Health Planet API の設定を読み込む。
 * 用途 (auth-url / token・status) ごとに必須項目が違うため、関数を分けてある。
 */

const DEFAULT_REDIRECT_URI = "https://www.healthplanet.jp/success.html";

/** 必須環境変数を読む。無ければ変数名を含むエラーを投げる。 */
function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value === "") {
    throw new Error(`環境変数 ${name} が未設定`);
  }
  return value;
}

/** auth-url コマンド向けの設定。client_secret は不要。 */
export type AuthUrlConfig = {
  clientId: string;
  redirectUri: string;
};

export function loadAuthUrlConfig(): AuthUrlConfig {
  return {
    clientId: requireEnv("HEALTHPLANET_CLIENT_ID"),
    redirectUri: Deno.env.get("HEALTHPLANET_REDIRECT_URI") ??
      DEFAULT_REDIRECT_URI,
  };
}

/** token・status コマンド向けの設定。トークンファイルの読み書きに使う。 */
export type TokenConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenPath: string;
};

export function loadTokenConfig(): TokenConfig {
  return {
    clientId: requireEnv("HEALTHPLANET_CLIENT_ID"),
    clientSecret: requireEnv("HEALTHPLANET_CLIENT_SECRET"),
    redirectUri: Deno.env.get("HEALTHPLANET_REDIRECT_URI") ??
      DEFAULT_REDIRECT_URI,
    tokenPath: requireEnv("HEALTHPLANET_TOKEN_PATH"),
  };
}
