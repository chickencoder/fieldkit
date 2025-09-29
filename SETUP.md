# Fieldkit Setup Guide

## Required Environment Variables

To run the sandbox worker injection system, you need to configure the following environment variables:

### 1. **Convex Database** (Required)

Create or update your `.env.local` file in `apps/app/`:

```bash
# apps/app/.env.local
CONVEX_URL=https://your-deployment.convex.cloud
```

**How to get your Convex URL:**
1. Go to [dashboard.convex.dev](https://dashboard.convex.dev)
2. Select your project
3. Go to "Settings" → "URL & Deploy Key"
4. Copy the "Convex URL"

### 2. **R2 Storage** (Optional - for file sync)

Add these to your `.env.local`:

```bash
# R2 Configuration (optional)
R2_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-s3-api-access-key
R2_SECRET_ACCESS_KEY=your-s3-api-secret-key
R2_BUCKET_NAME=your-bucket-name
```

**How to get R2 credentials:**
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to "R2 Object Storage"
3. Create a bucket (e.g., `fieldkit-sandbox-files`)
4. Go to "Manage R2 API tokens"
5. Create an "S3 API token" (not regular API token)
6. Use the provided Access Key ID and Secret Access Key

## Testing the Setup

### 1. **Test Worker Bundle Build**

```bash
cd apps/app
node test-worker-bundle.js
```

This should output:
```
✅ Bundle built successfully: { filename: 'sandbox-worker.js', size: '1780.5KB' }
✅ Environment variables generated: { CONVEX_URL: '...', SANDBOX_ID: '...', ... }
✅ Start command generated: export CONVEX_URL="..." && ...
```

### 2. **Test Sandbox Creation**

Create a test sandbox with your configured environment:

```typescript
import { startSandboxAction } from "@/actions/start-sandbox";

const result = await startSandboxAction({
  githubRepoUrl: "https://github.com/your-username/your-repo",
  branchName: "main",
  installCommand: "npm install",
  developmentCommand: "npm run dev",
  port: 3000,
});
```

## Troubleshooting

### Worker fails with "Invalid deployment address"

**Problem**: `CONVEX_URL` is undefined or not accessible in the server action.

**Solution**:
1. Make sure `.env.local` exists in `apps/app/`
2. Restart your Next.js dev server after adding environment variables
3. Check that the variable name is exactly `CONVEX_URL`

### Worker injection skipped with "No CONVEX_URL found"

**Problem**: Environment variable is not being loaded in the server action.

**Solution**:
1. Verify `.env.local` is in the correct location (`apps/app/.env.local`)
2. Try using `NEXT_PUBLIC_CONVEX_URL` instead (client-side accessible)
3. Restart your development server

### File sync disabled

**Problem**: R2 configuration is incomplete.

**Solution**:
1. This is normal if you haven't set up R2 yet
2. The worker will still function for Claude Code processing
3. Add R2 credentials when you want file persistence

### Bundle build fails

**Problem**: TypeScript errors or missing dependencies.

**Solution**:
1. Run `pnpm install` in the root directory
2. Run `pnpm type-check` in `packages/sandbox-worker`
3. Fix any TypeScript errors that appear

## Example .env.local File

```bash
# Required
CONVEX_URL=https://amazing-dolphin-123.convex.cloud

# Optional - R2 Storage
R2_ENDPOINT=https://abc123def456.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=f1234567890abcdef1234567890abcdef12345678
R2_SECRET_ACCESS_KEY=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab
R2_BUCKET_NAME=fieldkit-sandbox-files

# Optional - for development
NODE_ENV=development
```

## Next Steps

Once your environment is configured:

1. **Test locally**: Create a sandbox and verify the worker starts
2. **Monitor logs**: Check console output for worker status
3. **Test file sync**: If R2 is configured, verify files are being synced
4. **Test Claude Code**: Send messages and verify responses

The system is designed to gracefully degrade - if R2 is not configured, you'll still get Claude Code processing without file persistence.