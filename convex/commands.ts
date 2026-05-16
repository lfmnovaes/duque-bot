import { v } from "convex/values";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import { mutation, query } from "./_generated/server.js";
import { logDbWrite } from "./logging.js";

const COMMAND_HISTORY_PER_CHANNEL_LIMIT = 100;
const COMMAND_RESPONSE_MAX_LENGTH = 4000;
const REMOVE_ALL_BATCH_SIZE = 100;

type CommandHistoryAction = "CREATE" | "UPDATE" | "DELETE";

type CommandHistoryInsert = {
  channelId: string;
  guildId?: string;
  trigger: string;
  action: CommandHistoryAction;
  previousResponse?: string;
  newResponse?: string;
  previousCount?: number;
  newCount?: number;
  actorUserId: string;
  timestamp: number;
};

type HistoryCounterState = {
  metaId: Id<"appMeta">;
  count: number;
  dirty: boolean;
};

async function ensureHistoryCounterState(
  ctx: MutationCtx,
  currentState: HistoryCounterState | null,
  channelId: string,
): Promise<HistoryCounterState> {
  if (currentState) {
    return currentState;
  }

  const metaKey = `command_history_count_${channelId}`;

  const existingMeta = await ctx.db
    .query("appMeta")
    .withIndex("by_key", (q) => q.eq("key", metaKey))
    .unique();

  if (existingMeta) {
    return {
      metaId: existingMeta._id,
      count: existingMeta.commandHistoryCount,
      dirty: false,
    };
  }

  const initialCount = (
    await ctx.db
      .query("commandHistory")
      .withIndex("by_channel_timestamp", (q) => q.eq("channelId", channelId))
      .collect()
  ).length;

  const metaId = await ctx.db.insert("appMeta", {
    key: metaKey,
    commandHistoryCount: initialCount,
    updatedAt: Date.now(),
  });
  logDbWrite("appMeta", "insert", {
    metaId,
    key: metaKey,
    commandHistoryCount: initialCount,
  });

  return {
    metaId,
    count: initialCount,
    dirty: false,
  };
}

async function persistHistoryCounterState(
  ctx: MutationCtx,
  state: HistoryCounterState | null,
  channelId: string,
): Promise<void> {
  if (!state?.dirty) return;

  const metaKey = `command_history_count_${channelId}`;

  await ctx.db.patch(state.metaId, {
    commandHistoryCount: state.count,
    updatedAt: Date.now(),
  });
  logDbWrite("appMeta", "patch", {
    metaId: state.metaId,
    key: metaKey,
    commandHistoryCount: state.count,
  });
  state.dirty = false;
}

async function insertCommandHistoryCapped(
  ctx: MutationCtx,
  state: HistoryCounterState | null,
  entry: CommandHistoryInsert,
  details: Record<string, unknown> = {},
): Promise<{ historyId: Id<"commandHistory">; state: HistoryCounterState }> {
  const nextState = await ensureHistoryCounterState(
    ctx,
    state,
    entry.channelId,
  );

  const historyId = await ctx.db.insert("commandHistory", entry);
  logDbWrite("commandHistory", "insert", {
    historyId,
    channelId: entry.channelId,
    trigger: entry.trigger,
    action: entry.action,
    actorUserId: entry.actorUserId,
    ...details,
  });

  nextState.count += 1;
  nextState.dirty = true;

  if (nextState.count > COMMAND_HISTORY_PER_CHANNEL_LIMIT) {
    const overflow = nextState.count - COMMAND_HISTORY_PER_CHANNEL_LIMIT;
    const oldestEntries = await ctx.db
      .query("commandHistory")
      .withIndex("by_channel_timestamp", (q) =>
        q.eq("channelId", entry.channelId),
      )
      .order("asc")
      .take(overflow);

    for (const oldestEntry of oldestEntries) {
      await ctx.db.delete(oldestEntry._id);
      logDbWrite("commandHistory", "delete", {
        historyId: oldestEntry._id,
        channelId: oldestEntry.channelId,
        trigger: oldestEntry.trigger,
        action: oldestEntry.action,
        actorUserId: oldestEntry.actorUserId,
        reason: "retention_cap",
        maxEntries: COMMAND_HISTORY_PER_CHANNEL_LIMIT,
      });
    }

    nextState.count -= oldestEntries.length;
  }

  return { historyId, state: nextState };
}

export const getCommand = query({
  args: {
    channelId: v.string(),
    trigger: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("customCommands")
      .withIndex("by_channel_trigger", (q) =>
        q.eq("channelId", args.channelId).eq("trigger", args.trigger),
      )
      .unique();
  },
});

export const resolveTriggerResponse = mutation({
  args: {
    channelId: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("channelConfigs")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .unique();

    const triggerPrefix = config?.triggerPrefix ?? "!";
    if (!args.content.startsWith(triggerPrefix)) {
      return null;
    }

    const trigger = args.content
      .slice(triggerPrefix.length)
      .split(/\s/)[0]
      .toLowerCase()
      .trim();

    if (!trigger) return null;

    const command = await ctx.db
      .query("customCommands")
      .withIndex("by_channel_trigger", (q) =>
        q.eq("channelId", args.channelId).eq("trigger", trigger),
      )
      .unique();

    if (!command) return null;

    const newCount = (command.count ?? 0) + 1;
    await ctx.db.patch(command._id, { count: newCount });

    return {
      trigger,
      triggerPrefix,
      response: command.currentResponse,
      count: newCount,
    };
  },
});

export const listCommands = query({
  args: {
    channelId: v.string(),
  },
  handler: async (ctx, args) => {
    const commands = await ctx.db
      .query("customCommands")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .collect();

    return commands.map((command) => ({
      trigger: command.trigger,
      createdAt: command.createdAt,
      createdByUserId: command.createdByUserId,
      updatedAt: command.updatedAt,
      updatedByUserId: command.updatedByUserId,
    }));
  },
});

export const addCommand = mutation({
  args: {
    channelId: v.string(),
    trigger: v.string(),
    response: v.string(),
    actorUserId: v.string(),
    guildId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.trigger.trim().length === 0) {
      return { success: false, reason: "empty_trigger" } as const;
    }
    if (args.response.length > COMMAND_RESPONSE_MAX_LENGTH) {
      return { success: false, reason: "response_too_long" } as const;
    }

    const existing = await ctx.db
      .query("customCommands")
      .withIndex("by_channel_trigger", (q) =>
        q.eq("channelId", args.channelId).eq("trigger", args.trigger),
      )
      .unique();

    if (existing) {
      return { success: false, reason: "already_exists" } as const;
    }

    const now = Date.now();

    const commandId = await ctx.db.insert("customCommands", {
      channelId: args.channelId,
      trigger: args.trigger,
      currentResponse: args.response,
      guildId: args.guildId,
      createdAt: now,
      createdByUserId: args.actorUserId,
      updatedAt: now,
      updatedByUserId: args.actorUserId,
    });
    logDbWrite("customCommands", "insert", {
      commandId,
      channelId: args.channelId,
      trigger: args.trigger,
      actorUserId: args.actorUserId,
      guildId: args.guildId,
      responseLength: args.response.length,
    });

    let historyCounter: HistoryCounterState | null = null;
    ({ state: historyCounter } = await insertCommandHistoryCapped(
      ctx,
      historyCounter,
      {
        channelId: args.channelId,
        guildId: args.guildId,
        trigger: args.trigger,
        action: "CREATE",
        newResponse: args.response,
        newCount: 0,
        actorUserId: args.actorUserId,
        timestamp: now,
      },
      {
        responseLength: args.response.length,
      },
    ));
    await persistHistoryCounterState(ctx, historyCounter, args.channelId);

    return { success: true } as const;
  },
});

export const editCommand = mutation({
  args: {
    channelId: v.string(),
    trigger: v.string(),
    newResponse: v.string(),
    actorUserId: v.string(),
    guildId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.newResponse.length > COMMAND_RESPONSE_MAX_LENGTH) {
      return { success: false, reason: "response_too_long" } as const;
    }

    const existing = await ctx.db
      .query("customCommands")
      .withIndex("by_channel_trigger", (q) =>
        q.eq("channelId", args.channelId).eq("trigger", args.trigger),
      )
      .unique();

    if (!existing) {
      return { success: false, reason: "not_found" } as const;
    }

    const now = Date.now();
    const previousResponse = existing.currentResponse;

    await ctx.db.patch(existing._id, {
      currentResponse: args.newResponse,
      guildId: args.guildId,
      updatedAt: now,
      updatedByUserId: args.actorUserId,
    });
    logDbWrite("customCommands", "patch", {
      commandId: existing._id,
      channelId: args.channelId,
      trigger: args.trigger,
      actorUserId: args.actorUserId,
      guildId: args.guildId,
      previousResponseLength: previousResponse.length,
      newResponseLength: args.newResponse.length,
    });

    let historyCounter: HistoryCounterState | null = null;
    ({ state: historyCounter } = await insertCommandHistoryCapped(
      ctx,
      historyCounter,
      {
        channelId: args.channelId,
        guildId: args.guildId,
        trigger: args.trigger,
        action: "UPDATE",
        previousResponse,
        newResponse: args.newResponse,
        previousCount: existing.count ?? 0,
        newCount: existing.count ?? 0,
        actorUserId: args.actorUserId,
        timestamp: now,
      },
      {
        previousResponseLength: previousResponse.length,
        newResponseLength: args.newResponse.length,
      },
    ));
    await persistHistoryCounterState(ctx, historyCounter, args.channelId);

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
      .withIndex("by_channel_trigger", (q) =>
        q.eq("channelId", args.channelId).eq("trigger", args.trigger),
      )
      .unique();

    if (!existing) {
      return { success: false, reason: "not_found" } as const;
    }

    const now = Date.now();
    let historyCounter: HistoryCounterState | null = null;

    ({ state: historyCounter } = await insertCommandHistoryCapped(
      ctx,
      historyCounter,
      {
        channelId: args.channelId,
        trigger: args.trigger,
        action: "DELETE",
        previousResponse: existing.currentResponse,
        previousCount: existing.count ?? 0,
        actorUserId: args.actorUserId,
        timestamp: now,
      },
      {
        previousResponseLength: existing.currentResponse.length,
      },
    ));

    await ctx.db.delete(existing._id);
    logDbWrite("customCommands", "delete", {
      commandId: existing._id,
      channelId: args.channelId,
      trigger: args.trigger,
      actorUserId: args.actorUserId,
    });

    await persistHistoryCounterState(ctx, historyCounter, args.channelId);
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
      .take(REMOVE_ALL_BATCH_SIZE);

    const now = Date.now();
    let historyCounter: HistoryCounterState | null = null;

    for (const cmd of commands) {
      ({ state: historyCounter } = await insertCommandHistoryCapped(
        ctx,
        historyCounter,
        {
          channelId: args.channelId,
          trigger: cmd.trigger,
          action: "DELETE",
          previousResponse: cmd.currentResponse,
          previousCount: cmd.count ?? 0,
          actorUserId: args.actorUserId,
          timestamp: now,
        },
        {
          previousResponseLength: cmd.currentResponse.length,
        },
      ));

      await ctx.db.delete(cmd._id);
      logDbWrite("customCommands", "delete", {
        commandId: cmd._id,
        channelId: args.channelId,
        trigger: cmd.trigger,
        actorUserId: args.actorUserId,
      });
    }

    await persistHistoryCounterState(ctx, historyCounter, args.channelId);

    let hasMore = false;
    if (commands.length === REMOVE_ALL_BATCH_SIZE) {
      const remaining = await ctx.db
        .query("customCommands")
        .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
        .take(1);
      hasMore = remaining.length > 0;
    }

    return { deleted: commands.length, hasMore } as const;
  },
});

export const editCommandCount = mutation({
  args: {
    channelId: v.string(),
    trigger: v.string(),
    newCount: v.number(),
    actorUserId: v.string(),
    guildId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customCommands")
      .withIndex("by_channel_trigger", (q) =>
        q.eq("channelId", args.channelId).eq("trigger", args.trigger),
      )
      .unique();

    if (!existing) {
      return { success: false, reason: "not_found" } as const;
    }

    const now = Date.now();
    const previousCount = existing.count ?? 0;

    await ctx.db.patch(existing._id, {
      count: args.newCount,
      guildId: args.guildId,
      updatedAt: now,
      updatedByUserId: args.actorUserId,
    });
    logDbWrite("customCommands", "patch", {
      commandId: existing._id,
      channelId: args.channelId,
      trigger: args.trigger,
      actorUserId: args.actorUserId,
      guildId: args.guildId,
      previousCount,
      newCount: args.newCount,
    });

    let historyCounter: HistoryCounterState | null = null;
    ({ state: historyCounter } = await insertCommandHistoryCapped(
      ctx,
      historyCounter,
      {
        channelId: args.channelId,
        guildId: args.guildId,
        trigger: args.trigger,
        action: "UPDATE",
        previousResponse: existing.currentResponse,
        newResponse: existing.currentResponse,
        previousCount,
        newCount: args.newCount,
        actorUserId: args.actorUserId,
        timestamp: now,
      },
      {
        previousCount,
        newCount: args.newCount,
      },
    ));
    await persistHistoryCounterState(ctx, historyCounter, args.channelId);

    return { success: true } as const;
  },
});
