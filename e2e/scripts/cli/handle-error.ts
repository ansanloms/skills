/**
 * cli/handle-error.ts
 * CLI 共通エラーハンドラー
 */

import { ValidationError } from "../types/validation-error.ts";

/**
 * エラーを stderr に出力して process を終了する。
 * - ValidationError（データ不正・スキーマ違反）: issues を整形して exit 1
 * - AggregateError（gunshi の引数バリデーション）: 各エラーを整形して exit 2（usage error）
 * - その他: メッセージのみ exit 1
 */
export function handleError(e: unknown): never {
  if (e instanceof ValidationError) {
    console.error("Validation failed:");
    for (const issue of e.issues) {
      console.error(`  ${issue.path}: ${issue.message}`);
    }
    Deno.exit(1);
  }
  if (e instanceof AggregateError) {
    console.error("Invalid arguments:");
    for (const sub of e.errors) {
      console.error(`  ${sub instanceof Error ? sub.message : String(sub)}`);
    }
    Deno.exit(2);
  }
  console.error(e instanceof Error ? e.message : String(e));
  Deno.exit(1);
}
