import type { Client } from "discord.js";
import { APP_VERSION } from "../config/version.js";

export function handleReady(client: Client<true>): void {
  console.log(`✅ Bot online as ${client.user.tag} (v${APP_VERSION})`);
  console.log(`📡 Serving ${client.guilds.cache.size} guild(s)`);
}
