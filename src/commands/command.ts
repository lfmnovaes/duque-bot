import { SlashCommandBuilder } from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { requireCommandPermission } from "../services/auth.js";
import { getConvexClient } from "../services/convex.js";
import type { SlashCommand } from "../types/index.js";

export const commandCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("command")
    .setDescription("Manage custom commands for this channel")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a new command to this channel")
        .addStringOption((opt) =>
          opt
            .setName("trigger")
            .setDescription("The trigger word (without the prefix)")
            .setRequired(true)
            .setMaxLength(50),
        )
        .addStringOption((opt) =>
          opt
            .setName("response")
            .setDescription("The response the bot will send")
            .setRequired(true)
            .setMaxLength(2000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("edit")
        .setDescription("Edit an existing command in this channel")
        .addStringOption((opt) =>
          opt
            .setName("trigger")
            .setDescription("The trigger word to edit")
            .setRequired(true)
            .setMaxLength(50),
        )
        .addStringOption((opt) =>
          opt
            .setName("response")
            .setDescription("The new response")
            .setRequired(true)
            .setMaxLength(2000),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a command from this channel")
        .addStringOption((opt) =>
          opt
            .setName("trigger")
            .setDescription("The trigger word to remove")
            .setRequired(true)
            .setMaxLength(50),
        ),
    ),

  async execute(interaction) {
    const allowed = await requireCommandPermission(interaction);
    if (!allowed) return;

    const subcommand = interaction.options.getSubcommand();
    const convex = getConvexClient();
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const config = await convex.query(api.channelConfig.getConfig, {
      channelId,
    });
    const triggerPrefix = config?.triggerPrefix ?? "!";

    switch (subcommand) {
      case "add": {
        const trigger = interaction.options
          .getString("trigger", true)
          .toLowerCase()
          .trim();
        const response = interaction.options.getString("response", true);

        const result = await convex.mutation(api.commands.addCommand, {
          channelId,
          trigger,
          response,
          actorUserId: userId,
        });

        if (!result.success) {
          await interaction.reply({
            content: `⚠️ The command \`${triggerPrefix}${trigger}\` already exists in this channel. Use \`/command edit ${trigger} <new_response>\` to update it.`,
            flags: ["Ephemeral"],
          });
          return;
        }

        await interaction.reply({
          content: `✅ Command \`${triggerPrefix}${trigger}\` has been added to this channel.`,
          flags: ["Ephemeral"],
        });
        break;
      }

      case "edit": {
        const trigger = interaction.options
          .getString("trigger", true)
          .toLowerCase()
          .trim();
        const response = interaction.options.getString("response", true);

        const result = await convex.mutation(api.commands.editCommand, {
          channelId,
          trigger,
          newResponse: response,
          actorUserId: userId,
        });

        if (!result.success) {
          await interaction.reply({
            content: `❌ The command \`${triggerPrefix}${trigger}\` does not exist in this channel. Use \`/command add\` to create it first.`,
            flags: ["Ephemeral"],
          });
          return;
        }

        await interaction.reply({
          content: `✅ Command \`${triggerPrefix}${trigger}\` has been updated.`,
          flags: ["Ephemeral"],
        });
        break;
      }

      case "remove": {
        const trigger = interaction.options
          .getString("trigger", true)
          .toLowerCase()
          .trim();

        const result = await convex.mutation(api.commands.removeCommand, {
          channelId,
          trigger,
          actorUserId: userId,
        });

        if (!result.success) {
          await interaction.reply({
            content: `❌ The command \`${triggerPrefix}${trigger}\` does not exist in this channel.`,
            flags: ["Ephemeral"],
          });
          return;
        }

        await interaction.reply({
          content: `✅ Command \`${triggerPrefix}${trigger}\` has been removed from this channel.`,
          flags: ["Ephemeral"],
        });
        break;
      }
    }
  },
};
