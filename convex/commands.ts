import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";

export const getCommand = query({
  args: {
    channelId: v.string(),
    trigger: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customCommands")
      .withIndex("by_channel_trigger", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("trigger"), args.trigger))
      .unique();
  },
});

export const listCommands = query({
  args: {
    channelId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customCommands")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();
  },
});

export const addCommand = mutation({
  args: {
    channelId: v.string(),
    trigger: v.string(),
    response: v.string(),
    actorUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customCommands")
      .withIndex("by_channel_trigger", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("trigger"), args.trigger))
      .unique();

    if (existing) {
      return { success: false, reason: "already_exists" } as const;
    }

    const now = Date.now();

    await ctx.db.insert("customCommands", {
      channelId: args.channelId,
      trigger: args.trigger,
      currentResponse: args.response,
      createdAt: now,
      createdByUserId: args.actorUserId,
      updatedAt: now,
      updatedByUserId: args.actorUserId,
    });

    await ctx.db.insert("commandHistory", {
      channelId: args.channelId,
      trigger: args.trigger,
      action: "CREATE",
      newResponse: args.response,
      actorUserId: args.actorUserId,
      timestamp: now,
    });

    return { success: true } as const;
  },
});

export const editCommand = mutation({
  args: {
    channelId: v.string(),
    trigger: v.string(),
    newResponse: v.string(),
    actorUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customCommands")
      .withIndex("by_channel_trigger", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("trigger"), args.trigger))
      .unique();

    if (!existing) {
      return { success: false, reason: "not_found" } as const;
    }

    const now = Date.now();
    const previousResponse = existing.currentResponse;

    await ctx.db.patch(existing._id, {
      currentResponse: args.newResponse,
      updatedAt: now,
      updatedByUserId: args.actorUserId,
    });

    await ctx.db.insert("commandHistory", {
      channelId: args.channelId,
      trigger: args.trigger,
      action: "UPDATE",
      previousResponse,
      newResponse: args.newResponse,
      actorUserId: args.actorUserId,
      timestamp: now,
    });

    return { success: true } as const;
  },
});

export const removeCommand = mutation({
  args: {
    channelId: v.string(),
    trigger: v.string(),
    actorUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customCommands")
      .withIndex("by_channel_trigger", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("trigger"), args.trigger))
      .unique();

    if (!existing) {
      return { success: false, reason: "not_found" } as const;
    }

    const now = Date.now();

    await ctx.db.insert("commandHistory", {
      channelId: args.channelId,
      trigger: args.trigger,
      action: "DELETE",
      previousResponse: existing.currentResponse,
      actorUserId: args.actorUserId,
      timestamp: now,
    });

    await ctx.db.delete(existing._id);

    return { success: true } as const;
  },
});

export const removeAllByChannel = mutation({
  args: {
    channelId: v.string(),
    actorUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const commands = await ctx.db
      .query("customCommands")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    const now = Date.now();

    for (const cmd of commands) {
      await ctx.db.insert("commandHistory", {
        channelId: args.channelId,
        trigger: cmd.trigger,
        action: "DELETE",
        previousResponse: cmd.currentResponse,
        actorUserId: args.actorUserId,
        timestamp: now,
      });
      await ctx.db.delete(cmd._id);
    }

    return { deleted: commands.length };
  },
});
