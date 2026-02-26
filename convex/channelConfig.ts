import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { logDbWrite } from "./logging.js";

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
      logDbWrite("channelConfigs", "patch", {
        configId: existing._id,
        channelId: args.channelId,
        guildId: existing.guildId,
        action: "addEditorRole",
        roleId: args.roleId,
        roleCount: existing.editorRoleIds.length + 1,
      });
    } else {
      const configId = await ctx.db.insert("channelConfigs", {
        channelId: args.channelId,
        guildId: args.guildId,
        editorRoleIds: [args.roleId],
        triggerPrefix: "!",
        createdAt: now,
        updatedAt: now,
      });
      logDbWrite("channelConfigs", "insert", {
        configId,
        channelId: args.channelId,
        guildId: args.guildId,
        action: "addEditorRole",
        roleId: args.roleId,
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
      logDbWrite("channelConfigs", "patch", {
        configId: existing._id,
        channelId: args.channelId,
        guildId: existing.guildId,
        action: "setTriggerPrefix",
        triggerPrefix: args.triggerPrefix,
      });
    } else {
      const configId = await ctx.db.insert("channelConfigs", {
        channelId: args.channelId,
        guildId: args.guildId,
        editorRoleIds: [],
        triggerPrefix: args.triggerPrefix,
        createdAt: now,
        updatedAt: now,
      });
      logDbWrite("channelConfigs", "insert", {
        configId,
        channelId: args.channelId,
        guildId: args.guildId,
        action: "setTriggerPrefix",
        triggerPrefix: args.triggerPrefix,
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
    logDbWrite("channelConfigs", "patch", {
      configId: existing._id,
      channelId: args.channelId,
      guildId: existing.guildId,
      action: "removeEditorRole",
      roleId: args.roleId,
      roleCount: existing.editorRoleIds.length - 1,
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
      logDbWrite("channelConfigs", "delete", {
        configId: existing._id,
        channelId: args.channelId,
        guildId: existing.guildId,
      });
    }

    return { success: true } as const;
  },
});
