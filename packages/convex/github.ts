import { v } from "convex/values";
import { action } from "./_generated/server";
import { authComponent } from "./auth";
import { components } from "./_generated/api";

export const getGithubRepos = action({
  args: {},
  returns: v.union(
    v.object({
      success: v.boolean(),
      repos: v.array(
        v.object({
          id: v.number(),
          name: v.string(),
          full_name: v.string(),
          owner: v.object({
            login: v.string(),
            avatar_url: v.string(),
          }),
          description: v.union(v.string(), v.null()),
          private: v.boolean(),
          html_url: v.string(),
        }),
      ),
    }),
    v.object({
      success: v.boolean(),
      error: v.string(),
    }),
  ),
  handler: async (ctx) => {
    // Get the current authenticated user
    const user = await authComponent.getAuthUser(ctx);

    if (!user) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Query the account table to find the GitHub account for this user
    const account = await ctx.runQuery(
      components.betterAuth.adapter.findOne,
      {
        model: "account",
        where: [
          {
            field: "userId",
            operator: "eq",
            value: user.userId || user._id,
          },
          {
            field: "providerId",
            operator: "eq",
            value: "github",
          },
        ],
      },
    );

    if (!account) {
      return {
        success: false,
        error: "GitHub account not linked",
      };
    }

    const accessToken = account.accessToken;

    if (!accessToken) {
      return {
        success: false,
        error: "No GitHub access token found. Please re-authenticate.",
      };
    }

    // Check if the account has the required scope
    // GitHub scopes can be stored as comma-separated or space-separated
    const scopeString = account.scope || "";
    const scopes = scopeString.includes(",")
      ? scopeString.split(",").map((s: string) => s.trim())
      : scopeString.split(" ").map((s: string) => s.trim());
    const hasRepoScope = scopes.includes("repo") || scopes.includes("public_repo");

    if (!hasRepoScope) {
      return {
        success: false,
        error:
          "Missing required permissions. Please re-authenticate to grant repository access.",
      };
    }

    // Call GitHub API to get user's repositories
    // Using affiliation=owner,organization_member to get both personal and org repos
    try {
      const response = await fetch(
        "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,organization_member",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `GitHub API error: ${response.status} ${errorText}`,
        };
      }

      const repos = await response.json();

      return {
        success: true,
        repos: repos.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          owner: {
            login: repo.owner.login,
            avatar_url: repo.owner.avatar_url,
          },
          description: repo.description,
          private: repo.private,
          html_url: repo.html_url,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch repositories: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
