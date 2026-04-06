import { SlashCommandBuilder } from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { requireCommandPermission } from "../services/auth.js";
import { getConvexClient, mutationWithLog } from "../services/convex.js";
import {
  DISCORD_MESSAGE_LIMIT,
  decodeLineBreaks,
  encodeLineBreaks,
} from "../services/message.js";
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
            .setMaxLength(4000),
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
            .setMaxLength(4000),
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
    )
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("View details about a trigger (only visible to you)")
        .addStringOption((opt) =>
          opt
            .setName("trigger")
            .setDescription("The trigger word to inspect")
            .setRequired(true)
            .setMaxLength(50),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    // info is read-only, no permission gate needed
    if (subcommand !== "info") {
      const allowed = await requireCommandPermission(interaction);
      if (!allowed) return;
    } else if (!interaction.inGuild()) {
      await interaction.reply({
        content: "❌ This command can only be used in a server channel.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const convex = getConvexClient();
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const guildId = interaction.guildId ?? undefined;
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
        const response = encodeLineBreaks(
          interaction.options.getString("response", true),
        );

        const result = await mutationWithLog(
          "commands.addCommand",
          {
            writeType: "insert",
            channelId,
            trigger,
            actorUserId: userId,
            responseLength: response.length,
          },
          () =>
            convex.mutation(api.commands.addCommand, {
              channelId,
              trigger,
              response,
              actorUserId: userId,
              guildId,
            }),
        );

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
        const response = encodeLineBreaks(
          interaction.options.getString("response", true),
        );

        const result = await mutationWithLog(
          "commands.editCommand",
          {
            writeType: "update",
            channelId,
            trigger,
            actorUserId: userId,
            newResponseLength: response.length,
          },
          () =>
            convex.mutation(api.commands.editCommand, {
              channelId,
              trigger,
              newResponse: response,
              actorUserId: userId,
              guildId,
            }),
        );

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

        const result = await mutationWithLog(
          "commands.removeCommand",
          {
            writeType: "delete",
            channelId,
            trigger,
            actorUserId: userId,
          },
          () =>
            convex.mutation(api.commands.removeCommand, {
              channelId,
              trigger,
              actorUserId: userId,
            }),
        );

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

      case "info": {
        const trigger = interaction.options
          .getString("trigger", true)
          .toLowerCase()
          .trim();

        const command = await convex.query(api.commands.getCommand, {
          channelId,
          trigger,
        });

        if (!command) {
          await interaction.reply({
            content: `❌ The trigger \`${triggerPrefix}${trigger}\` does not exist in this channel.`,
            flags: ["Ephemeral"],
          });
          return;
        }

        const rawResponse = decodeLineBreaks(command.currentResponse);
        const charCount = command.currentResponse.length;
        const createdUnix = Math.max(0, Math.floor(command.createdAt / 1000));
        const updatedUnix = Math.max(0, Math.floor(command.updatedAt / 1000));

        const header = `📄 **Trigger Info: \`${triggerPrefix}${trigger}\`**\n\n`;
        const footer =
          `\n**Characters:** ${charCount}/${DISCORD_MESSAGE_LIMIT}\n` +
          `**Created by:** <@${command.createdByUserId}> — <t:${createdUnix}:f>\n` +
          `**Last edited by:** <@${command.updatedByUserId}> — <t:${updatedUnix}:f>`;

        // Code block wrapping adds: "**Response (raw):**\n```\n" + "\n```"
        const codeBlockPrefix = "**Response (raw):**\n```\n";
        const codeBlockSuffix = "\n```";
        const overhead =
          header.length +
          codeBlockPrefix.length +
          codeBlockSuffix.length +
          footer.length;
        const maxRawLength = DISCORD_MESSAGE_LIMIT - overhead;

        let responseBlock: string;
        if (rawResponse.length <= maxRawLength) {
          responseBlock = `${codeBlockPrefix}${rawResponse}${codeBlockSuffix}`;
        } else {
          const truncationNote = "… (truncated)";
          const truncated = rawResponse.slice(
            0,
            maxRawLength - truncationNote.length,
          );
          responseBlock = `${codeBlockPrefix}${truncated}${truncationNote}${codeBlockSuffix}`;
        }

        const infoMessage = `${header}${responseBlock}${footer}`;

        await interaction.reply({
          content: infoMessage,
          flags: ["Ephemeral"],
        });
        break;
      }
    }
  },
};
