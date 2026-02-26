import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

export const getConfig = query({
  args: {
    channelId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("channelConfigs")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .unique();
  },
});

export const addEditorRole = mutation({
  args: {
    channelId: v.string(),
    guildId: v.string(),
    roleId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("channelConfigs")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .unique();

    const now = Date.now();

    if (existing) {
      if (existing.editorRoleIds.includes(args.roleId)) {
        return { success: false, reason: "role_already_added" } as const;
      }

      await ctx.db.patch(existing._id, {
        editorRoleIds: [...existing.editorRoleIds, args.roleId],
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("channelConfigs", {
        channelId: args.channelId,
        guildId: args.guildId,
        editorRoleIds: [args.roleId],
        triggerPrefix: "!",
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true } as const;
  },
});

export const setTriggerPrefix = mutation({
  args: {
    channelId: v.string(),
    guildId: v.string(),
    triggerPrefix: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("channelConfigs")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        triggerPrefix: args.triggerPrefix,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("channelConfigs", {
        channelId: args.channelId,
        guildId: args.guildId,
        editorRoleIds: [],
        triggerPrefix: args.triggerPrefix,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true } as const;
  },
});

export const removeEditorRole = mutation({
  args: {
    channelId: v.string(),
    roleId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("channelConfigs")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .unique();

    if (!existing) {
      return { success: false, reason: "no_config" } as const;
    }

    if (!existing.editorRoleIds.includes(args.roleId)) {
      return { success: false, reason: "role_not_found" } as const;
    }

    await ctx.db.patch(existing._id, {
      editorRoleIds: existing.editorRoleIds.filter(
        (id: string) => id !== args.roleId,
      ),
      updatedAt: Date.now(),
    });

    return { success: true } as const;
  },
});

export const deleteConfig = mutation({
  args: {
    channelId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("channelConfigs")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true } as const;
  },
});
