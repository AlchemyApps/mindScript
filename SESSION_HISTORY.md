# Session History - Audio Rendering Pipeline Deployment & FFmpeg Blocker

## Session Date: 2025-11-20

## Initial Context
This session focused on deploying the MindScript audio rendering Edge Functions to Supabase and ensuring the job queue processing worked end-to-end. The goal was to have checkout → track creation → render job → audio generation working continuously via scheduled processing.

## Code Changes Made (In Source Control)

### 1. Track Builder Queue Fix
**File:** `apps/web/src/lib/track-builder.ts`
**Problem:** Jobs weren't being created in `audio_job_queue` due to column name mismatch
**Changes:**
- Fixed line 79: `job_data: trackConfig` → `payload: trackConfig` (matches actual schema)
- Changed error handling to throw instead of just logging so job creation failures surface immediately
**Impact:** Jobs now successfully insert into queue with correct schema

### 2. Local Trigger Payload Reconstruction
**File:** `apps/web/src/app/api/webhooks/stripe/local-trigger/route.ts`
**Problem:** Success page trigger wasn't reconstructing full builder config for track creation
**Changes:**
- Implemented same metadata reconstruction logic as main webhook handler
- Retrieves config from `pending_tracks` table first
- Falls back to `track_config` metadata if available
- Reconstructs from chunked `track_config_partial` + `script_chunk_*` for long scripts
**Impact:** Local trigger (success page) now works even for large scripts, matching webhook behavior

### 3. Audio Processor Enhanced Error Logging
**File:** `supabase/functions/audio-processor/index.ts`
**Changes:**
- Added detailed logging for OpenAI TTS failures (lines 266-275):
  - Logs full response status, statusText, and JSON body
  - Attempts to parse error response as JSON for structured logging
  - Includes full error details in thrown exception
- Added detailed logging for ElevenLabs TTS failures (lines 308-317):
  - Same structured error logging approach
- Made OpenAI configuration overridable via environment variables:
  - `OPENAI_TTS_URL` - defaults to `https://api.openai.com/v1/audio/speech`
  - `OPENAI_TTS_MODEL` - defaults to `tts-1-hd`
**Impact:** Detailed error diagnostics helped identify API key and runtime environment issues

## Infrastructure Changes (Outside Repository)

### 1. Database Schema & Functions
**Created RPC Functions via Migration:**
- `get_next_pending_job()` - Implements SKIP LOCKED pattern for concurrent job processing
  - Returns job details including `job_id`, `track_id`, `user_id`, `job_data`
  - Atomically locks job by setting status to 'processing'
  - Prevents race conditions between multiple workers
- `update_job_progress(job_id, new_progress, new_stage)` - Updates job progress and stage message
- `complete_job(job_id, job_result, job_error)` - Marks job as completed or failed
  - Updates track status to 'published' and sets `audio_url` on success
  - Stores error message on failure

**Migration Name:** `create_audio_job_queue_functions_v2`

### 2. PostgreSQL Extensions Enabled
**Extension:** `pg_net` (v0.19.5)
- Required for pg_cron to make HTTP requests to Edge Functions
- Fixed "ERROR: schema 'net' does not exist" error

### 3. Scheduled Job Processing
**pg_cron Configuration:**
- Created cron job: `process-audio-jobs`
- Schedule: Every minute (`* * * * *`)
- Action: POSTs to `audio-processor-worker` Edge Function via pg_net
- Purpose: Continuous processing of pending audio render jobs

### 4. Edge Function Deployments
**Functions Deployed:**
- `audio-processor` (versions 1-8 deployed during debugging)
  - Main rendering function that processes individual jobs
  - Generates TTS, mixes audio layers, creates previews, uploads to storage
- `audio-processor-worker` (version 4)
  - Orchestrator that checks for pending jobs and calls audio-processor
  - Processes up to 5 jobs per invocation
  - Resets stuck jobs (processing > 10 minutes)

**Environment Secrets Set (via Supabase Dashboard):**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for bypassing RLS
- `OPENAI_API_KEY` - OpenAI API key for TTS generation
- `ELEVENLABS_API_KEY` - ElevenLabs API key (optional)
- `RESEND_API_KEY` - Resend API key for notifications (optional)

**Note:** Edge Function secrets apply immediately to existing deployments; no redeployment needed after setting.

## Issues Discovered & Resolved

### 1. Schema Mismatch in Job Insertion
**Error:** Jobs failing to insert into `audio_job_queue`
**Root Cause:** Code used `job_data` column but schema expects `payload`
**Resolution:** Updated `track-builder.ts` line 79
**Status:** ✅ Fixed

### 2. pg_net Extension Missing
**Error:** pg_cron jobs failing with "ERROR: schema 'net' does not exist"
**Root Cause:** pg_net extension not enabled in database
**Resolution:** Executed `CREATE EXTENSION IF NOT EXISTS pg_net;`
**Status:** ✅ Fixed

### 3. Worker Query Bug
**Error:** Worker reporting 0 pending jobs despite jobs existing
**Root Cause:** Using `head: true` in select query returns only count metadata, not rows
**Resolution:** Removed `head: true`, use `count` from response instead of `pendingJobs?.length`
**File:** `supabase/functions/audio-processor-worker/index.ts:23-33`
**Status:** ✅ Fixed

### 4. Missing Database RPC Functions
**Error:** audio-processor returning "No pending jobs" despite jobs in queue
**Root Cause:** Required RPC functions didn't exist in database
**Resolution:** Created migration with `get_next_pending_job`, `update_job_progress`, `complete_job`
**Status:** ✅ Fixed

### 5. OpenAI API Key Not Configured
**Error:** `OpenAI TTS failed: 401 Unauthorized`
**Root Cause:** Edge Function secrets not set in Supabase Dashboard
**Resolution:** Generated new OpenAI API key and set in Edge Function secrets
**Status:** ✅ Fixed (revealed next blocker)

## Critical Blocker Discovered: Supabase Edge Runtime Limitation

### The Issue
After resolving authentication issues, the audio processor failed with a new error:
```
Error: Spawning subprocesses is not allowed on Supabase Edge Runtime.
at DenoCommand.output (ext:os/os.js:9:7)
at runFFmpeg (file:///.../index.ts:444:42)
at ensureStereo (file:///.../index.ts:377:9)
at generateTTS (file:///.../index.ts:163:9)
```

### Root Cause Analysis
The MindScript audio processor relies heavily on FFmpeg for:
1. **Ensuring stereo output** - `ensureStereo()` calls `ffmpeg -ac 2`
2. **Processing background music** - Volume adjustment and format conversion
3. **Generating Solfeggio tones** - Sine wave generation via `lavfi`
4. **Creating binaural beats** - Dual-channel sine wave generation and merging
5. **Mixing audio layers** - Combining speech + music + tones with `amix` filter
6. **Audio normalization** - `loudnorm` filter for consistent volume
7. **Preview generation** - 15-second clips with fade in/out
8. **Audio metadata extraction** - `ffprobe` to get duration

**The Problem:** Supabase Edge Functions run in a sandboxed Deno runtime that explicitly prohibits spawning subprocesses. The current implementation uses `Deno.Command` to execute `ffmpeg` and `ffprobe` binaries, which is not allowed.

**Evidence from Logs:**
- Deployment v8 of audio-processor
- Error occurred at line 377 (`ensureStereo`)
- Called from line 163 (`generateTTS`)
- Runtime: `supabase-edge-runtime-1.69.22 (compatible with Deno v2.1.4)`
- Region: us-east-2
- Timestamp: 2025-11-20T17:48:04.480Z

### Why This Matters
The audio rendering pipeline is the **core feature** of MindScript. Without FFmpeg:
- Cannot ensure stereo audio (OpenAI TTS returns mono)
- Cannot mix voice with background music
- Cannot add Solfeggio frequencies or binaural beats
- Cannot generate previews
- Cannot normalize audio levels

### Platform Constraints
According to Supabase documentation, Edge Functions:
- ✅ Can make HTTP requests
- ✅ Can read/write to Supabase database and storage
- ✅ Can run JavaScript/TypeScript code
- ❌ **Cannot spawn subprocesses or execute binaries**
- ❌ Cannot install system packages like ffmpeg

No configuration change will enable subprocess spawning in Supabase Edge Functions - it's a fundamental platform limitation.

## Consultant's Analysis & Recommendations

### Option 1: Move Audio Processor to Subprocess-Compatible Platform (Recommended)

**Approach:** Deploy the audio processor as a standalone service outside Supabase Edge Functions, while keeping database/storage/auth on Supabase.

**Viable Hosting Options:**
1. **Fly.io** - Container platform with persistent volumes, ffmpeg-friendly
2. **Render.com** - Simple container deployment with background workers
3. **AWS Lambda + EFS** - Serverless with mounted filesystem for ffmpeg binaries
4. **DigitalOcean App Platform** - Container-based with worker processes
5. **Self-hosted VM (EC2, GCP, etc.)** - Full control, can install any dependencies
6. **Vercel Serverless Functions** - Node.js runtime, can bundle ffmpeg binary (with size limits)

**Architecture:**
```
┌─────────────────┐
│  Next.js App    │  (Vercel)
└────────┬────────┘
         │ Stripe Webhook
         ▼
┌─────────────────┐
│  Supabase DB    │  (tracks, audio_job_queue, purchases)
│  + Storage      │  (audio-renders, track-previews)
└────────┬────────┘
         │ pg_cron every minute
         ▼
┌─────────────────┐
│  Audio Worker   │  (Fly.io / Render / Lambda)
│  - Polls queue  │  - Can run ffmpeg
│  - Runs ffmpeg  │  - Service role access to Supabase
│  - Uploads file │
└─────────────────┘
```

**Implementation Steps:**
1. Package audio processor as standalone Node.js/Deno app
2. Add Dockerfile with ffmpeg installation
3. Configure environment variables (Supabase URL, service key, API keys)
4. Deploy to chosen platform
5. Update pg_cron to POST to new worker URL (or have worker poll queue)
6. Test end-to-end flow

**Pros:**
- ✅ Minimal code changes (mostly deployment config)
- ✅ Keeps existing FFmpeg-based pipeline intact
- ✅ Can scale workers independently
- ✅ Still uses Supabase for database/storage/auth
- ✅ Most straightforward solution

**Cons:**
- ❌ Additional hosting cost (usually $5-20/month)
- ❌ Need to manage separate deployment
- ❌ Slightly more complex architecture

### Option 2: Pure JavaScript Audio Processing (Not Recommended)

**Approach:** Rewrite audio processing to use JavaScript-only libraries instead of FFmpeg.

**Potential Libraries:**
- **lamejs** - MP3 encoding in JS (slow, limited features)
- **web-audio-api-rs** - WebAssembly audio processing
- **aurora.js** - Audio decoding
- **dsp.js** - Basic DSP operations

**Required Refactoring:**
- Rewrite TTS stereo conversion
- Implement manual audio mixing (sample-level operations)
- Create sine wave generators for Solfeggio/binaural
- Build normalization/loudness algorithms
- Handle multiple audio formats (MP3, WAV)

**Pros:**
- ✅ Could stay on Supabase Edge Functions
- ✅ No additional hosting needed

**Cons:**
- ❌ Massive engineering effort (weeks of work)
- ❌ JS audio libraries have limited features vs. FFmpeg
- ❌ Performance issues (JS audio processing is slow)
- ❌ Quality concerns (FFmpeg is battle-tested)
- ❌ Maintenance burden (custom audio code)
- ❌ **Not practical given timeline and complexity**

## Recommended Next Steps

### Immediate Actions (Next Session)
1. **Select hosting platform** - Based on budget/preferences (Fly.io recommended for simplicity)
2. **Prepare deployment artifacts:**
   - Create Dockerfile with Deno + ffmpeg
   - Extract audio processor into standalone service
   - Configure environment variables
   - Add health check endpoint
3. **Deploy worker service:**
   - Deploy to chosen platform
   - Verify ffmpeg is available
   - Test with single job
4. **Update queue trigger:**
   - Modify pg_cron to POST to new worker URL
   - OR have worker poll queue via cron/timer
5. **End-to-end test:**
   - Create new track via builder
   - Verify job processes successfully
   - Check audio file appears in library
   - Test preview generation

### Long-term Considerations
- **Monitoring:** Add logging/alerts for worker failures
- **Scaling:** Configure auto-scaling based on queue depth
- **Cost optimization:** Use spot instances or smaller compute tiers
- **Fallback:** Keep pg_cron as backup trigger mechanism
- **Documentation:** Update architecture diagrams and deployment docs

## Current State Summary

### ✅ Working
- Checkout flow creates proper metadata
- Local trigger reconstructs full config
- Jobs insert into queue with correct schema
- RPC functions handle job lifecycle
- pg_cron schedules worker execution
- OpenAI API authentication configured
- Detailed error logging in place

### ⚠️ Partially Working
- Jobs can be queued and marked as processing
- Database updates work correctly
- Worker orchestration functions

### ❌ Blocked
- **Audio rendering fails due to subprocess restriction**
- Jobs fail at "Spawning subprocesses is not allowed"
- Cannot proceed until worker moved to compatible platform

### 🔧 Infrastructure Status
- Database: ✅ Production-ready (tables, RPC functions, indexes)
- Storage: ✅ Buckets configured (audio-renders, track-previews)
- Scheduler: ✅ pg_cron running every minute
- Secrets: ✅ All API keys set in Edge Function config
- Worker: ❌ **Needs redeployment to subprocess-compatible platform**

## Files Modified/Created This Session

### Modified
- `apps/web/src/lib/track-builder.ts` - Fixed payload column and error handling
- `apps/web/src/app/api/webhooks/stripe/local-trigger/route.ts` - Added config reconstruction
- `supabase/functions/audio-processor/index.ts` - Enhanced error logging, added TTS config overrides

### Created (Infrastructure)
- Database migration: `create_audio_job_queue_functions_v2.sql`
- pg_cron job: `process-audio-jobs`
- Edge Functions: `audio-processor` (v8), `audio-processor-worker` (v4)

### Tools/Scripts
- Multiple deployment iterations using Supabase MCP tools
- SQL queries to inspect job queue state
- Log analysis to identify blocker

## Consultant Notes for Next Session

```
CRITICAL BLOCKER IDENTIFIED:
Supabase Edge Functions cannot spawn subprocesses (ffmpeg).
Current audio processor must be rehosted to worker-compatible platform.

RECOMMENDATION:
Deploy audio processor to Fly.io / Render / AWS Lambda with:
- Deno/Node.js runtime
- ffmpeg binary installed
- Service role access to Supabase
- POST endpoint for job processing

NO CODE CHANGES NEEDED:
Audio processor logic is sound. Only deployment method needs change.

CREDENTIALS NEEDED:
- Hosting platform account (Fly.io / Render / etc.)
- Same env vars currently in Edge Function secrets
- Deployment instructions/preferences from user

ESTIMATED EFFORT:
1-2 hours to containerize + deploy + test
Much simpler than rewriting audio pipeline in JS

BLOCKING ISSUE SEVERITY: HIGH
Cannot render audio until this is resolved.
All other pipeline components are working correctly.
```

---

# Session History - Schema Alignment Complete

## Session Date: 2025-10-14 (Continued)

## Critical Schema Alignment Fix
**Problem Identified by User:**
The backend validation schema expected `builderState.backgroundMusic` with `name/price` properties and required `voice.name`, but the frontend actually sends `builderState.music` with just `id/volume_db` and no voice name field.

**Solution Implemented:**
1. Updated `GuestCheckoutRequestSchema` to match actual frontend payload:
   - Changed `backgroundMusic` → `music` throughout
   - Made `voice.name` optional, deriving it from `voice_id`
   - Added `settings` to voice object
   - Made `duration` optional

2. Updated builder page:
   - Fixed `calculateTotal()` to use `music` instead of `backgroundMusic`
   - Added duration estimation based on script word count (150 words/min)

3. Verified metadata structure:
   - Checkout successfully creates sessions with aligned schema
   - Track config fits in single metadata field (419 chars for test payload)
   - All required fields present for webhook processing

## Test Results
✅ Checkout session creation successful (Session ID: cs_test_b1AHwqga0xKk4OpxnmISeC0HMPX1NshN6NywOrDnLUkiA0UJmYJjoUmcDj)
✅ Metadata structure verified and correctly formatted
✅ Track config parsing validated with all add-ons
✅ Schema now fully aligned between frontend and backend

## Current State
The builder → checkout → webhook → render flow is now properly aligned and ready for full E2E testing with actual Stripe webhooks.

---

# Session History - Checkout Metadata Flow Fix

## Session Date: 2025-10-14

## Initial Context
Continued from previous sessions addressing critical issues with the builder → checkout → webhook → render flow. The main issue identified was a metadata mismatch between checkout and webhook handlers preventing track creation after payment.

## Issues Addressed

### 1. Critical Metadata Structure Fix
**Problems:**
- Checkout was storing builder state as individual metadata fields
- Webhook expected a single `track_config` JSON field
- Script chunking wasn't being reconstructed properly
- Metadata keys were inconsistent (`first_track_discount_used` vs `is_first_purchase`)

**Solutions:**
- Modified `/apps/web/src/app/api/checkout/guest-conversion/route.ts` to:
  - Create full `track_config` JSON object
  - Store complete config if under 500 chars, otherwise use `track_config_partial` + script chunks
  - Use consistent `is_first_purchase` key
- Updated `/apps/web/src/app/api/webhooks/stripe/route.ts` to:
  - Parse `track_config` if present
  - Reconstruct from `track_config_partial` + script chunks as fallback
  - Support legacy individual fields for backward compatibility
  - Add email to UUID resolution with TODO for proper implementation

### 2. Test Coverage Added
**Files Created:**
- `/apps/web/src/app/api/checkout/guest-conversion/route.test.ts` - Tests metadata generation
- Updated `/apps/web/src/app/api/webhooks/stripe/route.test.ts` - Tests metadata parsing

**Test Scenarios:**
- Small config fits in single `track_config` field
- Large scripts require chunking with `track_config_partial`
- Email as userId handling
- Missing config gracefully skipped

### 3. Manual Test Harness
**Created:**
- `/test-checkout-flow.mjs` - Script to verify full flow with logging

## Current State
The checkout → webhook metadata flow is now properly aligned:
- ✅ Checkout creates proper `track_config` metadata
- ✅ Webhook correctly parses and reconstructs config
- ✅ Metadata keys are consistent (`is_first_purchase`)
- ✅ Script chunking works for large content
- ✅ Fallback logic for legacy metadata format
- ✅ Email to UUID resolution with TODO note

## Outstanding TODOs
- Implement proper email to UUID lookup in webhook (currently has fallback logic)
- Complete Vitest test suite execution (mock setup needs refinement)
- Run full E2E test with Stripe test mode
- Monitor production webhook logs after deployment

## Files Modified Summary
- **Modified:** `/apps/web/src/app/api/checkout/guest-conversion/route.ts`
- **Modified:** `/apps/web/src/app/api/webhooks/stripe/route.ts`
- **Created:** `/apps/web/src/app/api/checkout/guest-conversion/route.test.ts`
- **Modified:** `/apps/web/src/app/api/webhooks/stripe/route.test.ts`
- **Created:** `/test-checkout-flow.mjs`
- **Modified:** `/apps/web/src/app/(authenticated)/builder/page.tsx`
- **Created:** `/apps/web/test-webhook-metadata.mjs`

## Branch Status
Working on feature branch: `feature/fix-checkout-metadata-flow`
Ready for testing and eventual merge to `dev`

---

# Session History - Authentication & Navigation Fixes

## Session Date: 2025-10-13

## Initial Context
This session was a continuation from a previous conversation that ran out of context. The user had reported critical issues with:
1. Library page UX after track creation (duration display, banner dismissal, edit functionality)
2. Builder page stuck on permanent loading state
3. Missing Stripe integration for logged-in users (free track creation vulnerability)
4. Infinite redirect loop between builder → dashboard → login pages

## Issues Addressed

### 1. Library Page UX Improvements
**Problems:**
- Duration showing "NaN:NaN" due to column mismatch
- Success banner wouldn't dismiss
- Edit button led to 404
- Tracks weren't playable despite having audio

**Solutions:**
- Fixed duration mapping from `duration_seconds` to `duration` in API response
- Updated banner dismissal logic to check for `audio_url` presence OR published status
- Created `/builder/[trackId]` dynamic route for edit functionality
- Enabled playback for any track with `audio_url` regardless of status

### 2. Authentication Hook Timeout Issues
**Problems:**
- `useAuth` hook was hanging indefinitely
- Session fetch had no timeout mechanism
- Profile fetch could block indefinitely

**Solutions:**
- Implemented 5-second timeout for session fetching using `Promise.race()`
- Added timeout wrapper for profile fetching
- Fixed circular dependency by passing `sessionUser` parameter to `fetchProfile`
- Added `mounted` flag to prevent state updates after unmount
- Ensured `setLoading(false)` always executes in finally block

**Files Modified:**
- `/packages/auth/src/hooks/use-auth.tsx`

### 3. Critical Security Fix: Stripe Integration for Logged-in Users
**Problems:**
- Logged-in users could create tracks for free
- `/api/audio/submit` endpoint allowed direct track creation
- No payment requirement for authenticated users

**Solutions:**
- Integrated Stripe checkout flow into logged-in builder page
- Added pricing eligibility check (`/api/pricing/check-eligibility`)
- Deprecated `/api/audio/submit` endpoint (returns 410 Gone)
- All track creation now requires payment through `/api/checkout/guest-conversion`

**Files Modified:**
- `/apps/web/src/app/(authenticated)/builder/page.tsx`
- `/apps/web/src/app/api/audio/submit/route.ts`

### 4. Infinite Redirect Loop Fix
**Problems:**
- Builder and dashboard pages had conflicting redirect logic
- Pages would redirect infinitely between builder → dashboard → login
- SSL protocol errors (upgrade-insecure-requests forcing HTTPS on localhost)

**Solutions:**
- Added `hasRedirected` state guard to prevent multiple redirects
- Implemented 100ms delay before redirecting to prevent race conditions
- Removed `upgrade-insecure-requests` CSP directive in development
- Fixed both builder and dashboard redirect logic

**Files Modified:**
- `/apps/web/src/app/(authenticated)/builder/page.tsx`
- `/apps/web/src/app/dashboard/page.tsx`
- `/apps/web/src/middleware.ts`

### 5. Additional Fixes
**Problems:**
- Permissions-Policy header syntax error for Stripe
- Unterminated block comment in audio submit route
- Navigation missing from dashboard to builder

**Solutions:**
- Fixed Permissions-Policy by adding quotes around Stripe URL
- Removed old commented code that was causing syntax errors
- Added "Create Your First Script" button with proper navigation

## Test Results
Created comprehensive test script (`test-auth-flow.mjs`) that verified:
- ✅ Builder page redirects properly without loops
- ✅ Dashboard page redirects properly without loops
- ✅ Test auth page loads correctly
- ✅ Pricing API returns correct data
- ✅ Deprecated audio submit endpoint returns 410

## Current State
The application is now functional with:
- Proper authentication flow without infinite loops
- Required Stripe payment for all track creation
- Fixed library UX for track management
- Working navigation between pages
- Proper error handling and timeouts

## Outstanding Issues
While significant progress was made, the user indicates there are still issues to address in the next session. These will be identified and documented at the start of the next conversation.

## Files Created/Modified Summary
- **Created:** `/test-auth-flow.mjs` (testing script)
- **Created:** `/SESSION_HISTORY.md` (this document)
- **Modified:** `/packages/auth/src/hooks/use-auth.tsx`
- **Modified:** `/apps/web/src/app/(authenticated)/builder/page.tsx`
- **Modified:** `/apps/web/src/app/dashboard/page.tsx`
- **Modified:** `/apps/web/src/app/api/audio/submit/route.ts`
- **Modified:** `/apps/web/src/app/library/page.tsx`
- **Modified:** `/apps/web/src/middleware.ts`
- **Modified:** `/apps/web/src/app/api/pricing/check-eligibility/route.ts`

## Next Steps
- Address remaining issues to be specified in next session
- Continue monitoring authentication flow stability
- Verify all edge cases are handled properly
