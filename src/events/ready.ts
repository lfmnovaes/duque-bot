import type { Client } from "discord.js";

export function handleReady(client: Client<true>): void {
  console.log(`✅ Bot online as ${client.user.tag}`);
  console.log(`📡 Serving ${client.guilds.cache.size} guild(s)`);
}
