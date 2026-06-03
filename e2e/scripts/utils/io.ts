/**
 * utils/io.ts
 * 共通 I/O ユーティリティ
 */

import * as path from "@std/path";

/**
 * ファイルまたは stdin からテキストを読み込む
 */
export async function readFile(filePath: string | undefined): Promise<string> {
  if (filePath) {
    return await Deno.readTextFile(filePath);
  }
  // stdin
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  for await (const chunk of Deno.stdin.readable) {
    chunks.push(chunk);
  }
  return decoder.decode(
    chunks.reduce((acc, c) => {
      const merged = new Uint8Array(acc.length + c.length);
      merged.set(acc);
      merged.set(c, acc.length);
      return merged;
    }, new Uint8Array(0)),
  );
}

/**
 * ファイルまたは stdout にテキストを書き込む
 */
export async function writeOutput(
  filePath: string | undefined,
  content: string,
): Promise<void> {
  if (filePath) {
    await Deno.writeTextFile(filePath, content);
  } else {
    await Deno.stdout.write(new TextEncoder().encode(content));
  }
}

/**
 * import.meta.url を基準にした相対パスを絶対パスに解決する
 */
export function resolvePath(importMetaUrl: string, relative: string): string {
  const dir = path.dirname(path.fromFileUrl(importMetaUrl));
  return path.join(dir, relative);
}
