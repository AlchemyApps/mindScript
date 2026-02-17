# MindScript Phase 2.2: Audio Engine & Core Features Implementation

## Session Start Instructions

Continue implementing MindScript Phase 2.2: Audio Engine & Core Features

### CRITICAL INSTRUCTIONS:
1. **ARCHON-FIRST**: Check Archon project ID `6d363c98-a135-4919-8171-ee0756a6f1a0` and get next task
2. **USE MCP SERVERS**: Leverage supabase-prod, stripe, filesystem, context7, and other MCPs for integrations
3. **FOLLOW CLAUDE.md**: Strict TypeScript, TDD with Vitest, functional-light style, Zod validation at boundaries
4. **USE SPECIALIZED AGENTS**: Route work through appropriate subagents:
   - `audio-engine-engineer` for audio processing
   - `web-experience-engineer` for UI
   - `schema-rls-architect` for DB changes
   - `payments-payouts-engineer` for Stripe integration
5. **DATABASE SYNC**: Apply ALL migrations to BOTH dev (`byicqjniboevzbhbfxui`) and prod (`tjuvcfiefebtanqlfalk`)

## Current Project Status

### ✅ Completed Phases:
- **Phase 1**: Foundation & Infrastructure (monorepo, packages, CI/CD)
- **Phase 2.1.1**: Authentication database schema with RLS
- **Phase 2.1.2**: Supabase Auth integration with UI
- **Phase 2.1.3**: Auth persistence and middleware
- **Phase 2.1.4**: User Profile Management System

### 🏗️ Infrastructure Ready:
- Turborepo monorepo with apps/web, apps/mobile, packages/*
- Supabase backend with auth, profiles, storage
- Stripe integration scaffolding
- Vitest testing framework
- GitHub Actions CI/CD

## Phase 2.2: Audio Engine & Core Features

### 2.2.1 Audio Engine Foundation
**Task**: Implement the core audio processing pipeline

**Requirements**:
- AudioJob queue system with Supabase Functions or QStash
- FFmpeg integration for audio processing
- TTS integration (ElevenLabs/OpenAI)
- Background music mixing
- Binaural beats generation
- Solfeggio frequencies
- Stereo enforcement (-ac 2)
- Progress tracking and status updates

**Key Components**:
```typescript
// packages/audio-engine/
- src/jobs/AudioJob.ts (queue processor)
- src/processors/TTSProcessor.ts
- src/processors/MusicMixer.ts
- src/processors/BinauralGenerator.ts
- src/processors/SolfeggioGenerator.ts
- src/utils/ffmpeg.ts
- src/utils/storage.ts
```

### 2.2.2 Track Builder UI
**Task**: Create the interactive track builder interface

**Requirements**:
- Drag-and-drop script sections
- Voice selection (TTS providers + uploaded)
- Background music selection
- Binaural/Solfeggio frequency options
- Real-time preview
- Save/load draft tracks
- Publish workflow

**Pages & Components**:
```typescript
// apps/web/src/app/(authenticated)/builder/
- page.tsx (main builder)
- components/ScriptEditor.tsx
- components/VoiceSelector.tsx
- components/MusicSelector.tsx
- components/FrequencyPanel.tsx
- components/PreviewPlayer.tsx
```

### 2.2.3 Media Library
**Task**: Implement the media library for tracks and assets

**Requirements**:
- Track listing with filtering/sorting
- Play/pause/seek controls
- Download options (mp3, wav)
- Share functionality
- Analytics tracking
- Favorites/playlists

**API Routes**:
```typescript
// apps/web/src/app/api/tracks/
- GET /api/tracks (list user tracks)
- POST /api/tracks (create track)
- GET /api/tracks/[id] (get track details)
- PUT /api/tracks/[id] (update track)
- DELETE /api/tracks/[id] (delete track)
- POST /api/tracks/[id]/render (trigger render)
- GET /api/tracks/[id]/download (download track)
```

### 2.2.4 Stripe Payments Integration
**Task**: Implement subscription and credit system

**Requirements**:
- Subscription tiers (Free, Pro, Enterprise)
- Credit-based system for renders
- Stripe Checkout integration
- Webhook handlers for payment events
- Usage tracking and limits
- Invoice generation

**Implementation**:
```typescript
// packages/payments/
- src/stripe/checkout.ts
- src/stripe/webhooks.ts
- src/stripe/subscriptions.ts
- src/credits/manager.ts
- src/limits/enforcer.ts
```

## Development Workflow (MANDATORY)

### For EVERY task:
1. **Get Task from Archon**:
   ```typescript
   archon:get_task(task_id) // Get specific task
   archon:list_tasks(filter_by="status", filter_value="todo") // Or get next todo
   archon:update_task(task_id, status="doing") // Mark as in progress
   ```

2. **Research First**:
   ```typescript
   archon:perform_rag_query("audio processing FFmpeg Node.js best practices")
   archon:search_code_examples("queue processing Supabase Functions")
   ```

3. **Create TodoWrite List**:
   - Break down into atomic subtasks
   - Track progress granularly
   - Update as you work

4. **TDD Implementation**:
   - Write failing Vitest tests first
   - Implement until green
   - Add integration tests

5. **Update Archon**:
   ```typescript
   archon:update_task(task_id, status="review")
   ```

## Key Technical Decisions

### Audio Processing:
- Use FFmpeg for all audio operations
- Stream to disk for large files
- Enforce stereo output (-ac 2)
- Target <60s for 10-min renders
- Use job queue for async processing

### Storage Strategy:
- Supabase Storage for all media
- Public bucket for published tracks
- Private bucket for user uploads
- Signed URLs for secure access
- CDN delivery for performance

### Payment Architecture:
- Stripe Checkout for subscriptions
- Credit ledger in database
- Idempotent webhook processing
- Usage limits enforcement
- RevenueCat ready for mobile IAP

### Testing Requirements:
- Unit tests for all business logic
- Integration tests for API routes
- MSW for external service mocking
- E2E tests for critical flows
- 80% coverage minimum

## Environment Variables Needed

```bash
# Audio Processing
ELEVENLABS_API_KEY=
OPENAI_API_KEY=
FFMPEG_PATH=/usr/local/bin/ffmpeg

# Queue System (choose one)
QSTASH_URL=
QSTASH_TOKEN=
# OR use Supabase Edge Functions

# Storage
SUPABASE_STORAGE_URL=
CDN_URL=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_FREE=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_ENTERPRISE=
```

## Success Metrics

### Performance:
- Track render time < 60s for 10-min audio
- API response time p95 < 400ms
- Storage upload < 10s for 100MB
- UI interactions < 100ms response

### Quality:
- Test coverage > 80%
- Zero critical security issues
- TypeScript strict mode passing
- All RLS policies tested

### User Experience:
- Track builder saves draft every 30s
- Preview available within 5s
- Download starts immediately
- Clear progress indicators

## Agent Routing Guide

### When to use each agent:
- **audio-engine-engineer**: FFmpeg chains, TTS integration, audio processing
- **web-experience-engineer**: React components, Next.js pages, UI/UX
- **schema-rls-architect**: Database migrations, RLS policies, storage setup
- **payments-payouts-engineer**: Stripe integration, webhooks, billing logic
- **security-auditor**: Security review before major releases
- **validation-orchestrator**: Full system validation after features complete
- **prd-guardian**: Verify alignment with PRD requirements

## Next Immediate Tasks

1. Check Archon for current todos
2. If none, create tasks for Phase 2.2.1 (Audio Engine Foundation)
3. Start with database schema for tracks/renders
4. Implement AudioJob processor
5. Build TTS integration
6. Create render pipeline

## Remember:
- **ALWAYS** start with Archon task management
- **ALWAYS** research before implementing
- **ALWAYS** write tests first (TDD)
- **ALWAYS** update task status in Archon
- **NEVER** skip security considerations
- **NEVER** commit without tests passing

Begin by checking Archon project `6d363c98-a135-4919-8171-ee0756a6f1a0` for the next task!