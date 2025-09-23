# Real-time Render Status Updates Testing Guide

## Overview
Real-time updates provide live progress feedback during audio rendering using Supabase Realtime subscriptions.

## Implementation Summary

### 1. Database Setup
- **Table**: `audio_job_queue` with columns:
  - `progress` (0-100)
  - `stage` (text description)
  - `status` (pending/processing/completed/failed)
- **Realtime**: Enabled via migration `20250123_enable_realtime.sql`

### 2. Backend Updates
- **Edge Function**: `audio-processor` calls `updateProgress()` at each stage:
  - 10%: Generating speech from text
  - 30%: Speech generation complete
  - 40%: Background music ready
  - 50%: Generating binaural beats
  - 85%: Audio mixing complete
  - 90%: Preview generated
  - 95%: Finalizing
  - 100%: Complete

### 3. Frontend Subscription
- **Hook**: `useRenderProgress` subscribes to job updates
- **Component**: `RenderProgress` displays real-time status
- **Connection**: Uses Supabase Realtime channels

## Testing Steps

### Manual Testing

1. **Start a Render Job**
   ```bash
   # Navigate to builder
   /builder

   # Fill in:
   - Script: "This is a test meditation"
   - Voice: Select any voice
   - Background music: Optional

   # Click "Publish Track"
   ```

2. **Monitor Progress**
   - Watch the RenderProgress component
   - Progress bar should update in real-time
   - Stage descriptions should change
   - Percentage should increase

3. **Check Database**
   ```sql
   -- Monitor job progress
   SELECT id, status, progress, stage, updated_at
   FROM audio_job_queue
   WHERE track_id = '[YOUR_TRACK_ID]'
   ORDER BY updated_at DESC;
   ```

### Expected Behavior

1. **Initial State**
   - Status: "Preparing"
   - Progress: 0%
   - Stage: "Setting up render job..."

2. **During Render**
   - Live progress updates every 10-20%
   - Stage descriptions match processing step
   - No polling (uses WebSocket)

3. **Completion**
   - Status: "Completed"
   - Progress: 100%
   - Redirect option to library

### Debugging

1. **Check Realtime Connection**
   ```javascript
   // Browser console
   localStorage.getItem('supabase.auth.token')
   // Should show valid auth token
   ```

2. **Monitor WebSocket**
   - Open DevTools → Network → WS
   - Look for `realtime` connection
   - Should see UPDATE events for `audio_job_queue`

3. **Verify Edge Function**
   ```bash
   # Check logs
   npx supabase functions logs audio-processor
   ```

4. **Test Update Manually**
   ```sql
   -- Simulate progress update
   UPDATE audio_job_queue
   SET progress = 50,
       stage = 'Test update',
       updated_at = NOW()
   WHERE id = '[JOB_ID]';
   ```

## Common Issues

### No Updates Received
- Check Realtime is enabled on table
- Verify auth token is valid
- Ensure RLS policies allow SELECT

### Updates Not Smooth
- Edge function may be batching updates
- Check network latency
- Verify WebSocket connection stable

### Progress Stuck
- Check if job failed (status = 'failed')
- Look for error in `error` column
- Review edge function logs

## Integration Points

1. **Track Creation** → Creates job in `audio_job_queue`
2. **Edge Function** → Processes job and updates progress
3. **Realtime** → Broadcasts updates to subscribed clients
4. **React Hook** → Receives updates and updates UI
5. **UI Component** → Displays progress visually

## Success Criteria

✅ Progress updates without polling
✅ Stage descriptions are meaningful
✅ Completion triggers UI update
✅ Errors are handled gracefully
✅ Connection drops are recovered
✅ Multiple simultaneous renders work