import { SlashCommandBuilder } from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { requireAdminPermission } from "../services/auth.js";
import { getConvexClient, mutationWithLog } from "../services/convex.js";
import type { SlashCommand } from "../types/index.js";

const ALLOWED_TRIGGER_PREFIX = /^[!@#$%^&*()_+\-=[\]{}|;:,.?~]$/;
const ALLOWED_PREFIX_LIST = "! @ # $ % ^ & * ( ) _ + - = [ ] { } | ; : , . ? ~";

export const triggerCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("trigger")
    .setDescription("Set the trigger prefix for this channel (admin only)")
    .addStringOption((opt) =>
      opt
        .setName("prefix")
        .setDescription("One special character, e.g. ! or @")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(1),
    ),

  async execute(interaction) {
    const allowed = await requireAdminPermission(interaction);
    if (!allowed) return;

    const prefix = interaction.options.getString("prefix", true).trim();
    if (!ALLOWED_TRIGGER_PREFIX.test(prefix)) {
      await interaction.reply({
        content:
          `❌ Invalid prefix. Use exactly one special character from:\n` +
          `${ALLOWED_PREFIX_LIST}`,
        flags: ["Ephemeral"],
      });
      return;
    }

    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: "❌ This command can only be used in a server channel.",
        flags: ["Ephemeral"],
      });
      return;
    }

    const convex = getConvexClient();
    await mutationWithLog(
      "channelConfig.setTriggerPrefix",
      {
        writeType: "insert_or_update",
        channelId: interaction.channelId,
        guildId,
        triggerPrefix: prefix,
      },
      () =>
        convex.mutation(api.channelConfig.setTriggerPrefix, {
          channelId: interaction.channelId,
          guildId,
          triggerPrefix: prefix,
        }),
    );

    await interaction.reply({
      content:
        `✅ Trigger prefix set to \`${prefix}\` for this channel.\n` +
        `Example: \`${prefix}hello\``,
      flags: ["Ephemeral"],
    });
  },
};
