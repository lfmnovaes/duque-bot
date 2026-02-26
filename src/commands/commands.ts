import { SlashCommandBuilder } from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { getConvexClient } from "../services/convex.js";
import type { SlashCommand } from "../types/index.js";

const DISCORD_MESSAGE_LIMIT = 2000;

export const commandsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("commands")
    .setDescription("List all custom commands in this channel")
    .addBooleanOption((opt) =>
      opt
        .setName("dm")
        .setDescription("Send the list via DM instead")
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "❌ This command can only be used in a server channel.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const convex = getConvexClient();
    const channelId = interaction.channelId;
    const sendViaDM = interaction.options.getBoolean("dm") ?? false;

    const [commands, config] = await Promise.all([
      convex.query(api.commands.listCommands, { channelId }),
      convex.query(api.channelConfig.getConfig, { channelId }),
    ]);
    const triggerPrefix = config?.triggerPrefix ?? "!";

    if (commands.length === 0) {
      await interaction.reply({
        content:
          "📭 No commands registered in this channel. Use `/command add` to create one.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const list = commands
      .map(
        (cmd: { trigger: string; currentResponse: string }) =>
          `• \`${triggerPrefix}${cmd.trigger}\` → ${cmd.currentResponse}`,
      )
      .join("\n");

    const message = `📋 **Commands in this channel** (${commands.length}):\n\n${list}`;
    const chunks = splitMessage(message, DISCORD_MESSAGE_LIMIT);

    if (sendViaDM) {
      try {
        const dmChannel = await interaction.user.createDM();
        for (const chunk of chunks) {
          await dmChannel.send(chunk);
        }
        console.log(
          `[commands] Sent command list for channel ${channelId} via DM in ${chunks.length} message(s)`,
        );
        await interaction.reply({
          content:
            chunks.length === 1
              ? "✅ Command list sent to your DMs."
              : `✅ Command list sent to your DMs in ${chunks.length} messages.`,
          flags: ["Ephemeral"],
        });
      } catch {
        await interaction.reply({
          content:
            "❌ I couldn't send you a DM. Please check your DM privacy settings.",
          flags: ["Ephemeral"],
        });
      }
    } else {
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
      if (chunks.length > 1) {
        console.log(
          `[commands] Split command list for channel ${channelId} into ${chunks.length} ephemeral messages`,
        );
      }
    }
  },
};

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let current = text;

  while (current.length > maxLength) {
    let splitIndex = current.lastIndexOf("\n", maxLength);
    if (splitIndex <= 0) {
      splitIndex = maxLength;
    }
    chunks.push(current.slice(0, splitIndex));
    current = current.slice(splitIndex).trimStart();
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}
