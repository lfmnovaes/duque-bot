import type { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { canManageCommands, isAdmin } from "./permissions.js";

/**
 * Authorization guard for command management (add/edit/remove).
 * Returns true if authorized, false if denied (and sends ephemeral reply).
 */
export async function requireCommandPermission(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "❌ This command can only be used in a server channel.",
      flags: ["Ephemeral"],
    });
    return false;
  }

  const member = interaction.member as GuildMember;
  const userId = interaction.user.id;
  const channelId = interaction.channelId;

  const allowed = await canManageCommands(member, userId, channelId);

  if (!allowed) {
    await interaction.reply({
      content:
        "❌ You don't have permission to manage commands in this channel. Ask an admin to add your role with `/roles add`.",
      flags: ["Ephemeral"],
    });
    return false;
  }

  return true;
}

/**
 * Authorization guard for admin-only operations (role management).
 * Returns true if authorized, false if denied (and sends ephemeral reply).
 */
export async function requireAdminPermission(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "❌ This command can only be used in a server channel.",
      flags: ["Ephemeral"],
    });
    return false;
  }

  const member = interaction.member as GuildMember;
  const userId = interaction.user.id;

  if (!isAdmin(member, userId)) {
    await interaction.reply({
      content: "❌ Only server administrators can manage roles.",
      flags: ["Ephemeral"],
    });
    return false;
  }

  return true;
}
