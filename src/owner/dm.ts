import {
  ChannelType,
  type Message,
  OAuth2Scopes,
  PermissionFlagsBits,
} from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { env } from "../config/env.js";
import { getConvexClient, mutationWithLog } from "../services/convex.js";

const OWNER_PREFIX = "!owner";

/**
 * Handle DM messages from the bot owner.
 */
export async function handleOwnerDM(message: Message): Promise<void> {
  if (!message.content.startsWith(OWNER_PREFIX)) return;

  const args = message.content.slice(OWNER_PREFIX.length).trim().split(/\s+/);
  const subcommand = args[0]?.toLowerCase();

  switch (subcommand) {
    case "servers":
      await handleServers(message);
      break;
    case "force-leave-server":
    case "leave-server":
      await handleForceLeaveServer(message, args[1]);
      break;
    case "blacklist-server":
      await handleBlacklistServer(message, args[1]);
      break;
    case "unblacklist-server":
      await handleUnblacklistServer(message, args[1]);
      break;
    case "leave-channel":
      await handleLeaveChannel(message, args[1]);
      break;
    case "invite":
      await handleInvite(message);
      break;
    case "approve":
      await handleUnblacklistServer(message, args[1], "approve");
      break;
    case "help":
      await handleHelp(message);
      break;
    default:
      await message.reply(
        "❓ Unknown owner command. Use `!owner help` for a list of commands.",
      );
  }
}

async function handleServers(message: Message): Promise<void> {
  const guilds = message.client.guilds.cache;

  if (guilds.size === 0) {
    await message.reply("📭 I'm not in any servers.");
    return;
  }

  const lines: string[] = [];

  for (const guild of guilds.values()) {
    lines.push(`\n🏠 **${guild.name}** (\`${guild.id}\`)`);
    lines.push(`   Members: ${guild.memberCount}`);

    // List text channels the bot can see
    const textChannels = guild.channels.cache.filter(
      (ch) =>
        ch.type === ChannelType.GuildText ||
        ch.type === ChannelType.GuildAnnouncement,
    );

    if (textChannels.size > 0) {
      const channelList = textChannels
        .map((ch) => `   • #${ch.name} (\`${ch.id}\`)`)
        .join("\n");
      lines.push(channelList);
    }
  }

  const response = `📡 **Servers** (${guilds.size}):\n${lines.join("\n")}`;

  // Split long messages if necessary (Discord 2000 char limit)
  if (response.length > 2000) {
    const chunks = splitMessage(response, 2000);
    for (const chunk of chunks) {
      await message.reply(chunk);
    }
  } else {
    await message.reply(response);
  }
}

async function handleForceLeaveServer(
  message: Message,
  guildId: string | undefined,
): Promise<void> {
  if (!guildId) {
    await message.reply("❌ Usage: `!owner force-leave-server <guildId>`");
    return;
  }

  const guild = message.client.guilds.cache.get(guildId);

  if (!guild) {
    await message.reply(`❌ I'm not in a server with ID \`${guildId}\`.`);
    return;
  }

  const guildName = guild.name;

  try {
    await guild.leave();
    await message.reply(
      `✅ Force-left server **${guildName}** (\`${guildId}\`).`,
    );
  } catch (error) {
    console.error("[owner] Error force-leaving server:", error);
    await message.reply(`❌ Failed to force-leave server \`${guildId}\`.`);
  }
}

async function handleBlacklistServer(
  message: Message,
  guildId: string | undefined,
): Promise<void> {
  if (!guildId) {
    await message.reply("❌ Usage: `!owner blacklist-server <guildId>`");
    return;
  }

  try {
    const guild = message.client.guilds.cache.get(guildId);
    const guildName = guild?.name ?? `Guild ${guildId}`;

    const convex = getConvexClient();
    const result = await mutationWithLog(
      "guilds.blacklistGuild",
      {
        writeType: "insert_or_update",
        guildId,
        guildName,
      },
      () =>
        convex.mutation(api.guilds.blacklistGuild, {
          guildId,
          guildName,
        }),
    );

    if (result.alreadyBlacklisted) {
      await message.reply(`⚠️ Server \`${guildId}\` is already blacklisted.`);
      return;
    }

    await message.reply(
      `✅ Server \`${guildId}\` blacklisted for future joins. If already joined, the bot stays until force-left.`,
    );
  } catch (error) {
    console.error("[owner] Error blacklisting server:", error);
    await message.reply(`❌ Failed to blacklist server \`${guildId}\`.`);
  }
}

async function handleUnblacklistServer(
  message: Message,
  guildId: string | undefined,
  usageCommand = "unblacklist-server",
): Promise<void> {
  if (!guildId) {
    await message.reply(`❌ Usage: \`!owner ${usageCommand} <guildId>\``);
    return;
  }

  try {
    const convex = getConvexClient();
    const result = await mutationWithLog(
      "guilds.unblacklistGuild",
      {
        writeType: "update",
        guildId,
      },
      () =>
        convex.mutation(api.guilds.unblacklistGuild, {
          guildId,
        }),
    );

    if (!result.success) {
      const reason =
        result.reason === "not_found"
          ? "No guild record found."
          : "Guild is not blacklisted.";
      await message.reply(`⚠️ ${reason}`);
      return;
    }

    await message.reply(`✅ Server \`${guildId}\` has been unblacklisted.`);
  } catch (error) {
    console.error("[owner] Error unblacklisting server:", error);
    await message.reply(`❌ Failed to unblacklist server \`${guildId}\`.`);
  }
}

async function handleLeaveChannel(
  message: Message,
  channelId: string | undefined,
): Promise<void> {
  if (!channelId) {
    await message.reply("❌ Usage: `!owner leave-channel <channelId>`");
    return;
  }

  try {
    const convex = getConvexClient();

    // Remove commands in batches to avoid large single-mutation workloads.
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await mutationWithLog(
        "commands.removeAllByChannel",
        {
          writeType: "batch_delete",
          channelId,
          actorUserId: env.BOT_OWNER_ID,
        },
        () =>
          convex.mutation(api.commands.removeAllByChannel, {
            channelId,
            actorUserId: env.BOT_OWNER_ID,
          }),
      );
      totalDeleted += batch.deleted;
      hasMore = batch.hasMore;
    }

    // Remove channel config after commands are cleaned.
    await mutationWithLog(
      "channelConfig.deleteConfig",
      {
        writeType: "delete",
        channelId,
      },
      () =>
        convex.mutation(api.channelConfig.deleteConfig, {
          channelId,
        }),
    );

    await message.reply(
      `✅ Cleared channel \`${channelId}\`: removed config and ${totalDeleted} command(s).`,
    );
  } catch (error) {
    console.error("[owner] Error clearing channel:", error);
    await message.reply(`❌ Failed to clear channel \`${channelId}\`.`);
  }
}

async function handleInvite(message: Message): Promise<void> {
  const invite = message.client.generateInvite({
    scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
    permissions: [
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseApplicationCommands,
    ],
  });

  await message.reply(`🔗 **Bot Invite Link:**\n${invite}`);
}

async function handleHelp(message: Message): Promise<void> {
  await message.reply(
    `📖 **Owner Commands:**\n\n` +
      `\`!owner servers\` – List all servers and channels\n` +
      `\`!owner force-leave-server <guildId>\` – Force leave a server now\n` +
      `\`!owner leave-server <guildId>\` – Alias for force-leave-server\n` +
      `\`!owner blacklist-server <guildId>\` – Block future joins for a server\n` +
      `\`!owner unblacklist-server <guildId>\` – Allow future joins again\n` +
      `\`!owner leave-channel <channelId>\` – Clear a channel's config and commands\n` +
      `\`!owner invite\` – Generate bot invite link\n` +
      `\`!owner approve <guildId>\` – Alias for unblacklist-server\n` +
      `\`!owner help\` – Show this message`,
  );
}

function splitMessage(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let current = text;

  while (current.length > maxLength) {
    let splitIndex = current.lastIndexOf("\n", maxLength);
    if (splitIndex === -1) splitIndex = maxLength;
    chunks.push(current.slice(0, splitIndex));
    current = current.slice(splitIndex);
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}
