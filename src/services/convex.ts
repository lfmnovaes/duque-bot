import { ConvexHttpClient } from "convex/browser";
import { env } from "../config/env.js";

let client: ConvexHttpClient | null = null;

export function getConvexClient(): ConvexHttpClient {
  if (!client) {
    client = new ConvexHttpClient(env.CONVEX_URL);
  }
  return client;
}
