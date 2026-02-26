import type { Message } from "discord.js";
import { ChannelType } from "discord.js";
import { env } from "../config/env.js";
import { handleOwnerDM } from "../owner/dm.js";
import { handleTrigger } from "../triggers/message.js";

export async function handleMessageCreate(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  // Handle DMs from bot owner
  if (message.channel.type === ChannelType.DM) {
    if (message.author.id === env.BOT_OWNER_ID) {
      await handleOwnerDM(message);
    }
    return;
  }

  // Handle prefix-trigger messages in guild channels
  if (message.inGuild()) {
    await handleTrigger(message);
  }
}
