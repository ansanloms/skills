/**
 * types/validation-error.ts
 * Structured validation error with per-issue path and message.
 */

export interface ValidationIssue {
  /** JSON Pointer path to the invalid field. Use "/" for root-level errors. */
  path: string;
  /** Human-readable error message in English. */
  message: string;
}

export class ValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    const detail = issues.map((i) => `  ${i.path}: ${i.message}`).join("\n");
    super(`Validation failed:\n${detail}`);
    this.name = "ValidationError";
    this.issues = issues;
  }
}
