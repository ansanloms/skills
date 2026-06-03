/**
 * utils/json.ts
 * JSON 文字列 ↔ Spec / Macros 型の相互変換
 */

import { Ajv, type ErrorObject } from "ajv";
import { type Spec } from "../types/spec.ts";
import { type Macros } from "../types/macros.ts";
import { ValidationError } from "../types/validation-error.ts";
import specSchemaJson from "../schemas/spec.schema.json" with { type: "json" };
import macrosSchemaJson from "../schemas/macros.schema.json" with {
  type: "json",
};

// AJV v8 は Draft 2020-12 のメタスキーマを自動解決しないため $schema を除去する
const { $schema: _specSchema, ...specSchema } = specSchemaJson;
const { $schema: _macrosSchema, ...macrosSchema } = macrosSchemaJson;
const ajv = new Ajv({ strict: false });
const validate = ajv.compile<Spec>(specSchema);
const validateMacros = ajv.compile<Macros>(macrosSchema);

/**
 * JSON 文字列をパースし、spec.schema.json で検証した上で Spec 型として返す。
 * 構文エラー・スキーマ違反ともに ValidationError を throw する。
 * 入力に "$schema" フィールドが含まれる場合は検証前に除去する。
 */
export function parseSpecJson(jsonText: string): Spec {
  let obj: unknown;
  try {
    obj = JSON.parse(jsonText);
  } catch (e) {
    throw new ValidationError([
      {
        path: "/",
        message: `invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      },
    ]);
  }

  // "$schema" はエディタ用のメタ情報だが additionalProperties: false のスキーマに反するため除去する
  if (typeof obj === "object" && obj !== null && "$schema" in obj) {
    const { $schema: _$schema, ...rest } = obj as Record<string, unknown>;
    obj = rest;
  }

  if (!validate(obj)) {
    throw new ValidationError(
      (validate.errors ?? []).map((e: ErrorObject) => ({
        path: e.instancePath || "/",
        message: e.message ?? "unknown error",
      })),
    );
  }

  return obj;
}

/**
 * JSON 文字列をパースし、macros.schema.json で検証した上で Macros 型として返す。
 * 構文エラー・スキーマ違反ともに ValidationError を throw する。
 */
export function parseMacrosJson(jsonText: string): Macros {
  let obj: unknown;
  try {
    obj = JSON.parse(jsonText);
  } catch (e) {
    throw new ValidationError([
      {
        path: "/",
        message: `invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      },
    ]);
  }

  // "$schema" はエディタ用のメタ情報だが additionalProperties バリデーションに反するため除去する
  if (typeof obj === "object" && obj !== null && "$schema" in obj) {
    const { $schema: _$schema, ...rest } = obj as Record<string, unknown>;
    obj = rest;
  }

  if (!validateMacros(obj)) {
    throw new ValidationError(
      (validateMacros.errors ?? []).map((e: ErrorObject) => ({
        path: e.instancePath || "/",
        message: e.message ?? "unknown error",
      })),
    );
  }

  return obj;
}

/**
 * Spec 型を整形 JSON 文字列（末尾改行付き）に変換する。
 * schema を指定した場合は "$schema" フィールドを先頭に出力する。
 */
export function toSpecJson(spec: Spec, schema?: string): string {
  const obj = schema !== undefined ? { $schema: schema, ...spec } : spec;
  return JSON.stringify(obj, null, 2) + "\n";
}
