/**
 * トークンファイル (access_token・refresh_token・expires_in・obtained_at) の読み書きと期限判定。
 */
import { dirname } from "@std/path";
import type { TokenResponse } from "./oauth.ts";

export type StoredToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  /** トークンを取得した時刻 (ISO 8601, UTC)。 */
  obtained_at: string;
};

/** トークンファイルを読む。無い・壊れている場合は例外。 */
export async function readTokenFile(path: string): Promise<StoredToken> {
  let text: string;
  try {
    text = await Deno.readTextFile(path);
  } catch (e) {
    throw new Error(
      `トークンファイル (${path}) が読めない。先に token コマンドで取得する (親ディレクトリ ${
        dirname(path)
      } が無い場合は事前に作成しておく): ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`トークンファイル (${path}) が JSON として解釈できない`);
  }
  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).access_token !== "string" ||
    typeof (body as Record<string, unknown>).refresh_token !== "string" ||
    typeof (body as Record<string, unknown>).expires_in !== "number" ||
    typeof (body as Record<string, unknown>).obtained_at !== "string"
  ) {
    throw new Error(
      `トークンファイル (${path}) に必要なフィールドが揃っていない`,
    );
  }
  return body as StoredToken;
}

/**
 * トークンファイルを書く (パーミッション 0o600)。
 * 親ディレクトリは事前に存在している必要がある (作成はしない。deno task の --allow-write はファイル自身のパスにしか
 * 及ばず、親ディレクトリの mkdir はパーミッションエラーになるため)。
 */
export async function writeTokenFile(
  path: string,
  token: StoredToken,
): Promise<void> {
  try {
    await Deno.writeTextFile(path, JSON.stringify(token, null, 2) + "\n", {
      mode: 0o600,
    });
    // writeTextFile の mode はファイル新規作成時にしか反映されないため、既存ファイルの場合に備えて明示的に揃える。
    await Deno.chmod(path, 0o600);
  } catch (e) {
    throw new Error(
      `トークンファイル (${path}) が書けない。親ディレクトリ (${
        dirname(path)
      }) が無い場合は事前に作成しておく: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }
}

/**
 * obtained_at + expires_in (秒) - marginSeconds を過ぎていれば期限切れとみなす。
 * obtained_at が日時として解釈できない、または expires_in が有限数でない場合も期限切れとみなす
 * (NaN 同士の比較は常に false になり、期限切れを検出できなくなるため)。
 */
export function isExpired(
  token: StoredToken,
  now: Date = new Date(),
  marginSeconds = 60,
): boolean {
  const obtainedAt = new Date(token.obtained_at).getTime();
  if (!Number.isFinite(obtainedAt) || !Number.isFinite(token.expires_in)) {
    return true;
  }
  const expiresAt = obtainedAt + token.expires_in * 1000 - marginSeconds * 1000;
  return now.getTime() >= expiresAt;
}

/**
 * /oauth/token のレスポンスから StoredToken を組み立てる。token・status 両 CLI で共通に使う。
 * resp.refresh_token は TokenResponse 上必須で、refreshToken() が直前の値を引き継ぐためフォールバックは不要。
 */
export function toStoredToken(
  resp: TokenResponse,
  now: Date,
): StoredToken {
  return {
    access_token: resp.access_token,
    refresh_token: resp.refresh_token,
    expires_in: resp.expires_in,
    obtained_at: now.toISOString(),
  };
}
