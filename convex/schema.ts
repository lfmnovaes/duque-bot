import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  channelConfigs: defineTable({
    channelId: v.string(),
    guildId: v.string(),
    editorRoleIds: v.array(v.string()),
    triggerPrefix: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_channel", ["channelId"]),

  customCommands: defineTable({
    channelId: v.string(),
    trigger: v.string(),
    currentResponse: v.string(),
    createdAt: v.number(),
    createdByUserId: v.string(),
    updatedAt: v.number(),
    updatedByUserId: v.string(),
  })
    .index("by_channel_trigger", ["channelId", "trigger"])
    .index("by_channel", ["channelId"]),

  commandHistory: defineTable({
    channelId: v.string(),
    trigger: v.string(),
    action: v.union(
      v.literal("CREATE"),
      v.literal("UPDATE"),
      v.literal("DELETE"),
    ),
    previousResponse: v.optional(v.string()),
    newResponse: v.optional(v.string()),
    actorUserId: v.string(),
    timestamp: v.number(),
  })
    .index("by_channel_trigger", ["channelId", "trigger"])
    .index("by_channel_timestamp", ["channelId", "timestamp"]),

  approvedGuilds: defineTable({
    guildId: v.string(),
    guildName: v.string(),
    blacklistedAt: v.optional(v.number()),
  }).index("by_guild", ["guildId"]),
});
