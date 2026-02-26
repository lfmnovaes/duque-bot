import { type GuildMember, PermissionFlagsBits } from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { env } from "../config/env.js";
import { getConvexClient } from "./convex.js";

/**
 * Check if a member has admin-level permissions (hard bypass).
 * Admins: server owner, users with Administrator permission, bot owner.
 */
export function isAdmin(member: GuildMember | null, userId: string): boolean {
  // Bot owner always bypasses
  if (userId === env.BOT_OWNER_ID) return true;

  if (!member) return false;

  // Guild owner
  if (member.id === member.guild.ownerId) return true;

  // Discord Administrator permission
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  return false;
}

/**
 * Check if a user can manage commands in a channel.
 * Admins always bypass. Non-admins need an editor role for the channel.
 */
export async function canManageCommands(
  member: GuildMember | null,
  userId: string,
  channelId: string,
): Promise<boolean> {
  // Admins always bypass
  if (isAdmin(member, userId)) return true;

  if (!member) return false;

  // Check editor roles from channel config
  const convex = getConvexClient();
  const config = await convex.query(api.channelConfig.getConfig, { channelId });

  if (!config || config.editorRoleIds.length === 0) return false;

  // Check if user has any of the editor roles
  return config.editorRoleIds.some((roleId: string) =>
    member.roles.cache.has(roleId),
  );
}
