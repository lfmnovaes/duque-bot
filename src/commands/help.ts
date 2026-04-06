import { SlashCommandBuilder } from "discord.js";
import { DISCORD_MESSAGE_LIMIT, splitMessage } from "../services/message.js";
import type { SlashCommand } from "../types/index.js";

export const helpCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show all supported bot commands")
    .addBooleanOption((opt) =>
      opt
        .setName("dm")
        .setDescription("Send help via DM instead")
        .setRequired(false),
    ),

  async execute(interaction) {
    const sendViaDM = interaction.options.getBoolean("dm") ?? false;
    const message =
      "📘 **Supported bot commands**\n\n" +
      "• `/command add|edit|remove` - Create, update, or delete custom commands for this channel.\n" +
      "• `/command info` - View details about a trigger (response, character count, who created/edited and when).\n" +
      "• `/commands` - List custom commands from this channel with metadata (who created/updated and when).\n" +
      "• `/roles add|remove|list` - Manage editor roles for command management in this channel (admin only).\n" +
      "• `/trigger` - Set the one-character trigger prefix for this channel (admin only).\n" +
      "• `/help` - Show this command reference.\n\n" +
      "Tip: use the optional `dm` flag on `/help` and `/commands` to receive the output in DMs.";

    const chunks = splitMessage(message, DISCORD_MESSAGE_LIMIT);

    if (sendViaDM) {
      try {
        const dmChannel = await interaction.user.createDM();
        for (const chunk of chunks) {
          await dmChannel.send(chunk);
        }
        await interaction.reply({
          content:
            chunks.length === 1
              ? "✅ Help sent to your DMs."
              : `✅ Help sent to your DMs in ${chunks.length} messages.`,
          flags: ["Ephemeral"],
        });
      } catch {
        await interaction.reply({
          content:
            "❌ I couldn't send you a DM. Please check your DM privacy settings.",
          flags: ["Ephemeral"],
        });
      }
      return;
    }

    await interaction.reply({
      content: chunks[0],
      flags: ["Ephemeral"],
    });
    for (const chunk of chunks.slice(1)) {
      await interaction.followUp({
        content: chunk,
        flags: ["Ephemeral"],
      });
    }
  },
};
