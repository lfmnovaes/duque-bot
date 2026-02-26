import "dotenv/config";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;

  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  throw new Error(
    `Invalid boolean environment variable ${name}: ${raw}. Use true/false.`,
  );
}

export const env = {
  DISCORD_TOKEN: requireEnv("DISCORD_TOKEN"),
  DISCORD_CLIENT_ID: requireEnv("DISCORD_CLIENT_ID"),
  CONVEX_URL: requireEnv("CONVEX_URL"),
  BOT_OWNER_ID: requireEnv("BOT_OWNER_ID"),
  ENABLE_MESSAGE_CONTENT_INTENT: envFlag(
    "ENABLE_MESSAGE_CONTENT_INTENT",
    false,
  ),
} as const;
