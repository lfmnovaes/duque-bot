import { SlashCommandBuilder } from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { getConvexClient } from "../services/convex.js";
import type { SlashCommand } from "../types/index.js";

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

    if (sendViaDM) {
      try {
        const dmChannel = await interaction.user.createDM();
        await dmChannel.send(message);
        await interaction.reply({
          content: "✅ Command list sent to your DMs.",
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
        content: message,
        flags: ["Ephemeral"],
      });
    }
  },
};
