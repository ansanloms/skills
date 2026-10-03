/**
 * Health Planet API の /status/{kind}.json 取得。
 * レスポンスは加工せず生のテキストのまま返す (呼び出し側でそのまま出力する)。
 */

const BASE = "https://www.healthplanet.jp/status";

export type StatusKind = "innerscan" | "pedometer" | "sphygmomanometer";

export type FetchStatusParams = {
  accessToken: string;
  kind: StatusKind;
  /** 0 = 登録日、1 = 測定日。 */
  date: "0" | "1";
  from?: string;
  to?: string;
  tag?: string;
};

/** 非 2xx レスポンスを表す例外。HTTP ステータスと生ボディを保持する (401 判定によるリトライ用)。 */
export class HttpError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = body;
  }
}

/** 14 桁の yyyyMMddHHmmss 形式か検証する。不一致なら例外。 */
export function validateDateTime(value: string): void {
  if (!/^\d{14}$/.test(value)) {
    throw new Error(`日時は 14 桁の yyyyMMddHHmmss 形式で指定する: ${value}`);
  }
}

/** /status/{kind}.json を取得し、レスポンスボディをそのまま (整形せず) 返す。 */
export async function fetchStatus(
  params: FetchStatusParams,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const url = new URL(`${BASE}/${params.kind}.json`);
  url.searchParams.set("access_token", params.accessToken);
  url.searchParams.set("date", params.date);
  if (params.from !== undefined) {
    url.searchParams.set("from", params.from);
  }
  if (params.to !== undefined) {
    url.searchParams.set("to", params.to);
  }
  if (params.tag !== undefined) {
    url.searchParams.set("tag", params.tag);
  }

  const res = await fetchFn(url);
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError(
      res.status,
      text,
      `/status/${params.kind}.json 取得失敗 (HTTP ${res.status}): ${text}`,
    );
  }
  return text;
}
