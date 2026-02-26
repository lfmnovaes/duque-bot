import { ConvexHttpClient } from "convex/browser";
import { env } from "../config/env.js";

let client: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient {
  if (!client) {
    client = new ConvexHttpClient(env.CONVEX_URL);
  }
  return client;
}

export async function mutationWithLog<TResult>(
  operation: string,
  details: Record<string, unknown>,
  run: () => Promise<TResult>,
): Promise<TResult> {
  const startedAt = Date.now();
  console.log(`[db:mutation:start] ${operation}`, details);
  try {
    const result = await run();
    console.log(`[db:mutation:ok] ${operation}`, {
      ...details,
      durationMs: Date.now() - startedAt,
      result,
    });
    return result;
  } catch (error) {
    console.error(`[db:mutation:error] ${operation}`, {
      ...details,
      durationMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }
}
