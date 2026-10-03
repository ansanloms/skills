/**
 * Health Planet API の OAuth2 (認可コードフロー) 関連。
 * ネットワーク非依存にするため、fetch は呼び出し側から注入できる (テスト用)。
 */

const AUTH_URL = "https://www.healthplanet.jp/oauth/auth";
const TOKEN_URL = "https://www.healthplanet.jp/oauth/token";

export type AuthUrlParams = {
  clientId: string;
  redirectUri: string;
  /** 取得スコープ (innerscan/pedometer/sphygmomanometer/smug)。カンマ区切りで渡す。 */
  scopes: string;
};

/** /oauth/auth の URL を組み立てる。ブラウザで開いてユーザが認可コードを取得するためのもの。 */
export function buildAuthUrl(params: AuthUrlParams): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", params.scopes);
  url.searchParams.set("response_type", "code");
  return url.toString();
}

/** /oauth/token のレスポンス。 */
export type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
};

/** レスポンス本文を JSON として解釈する。失敗すれば API 構造変化の可能性として例外。 */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      "/oauth/token のレスポンスが JSON として解釈できない (API 構造変化の可能性)。値を捏造せず停止する。",
    );
  }
}

/**
 * レスポンスが必要なフィールドを持つか検証する。access_token・expires_in は両 grant で必須。
 * refresh_token は authorization_code では必須、refresh_token grant では省略を許す
 * (省略時は呼び出し側で直前の refresh_token を引き継ぐ)。欠けていれば API 構造変化の可能性として例外。
 */
function validateTokenResponse(
  body: unknown,
  opts: { requireRefreshToken: boolean },
): { access_token: string; expires_in: number; refresh_token?: string } {
  const rec = typeof body === "object" && body !== null
    ? (body as Record<string, unknown>)
    : undefined;
  const refreshTokenOk = opts.requireRefreshToken
    ? typeof rec?.refresh_token === "string"
    : rec?.refresh_token === undefined ||
      typeof rec?.refresh_token === "string";
  if (
    rec === undefined ||
    typeof rec.access_token !== "string" ||
    typeof rec.expires_in !== "number" ||
    !refreshTokenOk
  ) {
    throw new Error(
      "/oauth/token のレスポンスに access_token・expires_in・refresh_token が揃っていない (API 構造変化の可能性)。値を捏造せず停止する。",
    );
  }
  return rec as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
}

/** 非 2xx レスポンスを検査し、HTTP ステータスと生ボディを含む例外を投げる。 */
async function ensureOk(res: Response): Promise<string> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`/oauth/token 取得失敗 (HTTP ${res.status}): ${text}`);
  }
  return text;
}

/** /oauth/token へ POST し、JSON としてパースした本文を返す (grant の種類によらず共通)。 */
async function postToken(
  grantParams: Record<string, string>,
  fetchFn: typeof fetch,
): Promise<unknown> {
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(grantParams),
  });
  const text = await ensureOk(res);
  return parseJson(text);
}

export type ExchangeCodeParams = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
};

/** 認可コードをアクセストークン・リフレッシュトークンに交換する (/oauth/auth から 10 分以内)。 */
export async function exchangeCode(
  params: ExchangeCodeParams,
  fetchFn: typeof fetch = fetch,
): Promise<TokenResponse> {
  const body = await postToken({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
    code: params.code,
  }, fetchFn);
  const raw = validateTokenResponse(body, { requireRefreshToken: true });
  return {
    access_token: raw.access_token,
    expires_in: raw.expires_in,
    // requireRefreshToken: true により refresh_token は必ず string。
    refresh_token: raw.refresh_token as string,
  };
}

export type RefreshTokenParams = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
};

/**
 * リフレッシュトークンでアクセストークンを更新する。
 * レスポンスに refresh_token が含まれない場合は、渡した refreshToken (直前の値) を引き継ぐ。
 */
export async function refreshToken(
  params: RefreshTokenParams,
  fetchFn: typeof fetch = fetch,
): Promise<TokenResponse> {
  const body = await postToken({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  }, fetchFn);
  const raw = validateTokenResponse(body, { requireRefreshToken: false });
  return {
    access_token: raw.access_token,
    expires_in: raw.expires_in,
    refresh_token: raw.refresh_token ?? params.refreshToken,
  };
}
