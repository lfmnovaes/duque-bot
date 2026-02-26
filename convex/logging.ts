type DbWriteOperation = "insert" | "patch" | "delete";

type DbWriteDetails = Record<string, unknown>;

/**
 * Centralized write log helper for Convex mutations.
 * Keep payloads compact to avoid noisy logs at scale.
 */
export function logDbWrite(
  table: string,
  operation: DbWriteOperation,
  details: DbWriteDetails,
): void {
  console.log(`[db:${table}] ${operation}`, details);
}
