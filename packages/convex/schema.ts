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
  projects: defineTable({
    name: v.string(),
    fullName: v.string(),
    owner: v.string(),
    repoId: v.number(),
    description: v.optional(v.string()),
    isPrivate: v.boolean(),
    htmlUrl: v.string(),
    installCommand: v.string(),
    devCommand: v.string(),
    port: v.string(),
  }).index("by_owner", ["owner"]),
  branches: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    commitSha: v.string(),
    commitUrl: v.string(),
    protected: v.boolean(),
    orgId: v.optional(v.string()),
  }).index("by_project", ["projectId"]),
});
