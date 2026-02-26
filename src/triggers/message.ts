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
    const config = await convex.query(api.channelConfig.getConfig, {
      channelId: message.channelId,
    });
    const triggerPrefix = config?.triggerPrefix ?? "!";
    if (!message.content.startsWith(triggerPrefix)) return;

    const trigger = message.content
      .slice(triggerPrefix.length)
      .split(/\s/)[0]
      .toLowerCase()
      .trim();

    if (!trigger) return;

    const command = await convex.query(api.commands.getCommand, {
      channelId: message.channelId,
      trigger,
    });

    if (command) {
      const channel = message.channel;
      if ("send" in channel && typeof channel.send === "function") {
        await channel.send(command.currentResponse);
      }
    }
  } catch (error) {
    console.error(
      `[trigger] Error handling trigger in channel ${message.channelId}:`,
      error,
    );
  }
}
