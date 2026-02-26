import { v } from "convex/values";
import { query } from "./_generated/server.js";

export const getHistory = query({
  args: {
    channelId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("commandHistory")
      .withIndex("by_channel_timestamp", (q) =>
        q.eq("channelId", args.channelId),
      )
      .order("desc")
      .take(limit);
  },
});

export const getHistoryForTrigger = query({
  args: {
    channelId: v.string(),
    trigger: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("commandHistory")
      .withIndex("by_channel_trigger", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("trigger"), args.trigger))
      .order("desc")
      .collect();
  },
});
