import type { Guild } from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { getConvexClient, mutationWithLog } from "../services/convex.js";

/**
 * Handle the bot being added to a new guild.
 * Guilds are auto-approved on join unless they are blacklisted.
 */
export async function handleGuildCreate(guild: Guild): Promise<void> {
  const convex = getConvexClient();

  try {
    const result = await mutationWithLog(
      "guilds.registerGuildJoin",
      {
        writeType: "insert_or_update",
        guildId: guild.id,
        guildName: guild.name,
      },
      () =>
        convex.mutation(api.guilds.registerGuildJoin, {
          guildId: guild.id,
          guildName: guild.name,
        }),
    );

    if (result.allowed) {
      console.log(
        `✅ Joined guild: ${guild.name} (${guild.id}) [${result.reason}]`,
      );
      return;
    }

    console.log(
      `⚠️ Joined blacklisted guild: ${guild.name} (${guild.id}). Leaving...`,
    );
    await guild.leave();
  } catch (error) {
    console.error(`[guildCreate] Error handling guild ${guild.id}:`, error);
  }
}
