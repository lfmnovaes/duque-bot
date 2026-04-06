import type { Message } from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { getConvexClient } from "../services/convex.js";
import { DISCORD_MESSAGE_LIMIT, splitMessage } from "../services/message.js";

/**
 * Handle a potential prefix-trigger message.
 * Looks up the trigger in the channel's custom commands and replies publicly.
 */
export async function handleTrigger(message: Message): Promise<void> {
  const convex = getConvexClient();

  try {
    const resolved = await convex.query(api.commands.resolveTriggerResponse, {
      channelId: message.channelId,
      content: message.content,
    });

    if (resolved) {
      const channel = message.channel;
      if ("send" in channel && typeof channel.send === "function") {
        const chunks = splitMessage(resolved.response, DISCORD_MESSAGE_LIMIT);
        for (const chunk of chunks) {
          await channel.send(chunk);
        }
      }
    }
  } catch (error) {
    console.error(
      `[trigger] Error handling trigger in channel ${message.channelId}:`,
      error,
    );
  }
}
