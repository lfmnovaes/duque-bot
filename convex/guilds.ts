import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { logDbWrite } from "./logging.js";

export const isApproved = query({
  args: {
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const guild = await ctx.db
      .query("approvedGuilds")
      .withIndex("by_guild", (q) => q.eq("guildId", args.guildId))
      .unique();
    return guild !== null && guild.blacklistedAt === undefined;
  },
});

export const registerGuildJoin = mutation({
  args: {
    guildId: v.string(),
    guildName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("approvedGuilds")
      .withIndex("by_guild", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!existing) {
      const guildRecordId = await ctx.db.insert("approvedGuilds", {
        guildId: args.guildId,
        guildName: args.guildName,
      });
      logDbWrite("approvedGuilds", "insert", {
        guildRecordId,
        guildId: args.guildId,
        guildName: args.guildName,
        action: "registerGuildJoin",
      });
      return { allowed: true, reason: "auto_approved" } as const;
    }

    if (existing.guildName !== args.guildName) {
      await ctx.db.patch(existing._id, { guildName: args.guildName });
      logDbWrite("approvedGuilds", "patch", {
        guildRecordId: existing._id,
        guildId: args.guildId,
        action: "registerGuildJoin",
        previousGuildName: existing.guildName,
        guildName: args.guildName,
      });
    }

    if (existing.blacklistedAt !== undefined) {
      return { allowed: false, reason: "blacklisted" } as const;
    }

    return { allowed: true, reason: "already_approved" } as const;
  },
});

export const approveGuild = mutation({
  args: {
    guildId: v.string(),
    guildName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("approvedGuilds")
      .withIndex("by_guild", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (existing) {
      if (existing.blacklistedAt !== undefined) {
        await ctx.db.patch(existing._id, {
          guildName: args.guildName,
          blacklistedAt: undefined,
        });
        logDbWrite("approvedGuilds", "patch", {
          guildRecordId: existing._id,
          guildId: args.guildId,
          action: "approveGuild",
          guildName: args.guildName,
          blacklistedAt: undefined,
        });
        return { success: true, reason: "unblacklisted" } as const;
      }
      return { success: false, reason: "already_approved" } as const;
    }

    const guildRecordId = await ctx.db.insert("approvedGuilds", {
      guildId: args.guildId,
      guildName: args.guildName,
    });
    logDbWrite("approvedGuilds", "insert", {
      guildRecordId,
      guildId: args.guildId,
      guildName: args.guildName,
      action: "approveGuild",
    });

    return { success: true } as const;
  },
});

export const blacklistGuild = mutation({
  args: {
    guildId: v.string(),
    guildName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("approvedGuilds")
      .withIndex("by_guild", (q) => q.eq("guildId", args.guildId))
      .unique();

    const now = Date.now();
    const guildName = args.guildName ?? `Guild ${args.guildId}`;

    if (!existing) {
      const guildRecordId = await ctx.db.insert("approvedGuilds", {
        guildId: args.guildId,
        guildName,
        blacklistedAt: now,
      });
      logDbWrite("approvedGuilds", "insert", {
        guildRecordId,
        guildId: args.guildId,
        guildName,
        action: "blacklistGuild",
        blacklistedAt: now,
      });
      return {
        success: true,
        created: true,
        alreadyBlacklisted: false,
      } as const;
    }

    if (existing.blacklistedAt !== undefined) {
      return {
        success: true,
        created: false,
        alreadyBlacklisted: true,
      } as const;
    }

    await ctx.db.patch(existing._id, {
      guildName,
      blacklistedAt: now,
    });
    logDbWrite("approvedGuilds", "patch", {
      guildRecordId: existing._id,
      guildId: args.guildId,
      guildName,
      action: "blacklistGuild",
      blacklistedAt: now,
    });
    return {
      success: true,
      created: false,
      alreadyBlacklisted: false,
    } as const;
  },
});

export const unblacklistGuild = mutation({
  args: {
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("approvedGuilds")
      .withIndex("by_guild", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!existing) {
      return { success: false, reason: "not_found" } as const;
    }

    if (existing.blacklistedAt === undefined) {
      return { success: false, reason: "not_blacklisted" } as const;
    }

    await ctx.db.patch(existing._id, {
      blacklistedAt: undefined,
    });
    logDbWrite("approvedGuilds", "patch", {
      guildRecordId: existing._id,
      guildId: args.guildId,
      action: "unblacklistGuild",
      blacklistedAt: undefined,
    });
    return { success: true } as const;
  },
});

export const revokeGuild = mutation({
  args: {
    guildId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("approvedGuilds")
      .withIndex("by_guild", (q) => q.eq("guildId", args.guildId))
      .unique();

    if (!existing) {
      return { success: false, reason: "not_found" } as const;
    }

    await ctx.db.delete(existing._id);
    logDbWrite("approvedGuilds", "delete", {
      guildRecordId: existing._id,
      guildId: args.guildId,
      action: "revokeGuild",
    });
    return { success: true } as const;
  },
});

export const listApproved = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("approvedGuilds").collect();
  },
});
