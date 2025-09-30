import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getLastUserMessage = query({
  returns: v.union(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      id: v.string(),
      role: v.union(
        v.literal("system"),
        v.literal("user"),
        v.literal("assistant"),
      ),
      parts: v.array(v.any()),
      metadata: v.optional(v.any()),
      sessionId: v.id("sessions"),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const lastUserMessage = await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("role"), "user"))
      .order("desc")
      .first();

    if (!lastUserMessage) {
      return null;
    }

    // Check if there are any assistant messages after this user message
    const assistantMessageAfter = await ctx.db
      .query("messages")
      .filter((q) =>
        q.and(
          q.eq(q.field("role"), "assistant"),
          q.gt(q.field("_creationTime"), lastUserMessage._creationTime)
        )
      )
      .first();

    // Only return the user message if it hasn't been responded to
    return assistantMessageAfter ? null : lastUserMessage;
  },
});

export const insertAssistantMessage = mutation({
  args: {
    id: v.string(),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      id: args.id,
      role: "assistant",
      parts: args.parts,
      metadata: args.metadata,
      sessionId: args.sessionId,
    });
  },
});

export const upsertAssistantMessage = mutation({
  args: {
    id: v.string(),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    // Try to find existing message
    const existingMessage = await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();

    if (existingMessage) {
      // Update existing message with new parts
      return await ctx.db.patch(existingMessage._id, {
        parts: args.parts,
        metadata: args.metadata,
        sessionId: args.sessionId,
      });
    } else {
      // Insert new message
      return await ctx.db.insert("messages", {
        id: args.id,
        role: "assistant",
        parts: args.parts,
        metadata: args.metadata,
        sessionId: args.sessionId,
      });
    }
  },
});

export const insertUserMessage = mutation({
  args: {
    id: v.string(),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      id: args.id,
      role: "user",
      parts: args.parts,
      metadata: args.metadata,
      sessionId: args.sessionId,
    });
  },
});

export const getAllMessages = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      id: v.string(),
      role: v.union(
        v.literal("system"),
        v.literal("user"),
        v.literal("assistant"),
      ),
      parts: v.array(v.any()),
      metadata: v.optional(v.any()),
      sessionId: v.id("sessions"),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db
      .query("messages")
      .order("asc")
      .collect();
  },
});


export const getCurrentSessionId = query({
  returns: v.union(v.id("sessions"), v.null()),
  handler: async (ctx) => {
    // Get the most recent assistant message, which should have the current sessionId
    const lastAssistantMessage = await ctx.db
      .query("messages")
      .filter((q) => q.eq(q.field("role"), "assistant"))
      .order("desc")
      .first();

    return lastAssistantMessage?.sessionId || null;
  },
});

export const getMessagesBySessionId = query({
  args: {
    sessionId: v.id("sessions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
      id: v.string(),
      role: v.union(
        v.literal("system"),
        v.literal("user"),
        v.literal("assistant"),
      ),
      parts: v.array(v.any()),
      metadata: v.optional(v.any()),
      sessionId: v.id("sessions"),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});
