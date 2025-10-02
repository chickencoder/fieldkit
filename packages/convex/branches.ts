import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getBranchesByProject = query({
  args: { projectId: v.id("projects") },
  returns: v.array(
    v.object({
      _id: v.id("branches"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      name: v.string(),
      commitSha: v.string(),
      commitUrl: v.string(),
      protected: v.boolean(),
      orgId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    return branches;
  },
});

export const upsertBranch = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    commitSha: v.string(),
    commitUrl: v.string(),
    protected: v.boolean(),
    orgId: v.optional(v.string()),
  },
  returns: v.id("branches"),
  handler: async (ctx, args) => {
    // Check if branch already exists
    const existingBranch = await ctx.db
      .query("branches")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existingBranch) {
      // Update existing branch
      await ctx.db.patch(existingBranch._id, {
        commitSha: args.commitSha,
        commitUrl: args.commitUrl,
        protected: args.protected,
        orgId: args.orgId,
      });
      return existingBranch._id;
    } else {
      // Insert new branch
      const branchId = await ctx.db.insert("branches", {
        projectId: args.projectId,
        name: args.name,
        commitSha: args.commitSha,
        commitUrl: args.commitUrl,
        protected: args.protected,
        orgId: args.orgId,
      });
      return branchId;
    }
  },
});

export const syncBranchesFromGitHub = mutation({
  args: {
    projectId: v.id("projects"),
    branches: v.array(
      v.object({
        name: v.string(),
        commitSha: v.string(),
        commitUrl: v.string(),
        protected: v.boolean(),
      }),
    ),
    orgId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get existing branches for this project
    const existingBranches = await ctx.db
      .query("branches")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const existingBranchNames = new Set(
      existingBranches.map((b) => b.name),
    );
    const incomingBranchNames = new Set(args.branches.map((b) => b.name));

    // Delete branches that no longer exist
    for (const existingBranch of existingBranches) {
      if (!incomingBranchNames.has(existingBranch.name)) {
        await ctx.db.delete(existingBranch._id);
      }
    }

    // Upsert all incoming branches
    for (const branch of args.branches) {
      const existing = existingBranches.find((b) => b.name === branch.name);

      if (existing) {
        // Update if commit changed
        if (existing.commitSha !== branch.commitSha || existing.protected !== branch.protected) {
          await ctx.db.patch(existing._id, {
            commitSha: branch.commitSha,
            commitUrl: branch.commitUrl,
            protected: branch.protected,
            orgId: args.orgId,
          });
        }
      } else {
        // Insert new branch
        await ctx.db.insert("branches", {
          projectId: args.projectId,
          name: branch.name,
          commitSha: branch.commitSha,
          commitUrl: branch.commitUrl,
          protected: branch.protected,
          orgId: args.orgId,
        });
      }
    }

    return null;
  },
});
