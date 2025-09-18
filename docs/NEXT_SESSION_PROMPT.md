# MindScript Development - Session Continuation Prompt

## Current Status (Jan 16, 2025)

### ✅ Recently Completed
- Fixed admin portal authentication (307 redirect loop resolved)
- Implemented Server Actions for auth flow
- Created centralized role management utilities
- Admin portal is now functional at http://localhost:3002

### 🚨 Immediate Action Required
1. **Run SQL Fix**: Execute `/apps/admin/scripts/fix-admin-role.sql` in Supabase to set admin role
2. **Uncomment Role Check**: Re-enable lines 30-46 in `/apps/admin/src/app/actions/auth.ts` after SQL fix
3. **Fix Build Errors**: Address Next.js build errors in admin portal navigation components

### 🎯 Next Phase: Audio Engine & Builder (Archon Priority)

According to Archon task management, the next critical phase is implementing the **Audio Engine Package** and **Builder Interface**:

#### Audio Engine (`packages/audio-engine/`)
- [ ] Implement AudioJob schema with FFmpeg pipeline
- [ ] Create Solfeggio tone generator (174-963 Hz pure sine waves)
- [ ] Build Binaural beat generator (L/R channel frequency differences)
- [ ] Implement stereo preservation and mixing pipeline
- [ ] Add LUFS -16.0 normalization with integrated limiter

#### Builder Interface (`apps/web/src/components/builder/`)
- [ ] Script input with template selection
- [ ] Voice selection UI (OpenAI TTS + ElevenLabs)
- [ ] Duration controls (5/10/15 minute presets)
- [ ] Layer toggles with validation rules:
  - Voice can be solo
  - Background requires Voice
  - Solfeggio/Binaural cannot be solo
- [ ] Real-time preview functionality

#### Core Integrations
- [ ] OpenAI TTS API integration with preview
- [ ] ElevenLabs voice cloning flow
- [ ] Stripe Checkout with dynamic pricing ($1 intro, $3 standard)
- [ ] Queue system for render jobs (Supabase Functions or QStash)

### 📋 Project Context

**Repository**: https://github.com/AlchemyApps/mindScript
**Branch**: dev
**Archon Project ID**: 6d363c98-a135-4919-8171-ee0756a6f1a0

**Tech Stack**:
- Monorepo: Turborepo with apps/web, apps/mobile, apps/admin
- Backend: Next.js Route Handlers + Supabase Edge Functions
- Audio: Node.js + FFmpeg (packages/audio-engine)
- Payments: Stripe (web) + RevenueCat (mobile)
- Database: Supabase with RLS

**Current Infrastructure Status**:
- ✅ Database schema complete
- ✅ Authentication working
- ✅ Admin portal operational
- ✅ Mobile app foundation ready
- 🚧 Audio engine not implemented
- 🚧 Builder UI not created
- 🚧 Payment flow not connected

### 🔧 Development Commands

```bash
# Start admin portal
cd apps/admin && npm run dev

# Start web app
cd apps/web && npm run dev

# Run all tests
npm run test

# Check Archon tasks
# Use Archon MCP to check project status and get next tasks
```

### 📝 Key Implementation Notes

1. **Stereo Enforcement**: All audio must be stereo for binaural beats
2. **Layer Rules**: Enforce validation per PRD specifications
3. **Pricing**: Dynamic based on layers selected
4. **Quality**: Target LUFS -16.0, no clipping
5. **Testing**: TDD with Vitest, maintain 80%+ coverage

### 🚀 Session Start Checklist

1. [ ] Check Archon for current task status
2. [ ] Pull latest changes from dev branch
3. [ ] Verify Supabase role fix has been applied
4. [ ] Re-enable role checking in auth.ts
5. [ ] Start with audio engine implementation per Archon tasks

---

**Remember**: Always check Archon MCP first for task management. The audio engine and builder are the critical path to MVP launch.