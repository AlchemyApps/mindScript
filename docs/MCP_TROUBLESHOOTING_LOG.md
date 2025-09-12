# MCP Troubleshooting Log - September 12, 2025

## Current Status (as of 1:11 PM)
- ✅ supabase-dev: connected
- ✅ supabase-prod: connected  
- ❌ supabase: failed (UNWANTED - generic server still exists)
- ❌ stripe: failed (should be stripe-remote with OAuth)
- ❌ sentry: failed

## Configuration Locations Found
According to the /mcp output, there are THREE config locations:
1. **User config**: `/Users/chrisschrade/.claude.json` ⚠️ NOT YET CHECKED
2. **Project config**: `/Users/chrisschrade/development/mindScript/.mcp.json` ✅ UPDATED
3. **Local config**: `/Users/chrisschrade/.claude.json [project: /Users/chrisschrade/development/mindScript]`

## Actions Taken So Far

### 1. Updated Project .mcp.json (✅ COMPLETED)
**File**: `/Users/chrisschrade/development/mindScript/.mcp.json`
**Changes**:
- Removed `--read-only` flag from supabase-dev
- Kept `--read-only` flag for supabase-prod
- Added `@latest` version specifier
- Added `--features` flags
- Changed to environment variable expansion: `${SUPABASE_PAT}`, etc.
- Changed stripe to stripe-remote with OAuth URL

### 2. Removed Claude Desktop Config (✅ COMPLETED)
**File**: `~/.claude/claude_desktop_config.json`
**Action**: Renamed to `.backup`
**Issue**: This file had old hardcoded tokens and wrong configuration

### 3. Created Environment Scripts (✅ COMPLETED)
- Created `mcp-env.sh` for Unix/macOS
- Created `mcp-env.ps1` for Windows
- Added both to .gitignore

### 4. Security Updates (✅ COMPLETED)
- Added `.mcp.json.local` and `mcp-env.sh` to .gitignore
- Documented need to rotate exposed credentials

## REMAINING ISSUES TO FIX

### 1. User Config FOUND THE PROBLEM! ⚠️
**File**: `/Users/chrisschrade/.claude.json`
**Issue**: CONFIRMED - Contains MULTIPLE conflicting entries:
- Generic "supabase" server (at least 2 different versions)
- Old "stripe" server (missing --tools=all and OAuth option)
- Using old hardcoded token: `sbp_f4c32b867aae0c25d6346079b83020913f0b2bb3`
**Action Needed**: Remove these entries from the mcpServers object

### 2. Generic "supabase" Server Still Active
**Server Name**: `supabase` (without -dev or -prod suffix)
**Status**: Failed but still showing in list
**Action Needed**: Remove from user config

### 3. Stripe Server Misconfigured
**Current**: `stripe` (trying to use local server with API key)
**Should Be**: `stripe-remote` (OAuth via https://mcp.stripe.com)
**Action Needed**: Update in user config

## FINAL DIAGNOSIS

The issue is that Claude Code is still using cached MCP server configurations from:
1. **~/.claude/claude_desktop_config.json** (now backed up/removed)
2. These servers are NOT in `/Users/chrisschrade/.claude.json` 
3. They appear to be cached in memory from the old config file

## SOLUTION - RESTART REQUIRED

Claude Code needs a COMPLETE restart to clear the cached MCP configurations:

1. **Completely quit Claude Code** (not just close the window)
   ```bash
   # Make sure it's fully terminated
   pkill -f claude || true
   ```

2. **Set your environment variables** (with NEW tokens after rotation):
   ```bash
   # Edit the script first with your new PATs
   nano mcp-env.sh
   
   # Then source it
   source mcp-env.sh
   ```

3. **Start Claude Code fresh**:
   ```bash
   claude
   ```

4. **Verify with `/mcp`** - should now show ONLY:
   - supabase-dev ✅ (from project .mcp.json)
   - supabase-prod ✅ (from project .mcp.json)
   - stripe-remote ✅ (from project .mcp.json)
   - Other valid servers (filesystem, github, etc.)
   - NO generic "supabase" server
   - NO old "stripe" server

## What We Fixed

1. ✅ Removed `~/.claude/claude_desktop_config.json` (had old configs with hardcoded tokens)
2. ✅ Updated project `.mcp.json` with proper configuration
3. ✅ Created environment scripts for secure token management
4. ⏳ Waiting for restart to clear cached configurations

## Next Steps (TO DO AFTER RESTART)

1. **Check User Config**:
   ```bash
   cat /Users/chrisschrade/.claude.json
   ```

2. **Remove Generic Servers from User Config**:
   - Remove "supabase" entry (keep only supabase-dev and supabase-prod)
   - Remove or update "stripe" to "stripe-remote"

3. **Set Environment Variables**:
   ```bash
   source mcp-env.sh  # After adding your new PATs
   ```

4. **Full Restart**:
   ```bash
   # Completely quit Claude Code
   # Then restart with:
   claude
   ```

5. **Verify with /mcp**:
   Should show only:
   - supabase-dev ✅
   - supabase-prod ✅
   - stripe-remote ✅
   - (other valid servers like filesystem, github, etc.)

## Configuration Priority Order
Based on the /mcp output, configs are loaded in this order:
1. Local config (project-specific)
2. Project config (.mcp.json)
3. User config (~/.claude.json)

## Expert Advice Applied
From the two third-party consultations:
- ✅ Removed --read-only from dev
- ✅ Kept --read-only for prod
- ✅ Using PATs not service keys
- ✅ Using environment variable expansion
- ✅ Using Stripe OAuth instead of API keys
- ✅ Added @latest version specifier
- ⚠️ Still need to remove conflicting user config entries

## Common Issues & Solutions
1. **"Unauthorized" Error**: Environment variables not set before starting Claude
2. **"Read-only transaction" Error**: Expected on prod, wrong on dev
3. **Multiple configs**: User config can override project config
4. **Generic "supabase" server**: Must be removed from ALL config locations

## Files Modified
1. `/Users/chrisschrade/development/mindScript/.mcp.json` - Updated with proper config
2. `~/.claude/claude_desktop_config.json` - Backed up (renamed)
3. `/Users/chrisschrade/development/mindScript/.gitignore` - Added MCP files
4. Created: `mcp-env.sh`, `mcp-env.ps1`, `docs/MCP_SETUP.md`

## Credentials Status
⚠️ **URGENT**: The following tokens were exposed and need rotation:
- Supabase Dev PAT: `sbp_ec7832b4df757394b2795a480b38fd8ee377b742`
- Supabase Prod PAT: `sbp_94bb672c6f380866e71410574be8580513a4f153`
- Stripe Test Key: `sk_test_51Py91NF91eBZ5qduJgcAWJz66XSBjTJ3AaasNBZWaOo4rV6n046SnsFITioyV2jnLU3DygEVl3WvSLjecb9TXXpe00kb7PQZsL`

## Debug Commands
```bash
# Check all config files
cat /Users/chrisschrade/.claude.json
cat /Users/chrisschrade/development/mindScript/.mcp.json

# Debug mode
claude --debug

# Check logs
ls -la ~/.claude/logs/mcp-*.log
tail -f ~/.claude/logs/mcp-*.log

# MCP Inspector
npx @modelcontextprotocol/inspector
```

## Success Criteria
After all fixes, `/mcp` should show:
- ✅ No generic "supabase" server
- ✅ supabase-dev: connected (write access)
- ✅ supabase-prod: connected (read-only)
- ✅ stripe-remote: connected (OAuth)
- ✅ No failed MCP servers related to our setup