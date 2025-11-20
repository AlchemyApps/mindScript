# MindScript Claude Code Context

## 🔴 SESSION START PROTOCOL (DO THIS FIRST!)
**STOP! Before any development, complete this checklist:**

1. **Git Hygiene**
   ```bash
   git branch      # MUST NOT be on main or dev
   git status      # Confirm no stray staged changes
   ```
   - On main/dev → immediately create a feature branch.
   - Dirty tree → stash, shelve, or reconcile before coding.

2. **Review Project State**
   - Skim the latest entries in `SESSION_HISTORY.md`.
   - Look for “Status: INCOMPLETE” or outstanding “Next Session” notes.
   - Confirm you’re not about to overwrite pending user work.

3. **Environment Check**
   - First session of the day → `npm run check:env`.
   - Verify required secrets (Supabase URL/keys, Stripe, OpenAI, ElevenLabs, Resend).
   - Ensure tooling (ffmpeg, Supabase access, Stripe tunnel) is available if needed.

4. **Circular Debugging Rule**
   - Two failed attempts on the same issue → STOP.
   - Summarize the loop, invoke Thinking MCP, or grab a second set of eyes.
   - Avoid burning >30 minutes without changing approach.

5. **Define Session Scope**
   - What’s the specific outcome we need now?
   - What are the success criteria?
   - What should we explicitly avoid touching?

**⚠️ CRITICAL: DO NOT COMMIT UNTIL USER APPROVES**
Implement → show results → address feedback → single commit.  
User may say “skip protocol” to bypass, otherwise run the list every session.

---

## 🔧 SESSION TRIGGER WORDS

### Debugging
- **“circular” / “looping” / “step back”** → pause, summarize, use Thinking MCP.

### MCP Tools
- **“use MCP”** → prefer MCP tooling over ad-hoc shell commands.
- **“check deps” / “depscore”** → run Socket MCP dependency audit.
- **“think deeper” / “use thinking”** → fire sequential reasoning MCP.
- **“check Sentry”** → review Sentry issues.
- **“use Supabase MCP” / “MCP database”** → interact with DB through MCP.
- **“check IDE”** → trigger IDE diagnostics MCP.

### Process
- **“branch check” / “which branch”** → verify git branch immediately.
- **“feature branch”** → create/switch to feature branch.
- **“todo” / “track this”** → log via TodoWrite MCP.
- **“protocol”** → rerun Session Start Protocol.

### Automatic Patterns (agent inference)
- Database/schema work → Supabase MCP.
- Adding dependencies → Socket MCP + security note.
- Two repeated failures → Thinking MCP.
- Multiple related tasks → maintain TodoWrite task list.

---

## 🚀 Quick Start Commands

```bash
npm run dev            # Turborepo dev servers (Next.js, etc.)
npm run build          # Turbo build across workspaces
npm run lint           # ESLint
npm run test           # Vitest (workspace)
npm run test:e2e       # Playwright smoke tests
npm run check:env      # Validate environment variables
```

- Package manager: **npm** (workspaces). `package-lock.json` is authoritative.  
- Each app/package has its own `package.json`; use root `npm run` scripts to let Turbo resolve scopes.  
- ffmpeg must exist locally for `packages/audio-engine`.

---

## 🎯 Project Snapshot
- **Core flow:** Builder → Stripe checkout → webhook → Supabase render job → library playback.
- **Supporting apps:** `apps/web` (Next.js 14), `apps/mobile` (Expo Router), `apps/admin` (Next.js 14).  
- **Shared packages:** `packages/audio-engine`, `packages/auth`, `packages/payments`, `packages/schemas`, `packages/ui`, etc.
- **Known gaps:** Seller dashboards still mock metrics, limited automated coverage of checkout→render loop, RLS hardening pending.
- **Branch strategy:** Feature branches off `dev`; `main` for releases only.

---

## 🏗️ Architecture Overview
- **Frontend:** Next.js App Router (SSR/ISR), Tailwind CSS, custom UI kit, Zustand stores.
- **Backend:** Next route handlers; Supabase client for DB/storage/auth; Stripe Checkout + Connect; audio rendering orchestrated via `packages/audio-engine`.  
- **Integrations:** Supabase (auth/storage), Stripe, ElevenLabs, OpenAI, Resend, Sentry.

---

## 🧩 Modularity & Data Flow

1. **Components stay lean**  
   - UI only: render props, wire hooks/stores, forward events.  
   - No `fetch`, Supabase, Stripe, or direct service calls inside React components.

2. **Service layer in `lib/` or packages**  
   - Wrap outbound API calls (Supabase, Stripe, audio engine).  
   - Validate with `@mindscript/schemas`; convert errors into domain results.

3. **Hooks orchestrate async state**  
   - Example: `apps/web/src/hooks/useLibraryTracks.ts`.  
   - Hooks call services, manage loading/error, expose typed data/actions.

4. **Shared state via Zustand stores**  
   - Keep stores (`apps/web/src/store/**`) typed; mutate via actions; test in isolation.

5. **Route handlers as boundaries**  
   - Validate input with Zod.  
  - Call services/packages; don’t embed business rules inline.  
   - Return consistent error envelopes (`{ error, details? }`).

6. **Testing expectations**  
   - Components → React Testing Library.  
   - Hooks/stores/services → Vitest.  
   - Route handlers → integration-style tests with mocked Supabase/Stripe/audio engine.  
   - End-to-end → Playwright (builder → checkout → render → library).

**Example layout (`Pulse Alerts` feature):**
```
apps/web/src/lib/pulse-alerts/service.ts
apps/web/src/hooks/usePulseAlerts.ts
apps/web/src/components/pulse-alerts/Panel.tsx
apps/web/src/app/api/pulse-alerts/route.ts
apps/web/src/lib/pulse-alerts/service.test.ts
apps/web/src/hooks/__tests__/usePulseAlerts.test.ts
```

**Sanity Checklist**
- [ ] No direct `fetch` or Supabase client in `components/` or app pages.  
- [ ] New external logic lives in `lib/` or shared packages.  
- [ ] Hooks encapsulate async behavior.  
- [ ] Zustand stores mutated through defined actions.  
- [ ] Service + hook + component each have appropriate tests.

---

## 🧭 Development Guardrails
1. **Plan first:** Draft a lightweight plan (2–3 steps). Update it as tasks complete.  
2. **TDD default:** Write or update Vitest coverage for new behavior; add Playwright coverage for critical flows.  
3. **Supabase:** Use service-role server-side only and annotate with follow-up notes. Prefer Supabase MCP over CLI.  
4. **External services:** Mock Stripe/Supabase/ElevenLabs/OpenAI in tests via MSW/fixtures. Never hit real APIs in unit tests.  
5. **Logging:** Structured logs with request/user IDs; scrub PII; lean on Sentry.  
6. **Secrets:** `.env` locally; Vercel/Expo/Supabase secrets in prod; never commit keys.  
7. **Feature flags:** Gate unfinished surfaces (seller dashboards, mobile flows) to avoid exposing mocks.

---

## 🔐 Security Baseline
- Validate inputs with schemas from `@mindscript/schemas`.  
- Enforce Supabase RLS; document any service-role shortcuts and schedule fixes.  
- Stripe webhook: verify signatures + idempotency via `webhook_events`.  
- Signed URLs for private audio; public bucket for marketplace media.  
- Payments: track first-purchase discount usage, seller payouts, metadata contracts.

---

## ⚙️ Performance Guidelines
- TTFB for cached pages < 200 ms; API p95 < 400 ms.  
- Kick off render queue < 5 s; 10-min audio render target < 60 s server time.  
- Use indexes/pagination on Supabase; avoid N+1.  
- Cache/ISR public content; stream large payloads; keep audio processing on disk.  
- Audio engine: enforce stereo (`-ac 2`), maintain predictable gain staging, reuse temp dirs.

---

## 🧪 Testing Expectations
- `npm run test`: Vitest; target ≥80 % repo coverage, higher for auth/payments/audio-engine.  
- `npm run test:e2e`: Playwright happy-path smoke.  
- Tests co-located with implementation. Avoid mocking internal modules; mock external services.  
- Before handing off work: run lint, typecheck, relevant tests.

---

## 🛠️ Workflow & Git
1. Start from latest `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/<slug>
   ```
2. Develop without committing.  
3. Demo results to user; gather feedback.  
4. After approval:
   ```bash
   git add .
   git commit -m "feat: concise summary"
   git checkout dev
   git merge feature/<slug>
   git push origin dev
   ```
5. Delete feature branch locally (confirm remote cleanup if needed).

**Rollback tools:** `git stash`, `git checkout -- <file>`, `git reset --hard HEAD~1`.

---

## 🧠 Coding Standards
- Strict TypeScript; no `any`. Use `z.infer` for derived types.  
- Functional-light style, early returns, descriptive naming.  
- Minimal comments except for security/perf or non-obvious invariants.  
- Co-locate domain types with implementation; avoid mega type files.  
- Prefer composition; keep components small and readable.

---

## 🔄 Operational Notes
- **Stripe:** Use test keys locally; keep metadata contracts in sync when updating builder/checkout flows.  
- **Supabase:** Track service-role usage and follow up with RLS hardening.  
- **Audio engine:** Ensure environment provides ffmpeg; handle temp directories carefully.  
- **Seller dashboards:** Currently mix mock + real data; warn users before exposing.  
- **Mobile/Admin apps:** Early-stage; clearly label “coming soon” if shipping to users.

---

## 📌 Pre-Exit Checklist
- [ ] Tests (unit/integration/e2e) run for touched areas?  
- [ ] Lint/typecheck clean?  
- [ ] Changes staged only after approval?  
- [ ] Follow-up items captured (SESSION_HISTORY.md, TodoWrite, or user notes)?  
- [ ] Secrets/env handled safely?  
- [ ] User has a clear summary of results/blockers?

