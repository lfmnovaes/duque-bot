import type { Message } from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { getConvexClient } from "../services/convex.js";

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
        await channel.send(resolved.response);
      }
    }
  } catch (error) {
    console.error(
      `[trigger] Error handling trigger in channel ${message.channelId}:`,
      error,
    );
  }
}
