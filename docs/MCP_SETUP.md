# MindScript MCP Server Setup Guide

## Overview
This guide documents the setup and configuration of MCP (Model Context Protocol) servers for the MindScript project, including Supabase (dev/prod) and Stripe integrations.

## Prerequisites
- Node.js version 22+ installed
- `npx` available in PATH
- Supabase Personal Access Tokens (PATs)
- Claude Code CLI installed

## Initial Setup

### 1. Rotate Any Exposed Credentials (CRITICAL)
If any credentials have been exposed in logs or configs:

1. **Supabase PATs**:
   - Go to https://supabase.com/dashboard/account/tokens
   - Delete any compromised tokens
   - Create new tokens:
     - "MindScript MCP Dev" for development
     - "MindScript MCP Prod" for production

2. **Stripe** (if using local mode):
   - Go to https://dashboard.stripe.com/test/apikeys
   - Roll/regenerate your test secret key

### 2. Configuration Structure
The MCP configuration is stored in `.mcp.json` in the PROJECT ROOT directory (not in `.claude/`).

Current configuration uses environment variable expansion for security:
- `${SUPABASE_DEV_REF}` - Development project reference
- `${SUPABASE_PROD_REF}` - Production project reference
- `${SUPABASE_PAT}` - Development Personal Access Token
- `${SUPABASE_PAT_PROD}` - Production Personal Access Token

### 3. Set Environment Variables

#### macOS/Linux:
```bash
# Edit mcp-env.sh with your actual tokens
nano mcp-env.sh

# Source the environment
source mcp-env.sh

# Start Claude Code
claude
```

#### Windows PowerShell:
```powershell
# Edit mcp-env.ps1 with your actual tokens
notepad mcp-env.ps1

# Source the environment
. .\mcp-env.ps1

# Start Claude Code
claude
```

### 4. Verify Setup
After starting Claude Code with environment variables set:

1. Run `/mcp` command to check server status
2. All three servers should show as connected:
   - supabase-dev
   - supabase-prod
   - stripe-remote

## Testing the Servers

### Test Supabase Dev (Write Access)
```sql
-- Should succeed
CREATE TABLE mcp_test (id SERIAL PRIMARY KEY);
INSERT INTO mcp_test DEFAULT VALUES RETURNING id;
DROP TABLE mcp_test;
```

### Test Supabase Prod (Read-Only)
```sql
-- Should fail with read-only error
INSERT INTO any_table DEFAULT VALUES;
```

### Test Stripe (OAuth)
1. First use will trigger OAuth consent in browser
2. Sign in with your Stripe account
3. Test with: `list_products`

## Security Best Practices

### DO:
- ✅ Use environment variables for secrets
- ✅ Keep `.mcp.json` with variable references only
- ✅ Add `mcp-env.sh` to `.gitignore`
- ✅ Rotate tokens regularly
- ✅ Use read-only mode for production
- ✅ Use Stripe OAuth instead of API keys when possible

### DON'T:
- ❌ Hardcode secrets in `.mcp.json`
- ❌ Commit `mcp-env.sh` with real tokens
- ❌ Share Personal Access Tokens
- ❌ Use service role keys in MCP (use PATs instead)
- ❌ Remove `--read-only` from production

## Troubleshooting

### "Unauthorized" Error
- Ensure environment variables are set before starting Claude Code
- Verify PAT is valid and not expired
- Check token has correct permissions

### "Read-only transaction" Error
- This is expected on production (safety feature)
- For dev: ensure `--read-only` flag is removed
- Check if Supabase project hit disk/billing limits

### MCP Not Detected
- Ensure `.mcp.json` is in project root
- Restart Claude Code completely
- Run with debug: `claude --debug`
- Check logs: `~/.claude/logs/mcp-*.log`

### Windows Issues
- May need to modify `.mcp.json`:
  ```json
  "command": "cmd",
  "args": ["/c", "npx", ...]
  ```

### Node/NPX Issues
- Verify Node version: `node -v` (needs 22+)
- Ensure npx is in PATH: `which npx` or `where npx`

## Alternative Setup Methods

### CLI Local Scope (Most Secure)
If environment variable expansion fails:

```bash
# Remove existing configs
claude mcp remove supabase-dev
claude mcp remove supabase-prod
claude mcp remove stripe

# Add with secrets via CLI
claude mcp add supabase-dev -s local \
  -e SUPABASE_ACCESS_TOKEN="sbp_YOUR_TOKEN" \
  -- npx -y @supabase/mcp-server-supabase@latest \
  --project-ref="byicqjniboevzbhbfxui"

claude mcp add supabase-prod -s local \
  -e SUPABASE_ACCESS_TOKEN="sbp_YOUR_PROD_TOKEN" \
  -- npx -y @supabase/mcp-server-supabase@latest \
  --read-only --project-ref="uykxlvsqbfnfhrgcpnvn"

claude mcp add stripe-remote -s local \
  -- url https://mcp.stripe.com
```

### MCP Inspector
For debugging MCP connections:
```bash
npx @modelcontextprotocol/inspector
```

## Configuration Details

### Supabase MCP Features
- `database` - SQL operations
- `development` - Dev-specific tools
- `functions` - Edge function management
- `storage` - File storage operations

### Key Differences: Dev vs Prod
- **Dev**: No `--read-only` flag, full write access
- **Prod**: `--read-only` flag enabled, prevents destructive operations
- Both use separate PATs for isolation

### Stripe OAuth Benefits
- No API key management
- Automatic token refresh
- Granular permissions via Stripe Dashboard
- Audit trail in Stripe Apps

## Project References
- Dev Project: `byicqjniboevzbhbfxui`
- Prod Project: `uykxlvsqbfnfhrgcpnvn`
- Supabase Dashboard: https://supabase.com/dashboard
- Stripe Dashboard: https://dashboard.stripe.com

## Support
For MCP-specific issues:
- Claude Code GitHub: https://github.com/anthropics/claude-code/issues
- Supabase MCP: https://github.com/supabase/mcp-server-supabase
- Stripe MCP: https://docs.stripe.com/mcp