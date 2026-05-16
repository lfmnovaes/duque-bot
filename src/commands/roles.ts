import { MessageFlags, SlashCommandBuilder } from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { requireAdminPermission } from "../services/auth.js";
import { getConvexClient, mutationWithLog } from "../services/convex.js";
import type { SlashCommand } from "../types/index.js";

export const rolesCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("roles")
    .setDescription("Manage editor roles for this channel (Admins only)")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add an editor role for this channel (Admins only)")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("The role to add as editor")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove an editor role from this channel (Admins only)")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("The role to remove")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List editor roles for this channel (Admins only)"),
    ),

  async execute(interaction) {
    const allowed = await requireAdminPermission(interaction);
    if (!allowed) return;

    const subcommand = interaction.options.getSubcommand();
    const convex = getConvexClient();
    const channelId = interaction.channelId;
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: "❌ This command can only be used in a server channel.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    switch (subcommand) {
      case "add": {
        const role = interaction.options.getRole("role", true);

        const result = await mutationWithLog(
          "channelConfig.addEditorRole",
          {
            writeType: "insert_or_update",
            channelId,
            guildId,
            roleId: role.id,
          },
          () =>
            convex.mutation(api.channelConfig.addEditorRole, {
              channelId,
              guildId,
              roleId: role.id,
            }),
        );

        if (!result.success) {
          await interaction.reply({
            content: `⚠️ Role **${role.name}** is already an editor role for this channel.`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          content: `✅ Role **${role.name}** can now manage commands in this channel.`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "remove": {
        const role = interaction.options.getRole("role", true);

        const result = await mutationWithLog(
          "channelConfig.removeEditorRole",
          {
            writeType: "update",
            channelId,
            roleId: role.id,
          },
          () =>
            convex.mutation(api.channelConfig.removeEditorRole, {
              channelId,
              roleId: role.id,
            }),
        );

        if (!result.success) {
          const reason =
            result.reason === "no_config"
              ? "No editor roles are configured for this channel."
              : `Role **${role.name}** is not an editor role for this channel.`;
          await interaction.reply({
            content: `❌ ${reason}`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await interaction.reply({
          content: `✅ Role **${role.name}** can no longer manage commands in this channel.`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }

      case "list": {
        const config = await convex.query(api.channelConfig.getConfig, {
          channelId,
        });

        if (!config || config.editorRoleIds.length === 0) {
          await interaction.reply({
            content:
              "📭 No editor roles configured for this channel. Only admins can manage commands.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const roleList = config.editorRoleIds
          .map((id: string) => `• <@&${id}>`)
          .join("\n");

        await interaction.reply({
          content: `📋 **Editor roles for this channel:**\n\n${roleList}`,
          flags: MessageFlags.Ephemeral,
        });
        break;
      }
    }
  },
};
