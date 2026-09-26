/**
 * トークンの期限管理 (ローカル時刻判定 + 401 時の 1 回リトライ) を含めた /status/{kind}.json 取得。
 * status コマンドから使う。ネットワーク非依存にするため fetch は注入できる。
 */
import type { TokenConfig } from "./config.ts";
import { refreshToken } from "./oauth.ts";
import {
  isExpired,
  readTokenFile,
  type StoredToken,
  toStoredToken,
  writeTokenFile,
} from "./token-file.ts";
import { fetchStatus, type FetchStatusParams, HttpError } from "./status.ts";

export type FetchStatusWithAuthParams =
  & Omit<FetchStatusParams, "accessToken">
  & {
    config: TokenConfig;
  };

/** refresh_token でアクセストークンを更新し、トークンファイルへ書き戻す。 */
async function refreshAndSave(
  config: TokenConfig,
  token: StoredToken,
  fetchFn: typeof fetch,
): Promise<StoredToken> {
  const refreshed = await refreshToken(
    {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      refreshToken: token.refresh_token,
    },
    fetchFn,
  );
  const next = toStoredToken(refreshed, new Date());
  await writeTokenFile(config.tokenPath, next);
  return next;
}

/**
 * /status/{kind}.json を取得する。
 * 期限判定はローカル時刻 (obtained_at + expires_in - マージン を過ぎているか) で行い、期限切れなら取得前に
 * refresh する。加えて、リクエストが 401 を返した場合は refresh_token で 1 回だけ更新して再試行する。
 * 再試行後も失敗すればそのまま例外を投げる。401 以外のステータスはリトライしない。
 */
export async function fetchStatusWithAuth(
  params: FetchStatusWithAuthParams,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const { config, ...statusParams } = params;
  let token = await readTokenFile(config.tokenPath);

  if (isExpired(token)) {
    token = await refreshAndSave(config, token, fetchFn);
  }

  try {
    return await fetchStatus(
      { ...statusParams, accessToken: token.access_token },
      fetchFn,
    );
  } catch (e) {
    if (!(e instanceof HttpError) || e.status !== 401) {
      throw e;
    }
    token = await refreshAndSave(config, token, fetchFn);
    return await fetchStatus(
      { ...statusParams, accessToken: token.access_token },
      fetchFn,
    );
  }
}
