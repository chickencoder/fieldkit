import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getActiveSandbox = query({
  args: {
    projectId: v.id("projects"),
    branchId: v.id("branches"),
  },
  returns: v.union(
    v.object({
      _id: v.id("sandboxes"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      branchId: v.id("branches"),
      sandboxId: v.string(),
      domain: v.string(),
      status: v.union(v.literal("active"), v.literal("stopped")),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_project_and_branch", (q) =>
        q.eq("projectId", args.projectId).eq("branchId", args.branchId)
      )
      .filter((q) => q.eq(q.field("status"), "active"))
      .first();

    return sandbox;
  },
});

export const createSandbox = mutation({
  args: {
    projectId: v.id("projects"),
    branchId: v.id("branches"),
    sandboxId: v.string(),
    domain: v.string(),
  },
  returns: v.id("sandboxes"),
  handler: async (ctx, args) => {
    const sandboxRecordId = await ctx.db.insert("sandboxes", {
      projectId: args.projectId,
      branchId: args.branchId,
      sandboxId: args.sandboxId,
      domain: args.domain,
      status: "active",
      createdAt: Date.now(),
    });

    return sandboxRecordId;
  },
});

export const updateSandboxStatus = mutation({
  args: {
    sandboxRecordId: v.id("sandboxes"),
    status: v.union(v.literal("active"), v.literal("stopped")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sandboxRecordId, {
      status: args.status,
    });

    return null;
  },
});
