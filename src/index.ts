import { client } from "./bot.js";
import { env } from "./config/env.js";
import { handleGuildCreate } from "./events/guildCreate.js";
import { handleInteractionCreate } from "./events/interactionCreate.js";
import { handleMessageCreate } from "./events/messageCreate.js";
import { handleReady } from "./events/ready.js";

// ─── Register Events ───
client.once("clientReady", handleReady);
client.on("interactionCreate", handleInteractionCreate);
client.on("guildCreate", handleGuildCreate);

if (env.ENABLE_MESSAGE_CONTENT_INTENT) {
  client.on("messageCreate", handleMessageCreate);
} else {
  console.warn(
    "[startup] Message Content intent disabled. !trigger and owner DM commands are off.",
  );
}

// ─── Error handling ───
client.on("error", (error) => {
  console.error("[client] Error:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("[process] Unhandled rejection:", error);
});

// ─── Graceful shutdown ───
function shutdown(): void {
  console.log("🛑 Shutting down...");
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// ─── Login ───
console.log("🚀 Starting Duque Bot...");
client.login(env.DISCORD_TOKEN).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Used disallowed intents")) {
    console.error(
      "[startup] Discord rejected privileged intents. Either enable Message Content Intent in the Discord Developer Portal, or set ENABLE_MESSAGE_CONTENT_INTENT=false in .env.",
    );
  }
  throw error;
});
