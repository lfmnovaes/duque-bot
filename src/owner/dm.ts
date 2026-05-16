import {
  ChannelType,
  escapeMarkdown,
  type Message,
  OAuth2Scopes,
  PermissionFlagsBits,
} from "discord.js";
import { api } from "../../convex/_generated/api.js";
import { detectDependencyVersion } from "../config/dependencies.js";
import { APP_VERSION } from "../config/version.js";
import { getConvexClient, mutationWithLog } from "../services/convex.js";
import { DISCORD_MESSAGE_LIMIT, splitMessage } from "../services/message.js";

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
    case "invite":
      await handleInvite(message);
      break;
    case "status":
      await handleStatus(message);
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
    lines.push(`\n🏠 **${escapeMarkdown(guild.name)}** (\`${guild.id}\`)`);
    lines.push(`   Members: ${guild.memberCount}`);

    // List text channels the bot can see
    const textChannels = guild.channels.cache.filter(
      (ch) =>
        ch.type === ChannelType.GuildText ||
        ch.type === ChannelType.GuildAnnouncement,
    );

    if (textChannels.size > 0) {
      const channelList = textChannels
        .map((ch) => `   • #${escapeMarkdown(ch.name)} (\`${ch.id}\`)`)
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

    const blacklistStatus = result.alreadyBlacklisted
      ? "It was already blacklisted."
      : "It has also been blacklisted for future joins.";
    await message.reply(
      `✅ Force-left server **${escapeMarkdown(guildName)}** (\`${guildId}\`). ${blacklistStatus}`,
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

async function handleStatus(message: Message): Promise<void> {
  const memory = process.memoryUsage();
  const resourceUsage = process.resourceUsage();
  const constrainedMemory = process.constrainedMemory?.();
  const availableMemory = process.availableMemory?.();

  const lines = [
    "🩺 **Bot Status**",
    "",
    `Version: \`${APP_VERSION}\``,
    `Node: \`${process.version}\``,
    `discord.js: \`${detectDependencyVersion("discord.js")}\``,
    `Convex: \`${detectDependencyVersion("convex")}\``,
    `Uptime: \`${formatDuration(process.uptime())}\``,
    `Guilds: \`${message.client.guilds.cache.size}\``,
    `WebSocket ping: \`${message.client.ws.ping}ms\``,
    "Message content intent: `enabled`",
    "",
    "**Memory**",
    `RSS: \`${formatBytes(memory.rss)}\``,
    `Heap: \`${formatBytes(memory.heapUsed)} / ${formatBytes(memory.heapTotal)}\``,
    `External: \`${formatBytes(memory.external)}\``,
    `Array buffers: \`${formatBytes(memory.arrayBuffers)}\``,
    `Available: \`${formatOptionalBytes(availableMemory)}\``,
    `Constrained: \`${formatOptionalBytes(constrainedMemory)}\``,
    "",
    "**Resource usage**",
    `User CPU: \`${formatMicroseconds(resourceUsage.userCPUTime)}\``,
    `System CPU: \`${formatMicroseconds(resourceUsage.systemCPUTime)}\``,
    `Max RSS: \`${formatKilobytes(resourceUsage.maxRSS)}\``,
  ];

  const chunks = splitMessage(lines.join("\n"), DISCORD_MESSAGE_LIMIT);
  for (const chunk of chunks) {
    await message.reply(chunk);
  }
}

async function handleHelp(message: Message): Promise<void> {
  await message.reply(
    `📖 **Owner Commands:**\n\n` +
      `\`!owner servers\` – List all servers and channels\n` +
      `\`!owner force-leave-server <guildId>\` – Force leave a server now\n` +
      `\`!owner leave-server <guildId>\` – Alias for force-leave-server\n` +
      `\`!owner blacklist-server <guildId>\` – Block future joins for a server\n` +
      `\`!owner unblacklist-server <guildId>\` – Allow future joins again\n` +
      `\`!owner invite\` – Generate bot invite link\n` +
      `\`!owner status\` – Show runtime diagnostics\n` +
      `\`!owner approve <guildId>\` – Alias for unblacklist-server\n` +
      `\`!owner help\` – Show this message`,
  );
}

function formatBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatOptionalBytes(bytes: number | undefined): string {
  if (bytes === undefined || bytes === 0) return "unavailable";
  return formatBytes(bytes);
}

function formatKilobytes(kilobytes: number): string {
  return formatBytes(kilobytes * 1024);
}

function formatMicroseconds(microseconds: number): string {
  return `${(microseconds / 1000).toFixed(1)}ms`;
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || parts.length > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length > 0) parts.push(`${minutes}m`);
  parts.push(`${remainingSeconds}s`);

  return parts.join(" ");
}
