# Sandbox Worker Injection System

This document explains how the sandbox worker injection system works and how to use it.

## Overview

The system automatically injects a standalone Node.js worker into Vercel sandboxes that provides:
- File synchronization to R2 storage for persistence
- Claude Code integration for processing user requests
- Real-time communication via Convex database

## How It Works

### 1. Bundle Creation
```bash
# Build the standalone worker bundle
cd packages/sandbox-worker
pnpm build:standalone
```

This creates a single executable JavaScript file (`dist/standalone/index.js`) that contains:
- All worker source code
- All npm dependencies bundled inline
- Executable shebang (`#!/usr/bin/env node`)

### 2. Sandbox Injection Process

When `startSandboxAction` is called:

1. **Sandbox Creation**: Creates Vercel sandbox from Git repo
2. **Claude Code Installation**: Installs `@anthropic-ai/claude-code` globally
3. **Worker Bundle Build**: Builds the standalone worker bundle locally
4. **File Injection**: Uploads the bundle to `/tmp/sandbox-worker.js` in the sandbox
5. **Permission Setup**: Makes the file executable with `chmod +x`
6. **Environment Setup**: Configures environment variables (Convex URL, R2 credentials)
7. **Background Start**: Starts worker with `nohup` and saves PID to `/tmp/worker.pid`
8. **Status Check**: Verifies worker is running and healthy
9. **Project Setup**: Runs project install and dev commands

### 3. Worker Lifecycle

```bash
# Worker is started in background
nohup node /tmp/sandbox-worker.js > /tmp/worker.log 2>&1 & echo $! > /tmp/worker.pid

# Check if worker is running
kill -0 $(cat /tmp/worker.pid) 2>/dev/null

# Stop worker
kill $(cat /tmp/worker.pid) 2>/dev/null; rm -f /tmp/worker.pid

# View worker logs
tail -f /tmp/worker.log
```

## Environment Variables

### Required
- `CONVEX_URL`: Your Convex deployment URL

### Optional (File Sync)
- `SANDBOX_ID`: Unique identifier for the sandbox
- `R2_ENDPOINT`: R2 endpoint URL
- `R2_ACCESS_KEY_ID`: R2 access key
- `R2_SECRET_ACCESS_KEY`: R2 secret key
- `R2_BUCKET_NAME`: R2 bucket name

## API Usage

### Start Sandbox with Worker
```typescript
import { startSandboxAction } from "@/actions/start-sandbox";

const result = await startSandboxAction({
  githubRepoUrl: "https://github.com/user/repo",
  branchName: "main",
  installCommand: "npm install",
  developmentCommand: "npm run dev",
  port: 3000,
});
```

### Monitor Worker Status
```typescript
import { getWorkerStatusAction } from "@/actions/worker-status";

const status = await getWorkerStatusAction({
  sandboxId: "your-sandbox-id"
});

console.log(status.isRunning); // true/false
console.log(status.pid); // Process ID
console.log(status.logs); // Recent logs
```

### Stop Worker
```typescript
import { stopWorkerAction } from "@/actions/worker-status";

const result = await stopWorkerAction({
  sandboxId: "your-sandbox-id"
});
```

## File Sync Behavior

### What Gets Synced
- ✅ Source code files (`.ts`, `.tsx`, `.js`, `.vue`, etc.)
- ✅ Configuration files (`package.json`, `tsconfig.json`, etc.)
- ✅ Lock files (`package-lock.json`, `pnpm-lock.yaml`, etc.)
- ❌ `node_modules/` (dependencies are reinstalled)
- ❌ Build artifacts (`.next/`, `dist/`, `build/`, etc.)
- ❌ Git files (`.git/`)
- ❌ Temporary files (`.cache/`, `tmp/`, logs, etc.)

### Sync Priority
- **Immediate**: Config files (package.json, tsconfig.json, etc.)
- **Batched**: Regular source files (every 30 seconds or 10 files)

### File Restoration
When worker starts:
1. Downloads existing files from R2 storage
2. Compares file hashes to avoid unnecessary downloads
3. Restores only changed/missing files
4. Runs package manager install if package.json was restored

## Troubleshooting

### Worker Not Starting
1. Check build logs for bundle creation errors
2. Verify environment variables are set correctly
3. Check sandbox logs: `tail -f /tmp/worker.log`
4. Ensure Node.js is available in sandbox

### File Sync Issues
1. Verify R2 credentials and bucket permissions
2. Check worker logs for sync errors
3. Monitor sync queue status in logs
4. Ensure adequate disk space in sandbox

### Performance Issues
1. Monitor bundle size (should be ~1-2MB)
2. Check network connectivity to R2
3. Adjust batch size/interval if needed
4. Monitor memory usage in sandbox

## Development

### Testing Locally
```bash
# Build worker bundle
cd packages/sandbox-worker
pnpm build:standalone

# Test bundle executable
./dist/standalone/index.js
```

### Adding Dependencies
When adding new dependencies to the worker:
1. Add to `packages/sandbox-worker/package.json`
2. Rebuild the standalone bundle
3. Test in a real sandbox environment

### Bundle Size Optimization
- Use `minify: true` in production builds
- Exclude unnecessary dependencies
- Consider code splitting for large features

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │    │     Bundle      │    │     Sandbox     │
│                 │    │                 │    │                 │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ startSandbox    │───▶│ Build & Inject  │───▶│ Worker Running  │
│ Action          │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                             │
         │                                             ▼
         │                     ┌─────────────────┐    ┌─────────────────┐
         └────────────────────▶│     Convex      │◀───│   File Sync     │
                               │   Database      │    │                 │
                               └─────────────────┘    └─────────────────┘
                                        ▲                      │
                                        │                      ▼
                               ┌─────────────────┐    ┌─────────────────┐
                               │  Claude Code    │    │   R2 Storage    │
                               │                 │    │                 │
                               └─────────────────┘    └─────────────────┘
```