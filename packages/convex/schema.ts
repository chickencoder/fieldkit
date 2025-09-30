import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    id: v.string(),
    role: v.union(
      v.literal("system"),
      v.literal("user"),
      v.literal("assistant"),
    ),
    parts: v.array(v.any()),
    metadata: v.optional(v.any()),
    sessionId: v.id("sessions"),
  }).index("by_session", ["sessionId"]),
  sessions: defineTable({
    agentSessionId: v.optional(v.string()),
    sandboxId: v.string(),
    createdAt: v.number(),
  }),
});
