# Sandbox Worker

A worker that runs inside Vercel sandboxes to process Claude Code queries and sync files to persistent storage.

## Features

- **Claude Code Integration**: Processes user messages and streams responses back via Convex
- **File Synchronization**: Automatically syncs project files to R2 storage for persistence across sandbox restarts
- **Smart Filtering**: Ignores node_modules, build artifacts, and other temporary files
- **Batch Processing**: Efficiently batches file uploads to reduce API calls
- **Graceful Shutdown**: Ensures all pending syncs complete before shutdown

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Build the worker**:
   ```bash
   pnpm build
   ```

4. **Run in development**:
   ```bash
   pnpm dev
   ```

## Environment Variables

### Required
- `CONVEX_URL`: Your Convex deployment URL

### Optional (File Sync)
- `SANDBOX_ID`: Unique identifier for this sandbox (auto-generated if not provided)
- `R2_ENDPOINT`: R2 endpoint URL
- `R2_ACCESS_KEY_ID`: R2 access key ID
- `R2_SECRET_ACCESS_KEY`: R2 secret access key
- `R2_BUCKET_NAME`: R2 bucket name

If R2 configuration is incomplete, file sync will be disabled and the worker will only process messages.

## File Sync Behavior

### What Gets Synced
- ✅ Source code files (`.ts`, `.tsx`, `.js`, etc.)
- ✅ Configuration files (`package.json`, `tsconfig.json`, etc.)
- ✅ Lock files (`package-lock.json`, `pnpm-lock.yaml`, etc.)
- ❌ `node_modules/` (reinstalled via package manager)
- ❌ Build artifacts (`.next/`, `dist/`, etc.)
- ❌ Git files (`.git/`)
- ❌ Temporary files (`.cache/`, `tmp/`, etc.)

### Sync Priority
- **Immediate**: Critical config files (package.json, tsconfig.json, etc.)
- **Batched**: Regular source files (synced every 30 seconds or 10 files)

### File Restoration
When a new sandbox starts:
1. Downloads existing files from R2
2. Compares local vs remote file hashes
3. Restores only changed/missing files
4. Runs `npm install` if package.json was restored

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Input    │    │   File Changes  │    │   R2 Storage    │
│                 │    │                 │    │                 │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Convex      │───▶│ Sandbox Worker  │───▶│   Sync Queue    │
│   Database      │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                      │
         │                      ▼
         │              ┌─────────────────┐
         └──────────────│  Claude Code    │
                        │                 │
                        └─────────────────┘
```

## Development

### Project Structure
```
src/
├── index.ts          # Main worker entry point
└── sync/
    ├── file-sync.ts   # Main sync orchestrator
    ├── r2-client.ts   # R2/S3 client wrapper
    ├── file-watcher.ts # File system watcher
    └── sync-queue.ts  # Batched upload queue
```

### Adding New File Patterns

To modify which files get synced, edit the patterns in `file-watcher.ts`:

```typescript
// Files to ignore completely
private static readonly DEFAULT_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  // Add your patterns here
];

// Files that sync immediately (high priority)
private static readonly DEFAULT_IMMEDIATE_PATTERNS = [
  "**/package.json",
  "**/tsconfig.json",
  // Add your patterns here
];
```

### Monitoring

The worker logs detailed information about:
- File sync operations
- Claude Code query processing
- Error handling and retries
- Queue status and statistics

## Troubleshooting

### File Sync Issues
1. Check R2 credentials and bucket permissions
2. Verify the bucket exists and is accessible
3. Check worker logs for sync errors
4. Ensure adequate disk space in sandbox

### Performance Tuning
- Adjust `R2_BATCH_SIZE` to control upload batch size
- Modify `R2_BATCH_INTERVAL` to change sync frequency
- Increase `R2_MAX_RETRIES` for unreliable networks

### Common Patterns to Ignore
Add these to your ignore patterns if needed:
```typescript
"**/coverage/**",     // Test coverage reports
"**/logs/**",         // Application logs
"**/*.log",           // Individual log files
"**/tmp/**",          // Temporary directories
"**/.env*",           // Environment files (security)
```