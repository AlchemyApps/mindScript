MindScript — Product Requirements Document (PRD)
 Platforms: Web (Next.js) + Native (React Native via Expo)
 Backend: Supabase (Postgres/Auth/Storage/Edge)
 Payments: Stripe Checkout (web), Apple IAP / Google Play Billing (native) + Stripe Connect for creator payouts
 Audio Engine: Node/FFmpeg (modular; pluggable Python microservice optional)

0) Product Vision & Principles
Create personalized, looped affirmation audio fast, with optional background music and optional, generated tone layers (Solfeggio tones and binaural beats) rendered server‑side.


Single, unified builder for everyone. Any user can become a seller after signing the Seller Agreement—no separate “influencer toolset.”


Web + native distribution: meet users where they are. Payments differ by channel but the experience is consistent.


Ownership & transparency: clear licensing, pricing, and revenue‑share (web vs. native fees visible in seller dashboards).


Performance & reliability: server‑side audio rendering; stereo preserved end‑to‑end; limiter/normalizer to prevent clipping.


Clear guidance: neutral, non‑medical language; headphone hint for binaural beats.



1) Personas
User/Creator (default): Creates personal tracks, builds library, may later opt in to sell.


Seller (Creator + Agreement): Same builder; can publish tracks for sale; gets payouts via Stripe Connect.


Admin: Manages catalog, pricing, payouts, moderation, and search/GEO surfacing.



2) Core User Journeys
A) Landing → First Purchase (Web)
Landing hero + explainer → Start building (inline steps).


Steps: Script → Voice → Duration → Background (optional) → Generated Tones (optional: Solfeggio/Binaural) → Review.


Checkout (Stripe Checkout): First audio $1, returning base $3 + add‑ons (BG track price + Solfeggio + Binaural as applicable).


On success: account created/logged in → Portal with the purchased track in Library.


Validation gate: Only Voice (script/TTS/recorded) may be used by itself. Background requires Voice. Solfeggio and Binaural cannot be solo, but they may be combined with each other and/or with Voice/Background. Admins may bypass these constraints for QA. Block continue if rule not met.
B) Logged‑in Creation (Web & Native)
Same builder UX as landing (now with saved scripts, presets, and full controls).


Render job queued → push/email on completion → track appears in Library.


C) Become a Seller
From Profile: “Enable selling” → accept Seller Agreement → Stripe Connect Express onboarding (KYC).


In Library: choose any owned track → “Publish for sale” (toggle + metadata).


Published track appears on Seller Public Page + Track Page (GEO/SEO optimized for AI & traditional search).


D) Buyer Flow (Web vs Native)
Web: Stripe Checkout (off‑site). After purchase, track added to Library.


Native: Apple/Google IAP. Purchases sync to Supabase; same Library.



3) Feature Requirements
3.1 Builder (Unified)
Script
Textarea with live char count; templates by category (confidence, stress relief, healing, etc.).


Voices
OpenAI TTS (Alloy, Echo, Fable, Onyx, Nova, Shimmer) with preview.


Custom Voice (ElevenLabs): one‑time voice setup (see §5.6). After setup, user’s custom voice appears as a selectable voice alongside others. Previews available.


Recorded voice upload (user records/read script) — optional MVP+.


Duration
5 / 10 / 15 minutes.


Looping
Repeat base script; pause 1–30s between repetitions (configurable per build).


Background audio (optional)
Use Platform Library (priced individually) or Personal Uploads (private to user).


Stereo enforcement for binaural categories; warn/block mono uploads for binaural category.


Mixing controls: background gain %, optional intro/outro fades.


Generated Tones (optional)
Solfeggio tone (pure tone generated at render time): choose one of 174/285/396/417/528/639/741/852/963 Hz; independent level control; optional fade in/out.


Binaural beat (generated at render time): choose band Delta/Theta/Alpha/Beta/Gamma with a sensible default beat frequency; optional carrier (e.g., 200–500 Hz), independent level control.


Headphones tip displayed when Binaural is on; enforced stereo output.


Selection rule
Voice may be chosen alone.


Background may only be chosen if Voice is also selected.


Solfeggio and Binaural may not be solo; they may be combined together (Solfeggio+Binaural) and/or added to Voice/Background.


Admin override: Admins can bypass these constraints for testing/QA.


All sub‑layers are optional, but at least one of: Voice, Background, Solfeggio, or Binaural must be selected.


Naming
All users must title their track.


Review step
Itemized price; estimated length; channel layout badge (Stereo/Mono); layer chips (Voice, BG, Solfeggio X Hz, Binaural Alpha).


One‑tap 10–15s preview render (server‑side) for sanity checking levels.


UI Copy (tooltips/labels)
Solfeggio benefits and Binaural band blurbs from Appendix A (neutral tone, non‑medical).


3.2 Library & Player
Per‑user Library: unified list mixing self‑created and purchased tracks.


Filters: Origin (All / Created / Purchased), Duration, Date, Published status, Tags, Contains: Voice/BG/Solfeggio/Binaural.


Badges: Created (owner) / Purchased (from seller) / Layer chips.


Actions
Created: Edit & Re‑render, Publish toggle (if seller), Download (web).


Purchased: Add to playlist, Download (web), Report.


Player — Native (Expo)
Bottom tab: Player with persistent mini‑player


react‑native‑track‑player (preferred) for background/lock‑screen controls, queues; fallback expo‑av


Queue/playlist: add/remove/reorder; saved playlists; remember last position


Offline caching via expo‑file‑system; storage quota + clear cache


User‑initiated downloads for offline playback (beyond cache); per‑track toggle + quota; entitlements enforced; revoke on refund.


Background/lock‑screen playback while using other apps; Bluetooth/wired routes; CarPlay metadata & transport controls.


Controls: loop toggle, sleep timer (10/20/30m), playback speed (1.0–1.25×), volume


Player — Web
HTMLAudioElement + Media Session API for metadata/controls


Progressive streaming via CDN; queue UI mirrors native; optional PWA later


Actions: Download (web), Share (for published), Duplicate, Edit & Re‑render.


3.3 Marketplace (Search & Feeds)
Catalog metadata (required on publish): Category, Background type, Voice provider, Language, Keywords (tags), Solfeggio (none/Hz), Binaural (none/band), Price tier (iOS/Android), Web price.


Search: Supabase Postgres full‑text + trigram (MVP) with ranked results; facet filters (category, background, duration, price tier, voice, seller, language, stereo‑only, has_solfeggio, has_binaural, solfeggio_hz, binaural_band).


Feeds:


Trending: time‑decayed score using sales, purchases, plays, saves.


For You: content‑based boosts from user listens/purchases.


Featured: admin‑curated rails/hero slots.


UI: marketplace home shows rows for Trending / For You / Featured / New; card shows 30–60s preview and layer chips.


(Scale option: index sync to Typesense/Meilisearch later.)
3.4 Publishing & Public Pages (GEO + SEO)
Seller Public Page /u/[sellerSlug]: creator bio, links, full catalog


Track Page /u/[sellerSlug]/[trackSlug] (or /t/[trackSlug]): title, description, cover, preview, benefits, purchase CTA


GEO: LLM‑ready summaries, Q&A blocks, key facts; JSON‑LD (CreativeWork/MusicRecording) extended with custom props for sound_layers (voice, bg, solfeggio_hz, binaural_band); canonical URLs, OG images, sitemap entries


Next.js SSG + ISR with on‑demand revalidation upon publish/update


3.5 Customization Controls
Seller page fields: display_name, bio_markdown (sanitized), profile_image_url, header_bg_image_url or header_bg_color, accent_color, social links


Guardrails: size limits, contrast validation, brand palette enforcement


Track page fields: title (required), description_markdown, cover_image_url, bg_color / bg_image_url, tags[]


Auto sections: “What you’ll hear”, “Best used for”, preview player


Auto badges: shows selected generated tones.


3.6 Pricing & Monetization
Base pricing:


Web intro: $1 (configurable)


Native intro: $0.99 via dedicated IAP SKU


Subsequent audios (web default): $3 (configurable)


Add‑ons (line‑items):


Background music: dynamic—platform asset price (per track) or $1 for personal upload.


Solfeggio tone (generated): fixed add‑on price (configurable).


Binaural beat (generated): fixed add‑on price (configurable).


Selection rule enforcement: Only Voice may be solo; Background requires Voice; Solfeggio/Binaural not solo (may be combined and/or with Voice/BG).


Price parity: Maintain web/native parity. Map web cents to nearest iOS/Android tier; admin UI shows parity status and any rounding.


Earn‑it‑back for platform assets: Sellers pay BG asset price at build time; the platform automatically rebates that spend from early sales of the published track until the asset cost is fully recovered, then standard split resumes. Thresholds configurable per asset/category.


3.7 Seller Earnings & Revenue Share Seller Earnings & Revenue Share
Web sale split: (revenue - stripe fees) × seller% (admin‑set; default e.g., 70/30)


Native sale split: (gross − store fee) × seller%


Dashboard shows Web vs Native earnings, fees, net payout, payout schedule


Stripe Connect Express payouts; KYC status, tax forms


Ledger itemizes BG asset fee, Solfeggio, and Binaural add‑ons per sale.


3.8 Page Build Strategy (Next.js)
Dynamic routes with App Router


app/u/[sellerSlug]/page.tsx


app/u/[sellerSlug]/[trackSlug]/page.tsx


SSG/ISR with on‑demand revalidation via secure API route (POST /api/revalidate)


Metadata API for titles, canonicals, alternates


OG image generator endpoint for share cards (per seller/track)


3.9 Admin Portal (Next.js route)
Pricing matrix editor (base, per‑asset, promos, first‑purchase rules, ElevenLabs setup fee, native price tiers, Solfeggio/Binaural add‑on prices)


Catalog manager: templates, voices (enable/disable), background tracks (upload, license notes, price, tags, stereo flag)


Seller management: onboarding state, take rates, holds, compliance flags


Orders & payouts: search, status, exception handling


Search/GEO controls: featured sellers/tracks, category pages, copy blocks, Q&A snippets


Settings: audio engine knobs (pause default, gains), player defaults, feature flags


Moderation: voice‑clone consent evidence, takedown to provider



4) Audio Engine
4.1 Engine Overview
Primary: Node service using FFmpeg (child process or fluent‑ffmpeg).


Modular contract: an AudioJob JSON passed to engine (see below).


Swap to Python: same schema to a Python microservice (pydub/ffmpeg‑python).


4.2 AudioJob Schema (extended)
{
  "voiceUrl": "s3://…/voice.mp3",            
  "musicUrl": "s3://…/bg.mp3",               
  "durationMin": 10,
  "pauseSec": 3,
  "loopMode": "repeat|interval",
  "intervalSec": 60,
  "gains": { "voiceDb": -1.0, "musicDb": -10.0, "solfeggioDb": -16.0, "binauralDb": -18.0 },
  "fade": { "inMs": 1000, "outMs": 1500 },
  "channels": 2,
  "outputFormat": "mp3",
  "solfeggio": { "enabled": true, "hz": 528, "wave": "sine" },
  "binaural": {
    "enabled": true,
    "band": "alpha",              
    "beatHz": 10.0,                
    "carrierHz": 220.0            
  },
  "safety": { "limiter": true, "targetLufs": -16.0 }
}

Notes:


If binaural.enabled, engine generates L/R tones at carrierHz ± (beatHz/2) and merges stereo.


solfeggio.wave initially sine; reserve for triangle/square later.


Gains are pre‑mix; limiter ensures no clipping; keep voices intelligible.


4.3 Operations
TTS: OpenAI Responses TTS; chunk if >5,000 chars; stitch; normalize.


ElevenLabs (when selected voice): synthesize via ElevenLabs TTS with stored voice id.


Silence insertion: anullsrc segments concatenated; precise 2–5s.


Generated tones:


Solfeggio via FFmpeg sine/aevalsrc for requested hz; fade in/out as configured.


Binaural via two sines (L/R) at carrierHz ± beatHz/2; ensure strict stereo (-ac 2); headphones tip in UX.


Mixing order (example): (voice ducking over music) + solfeggio + binaural → soft clip/limiter → encode.


Stereo preservation: always encode -ac 2; prohibit downmix.


Binaural validation: ensure two distinct channel freqs; runtime assert; engine unit tests.


4.4 File Output
MP3 (192 kbps) default; WAV optional (admin toggle).



5) Payments, Payouts & Providers
5.1 Web Checkout (Stripe Checkout)
Dynamic line items from selection: base + BG asset price + Solfeggio add‑on + Binaural add‑on + ElevenLabs setup fee (when applicable).


Use/remember Stripe Customer ID for returning users.


Save card for faster checkout: enable setup_future_usage=off_session in Checkout so the card is saved to the Customer for future one‑click payments (no auto‑charges without user action).


Success/cancel URLs; webhook (checkout.session.completed) → mark purchase → start render job.


Intro price (web): $1 (configurable in Admin).


5.2 Native Purchases (IAP, no credits) Native Purchases (IAP, no credits)
IAP integration layer: RevenueCat (recommended) with React Native SDK (Expo config plugin). Handles StoreKit/Play Billing, receipt validation, and webhooks.


Small fixed SKU set (consumables):


Create Track – Intro: $0.99 (one‑time shown if user has no created tracks on native)


Create Track – Standard: price set in Admin (e.g., $2.99)


Background Add‑on – Basic/Premium (Admin‑set)


Solfeggio Add‑on


Binaural Add‑on


Track Purchase – Tier 1/2/3 (Admin‑mapped to price tiers)


Non‑consumable: Custom Voice Setup (ElevenLabs) (one‑time fee)


Flow: app shows exact item (track/add‑on) → triggers mapped SKU → verify receipt (RevenueCat webhook or SDK) → server grants specific unlock (creates purchase, attaches track to Library) → render/download as usual.


Web parity: web sales continue via Stripe; locked items are accessible on native once synced to Supabase.


5.3 Stripe Connect (Sellers)
Express accounts; onboarding within app.


Earnings ledger per sale with fields: channel (web/native), gross, fees (processor/app store), platform share, seller share, payout batch id.


Payout cadence (weekly by default) editable by admin.


5.4 Refunds & Chargebacks
Admin tools to issue web refunds (Stripe). Native refunds handled via the store and reconciled in ledger.


5.5 Pricing Controls (Admin)
All prices editable: base, add‑ons, custom voice setup, generated tone add‑ons, rebate thresholds, seller % per‑channel, native price tiers + intro SKU visibility.


Feature flags to A/B test prices or benefits copy.


5.6 ElevenLabs Custom Voice — Setup & Use
Goal: allow a user to create their own synthetic voice once for a one‑time fee (price set in Admin), then use it like any other voice.


Flow: consent → one‑time fee → create voice_id via ElevenLabs → store in user_voices → add to picker.


Costs: If ElevenLabs has ongoing costs, use per‑render uplift (admin‑configurable) or absorb.


Compliance: explicit consent, age gate if required, delete propagation to provider.



6) Supabase Data Model (MVP+)
Core Tables (updated)
profiles (id, email, display_name, stripe_customer_id, role_flags, accent_color, bio_markdown, profile_image_url, header_bg_image_url)


seller_agreements (profile_id, accepted_at, stripe_connect_id, status)


scripts (id, owner_id, title, content, tags, is_template)


background_tracks (id, owner_id nullable, title, url, price_cents, is_platform_asset, is_stereo, license_note, tags)


voices (id, provider, code, label, is_enabled, is_premium)


user_voices (id, owner_id, provider, provider_voice_id, title, preview_url, setup_fee_paid, active)


audio_projects (id, owner_id, script_id, voice_ref, duration_min, pause_sec, loop_mode, interval_sec, bg_track_id, title, **layers_json** JSONB)


layers_json example:


{
  "voice": { "enabled": true },
  "background": { "enabled": true, "track_id": "uuid" },
  "solfeggio": { "enabled": true, "hz": 528 },
  "binaural": { "enabled": false, "band": null, "beat_hz": null, "carrier_hz": null },
  "gains": { "voice_db": -1, "bg_db": -10, "solfeggio_db": -16, "binaural_db": -18 }
}

renders (id, project_id, status, output_url, duration_ms, channels, bitrate, **render_params_json** JSONB)


publications (id, render_id, seller_id, is_published, slug, description, images[], cover_image_url, bg_color, bg_image_url, tags[], **solfeggio_hz**, **binaural_band**, price_tier_ios, price_tier_android, price_web_cents)


purchases (id, buyer_id, render_id, platform (‘web’|‘ios’|‘android’), iap_product_id, sale_price_cents, currency, external_ref, status, **line_items_json**, seller_share_cents, platform_fee_cents)


earnings_ledger (id, publication_id, purchase_id, channel, gross_cents, fees_cents, platform_cut_cents, seller_cut_cents, payout_id)


playlists (id, owner_id, title, created_at)


playlist_items (playlist_id, render_id, position)


admin_settings (pricing_json incl. elevenlabs_setup_fee, **generated_tones_pricing_json**, feature_flags_json, geo_blocks_json, ui_palettes_json, native_tiers_map_json, intro_sku_enabled)


Storage Buckets
tts_outputs/ (private; owner + entitled access via signed URL)


bg_tracks/ (private; owner, admins)


published/ (private full tracks; served via signed URLs to entitled users)


previews/ (public‑read short clips for marketplace cards)


covers/ (public‑read images)


RLS
Strict RLS on all user‑owned rows.


Publications (catalog metadata) readable by anon for discovery.


Entitlements: a user can SELECT a render (and receive a signed URL) if they are the owner or an entitled purchaser (EXISTS (SELECT 1 FROM purchases p WHERE p.render_id = renders.id AND p.buyer_id = auth.uid() AND p.status IN ('paid','fulfilled'))).


Storage:


published/ private — full tracks served via short‑lived signed URLs when entitlement is present.


previews/ public‑read — 30–60s preview clips for catalog cards.


Other buckets remain owner‑scoped with signed URLs.


Refunds/chargebacks revoke entitlement and invalidate any cached URLs.



7) Search, GEO & Distribution
GEO: per‑track/seller pages include LLM‑ready summaries, Q&A, bullet takeaways, structured facts. Provide /api/summaries endpoints to serve machine‑readable content including sound_layers keys.


Traditional SEO: sitemaps for sellers/tracks/categories; canonical URLs; localized metadata.


Social: OG/Twitter images per track.


Facets: include has_solfeggio, has_binaural, specific solfeggio_hz, binaural_band.



8) Admin & Moderation
Asset review (copyright checks, license notes required for uploads).


Voice‑clone moderation queue (consent evidence, takedown pipeline to provider).


Toggle availability of voices/assets/prices; toggle generated tone add‑ons.


Feature placement controls (home carousels, category highlights).


Copy guardrails: neutral language; add binaural headphones tip.



9) Non‑Functional Requirements
Performance: render start < 5s queue latency; 10‑min track render target < 60s server time (including tone generation).


Reliability: idempotent webhooks; retry queues; S3‑compatible storage with versioning.


Security: Supabase RLS everywhere; signed URLs; least‑privilege service keys.


Audio Quality: integrated limiter/normalizer; LUFS targeting; prevent clipping.


Observability: Sentry (errors), PostHog (product analytics), Stripe logs, IAP receipt logs.



10) Engineering Notes
Monorepo: Turborepo; packages: apps/web (Next.js), apps/mobile (Expo), apps/admin (in web), packages/ui, packages/types, packages/audio-engine.


Native (Expo): EAS build/submit/updates; expo‑av, expo‑file‑system, expo‑notifications, expo‑updates; consider react-native-track-player via config plugin for robust background playback.


API: Next.js route handlers / Supabase Edge Functions for rendering and webhooks.


Queue: Supabase Functions or QStash/Cloud Tasks for long renders.


CI/CD: Vercel (web/admin), Expo EAS (mobile), Fly/Render for audio engine if needed.


Engine Swap Plan: retain AudioJob schema; feature flag to route to Node or Python engine.


DSP module: isolated tone generator utilities; unit tests for frequency accuracy, stereo separation, and phase continuity.



11) Brand — Name, Voice, Logo & UI Style
Product name: MindScript
 Core idea: program your inner voice through intentional repetition and sound design.
Primary tagline: Program your inner voice.
 Alternates: Code the way you talk to you. • Compile calm & confidence.
11.1 Visual Identity
Palette – Calm Modern (light)


Primary #6C63FF


Teal Accent #10B981


Background #F7F8FC


Surface #FFFFFF


Text #0F172A


Soft Accent #FDE68A


Typography


Headlines: Sora (600/700)


Body/UI: Inter (400/500/600)


Line-height targets: headings 1.15–1.2, body 1.5


Components


Rounded‑2xl cards, soft shadows (0 8px 24px rgba(15,23,42,0.08)), 8–12px gaps, generous whitespace


Lucide icons


Motion: 180–220ms ease-out; subtle fades/scale on CTA, scrubber, and toasts


Badges: include a Headphones badge wherever binaural is present


11.2 Logo System (Tuning‑Fork Motif)
Mark: Minimal U‑shaped tuning fork whose tines morph into a looping sine wave (subtle infinity), suggesting resonance + repetition.


Wordmark: MindScript set in Sora Semi‑Bold; tracking −1%; cap height aligned to mark.


Primary lockup: mark left, wordmark right; monochrome and full‑color variants.


Colors: mark in Primary #6C63FF with Teal #10B981 wave highlight; grayscale allowed on photos.


Clearspace: ≥ height of the fork’s tine radius on all sides.


Min size: 24px for mark alone; 120px width for lockup.


Misuse: no shadows, no rotations, no outline strokes, don’t recolor text, don’t place over low‑contrast backgrounds without a surface.


11.3 App Icons & Favicons
iOS: 1024×1024 base; no text; rounded by OS; use centered mark over subtle radial from Primary→Teal.


Android (adaptive): 512×512; safe zone respected; provide foreground/background layers.


PWA: 512, 192, 96, 48; Favicon 32/16; mask‑icon (Safari) monochrome fork.


OG Image Template: 1200×630; hero mark left, title (Sora), short benefits bullets; gradient from #6C63FF to #10B981 at 20% opacity over #F7F8FC.


11.4 Brand Voice
Tone: clear, encouraging, science‑curious (not clinical).


Do: use active verbs, short sentences, “you” addressing, evidence‑lite phrasing (“may help you focus”).


Don’t: over‑promise outcomes; avoid jargon‑heavy neuro claims.


Microcopy:
Hero H1: Program your inner voice.


Subhead: Create affirmation loops with AI voice and binaural sound.


CTA: Build your first loop — $1


Empty Library: Your library is quiet. Create a loop and start tuning your day.


11.5 GEO (Generative Engine Optimization)
Per‑track/seller pages include LLM‑ready summaries, Q&A, key facts; ship JSON‑LD (CreativeWork/MusicRecording) and /api/summaries for machine‑readable content.


On‑demand ISR revalidation on publish/update; OG images per seller/track.


11.6 Implementation Notes (Design Tokens)
:root{
  --color-primary:#6C63FF; --color-accent:#10B981; --color-bg:#F7F8FC; --color-surface:#FFFFFF; --color-text:#0F172A; --color-soft:#FDE68A;
  --radius-lg:16px; --radius-xl:20px; --shadow-soft:0 8px 24px rgba(15,23,42,0.08);
  --ease: cubic-bezier(.2,.8,.2,1);
}


12) MVP Scope & Acceptance (updated)
In‑scope: unified builder; OpenAI TTS; ElevenLabs custom voice setup & usage; loop + pause; generated Solfeggio tone; generated Binaural beat; stereo enforcement; Marketplace (search, filters, Trending/For You/Featured feeds); Stripe Checkout (web); Native IAP without credits (SKU tiers + $0.99 intro) including tone add‑ons; Seller onboarding + publish; track & seller pages with GEO/SEO; Admin pricing/catalog (incl. ElevenLabs fee, native tiers & intro SKU, tone add‑on prices); Connect payouts & ledger; seller & track customization; persistent player with playlists; unified Library (Created + Purchased).
 Out‑of‑scope (defer): timeline drag‑and‑drop editor; subscriptions; social feed/comments; complex mastering; multi‑currency tax/VAT automation (manual config acceptable for MVP).
Acceptance Criteria (samples):
Builder enforces selection constraints: only Voice may be solo; Background requires Voice; Solfeggio/Binaural not solo (may be combined); Admins can bypass.


A new visitor can build, pay on Stripe, receive rendered MP3, and access it in Library.


Saved card on first web purchase: subsequent web checkouts prefill and complete with minimal steps.


Native mirrors web pricing via mapped tiers; parity status visible in Admin.


Uploading a mono file in a binaural category triggers a clear warning/block.


Binaural selection shows a headphones tip; rendered output has distinct L/R tone frequencies; final file is stereo.


Selecting Solfeggio 528 Hz produces a pure tone at 528 Hz mixed at configured gain with fade in/out.


The 10–15s preview reflects the chosen gains and layers.


A user can toggle Download for offline on allowed tracks in the native app; playback works while using other apps, via Bluetooth/wired, and in CarPlay.


A user can accept Seller Agreement, publish a track, and receive a payout after a sale; seller dashboard shows separate Web vs Native earnings lines and platform fees.


Admin can set web price, native price tiers per track, tone add‑on prices, and intro SKU visibility; changes reflect in new checkouts; Featured rails update immediately on save.


Marketplace search facets include has_solfeggio and has_binaural; card previews play with the intended layers.



Appendix A — Generated Tone Reference
Wellness-oriented guidance only. These descriptions are neutral, non‑medical summaries for in‑app education and selection tooltips. Headphones are recommended for binaural beats; stereo is required.
A.1 Solfeggio Frequencies (Generated Pure Tones)
174 Hz — Ease & Grounding
 Commonly used for a sense of physical and mental easing; can help release built‑up tension and promote a grounded, steady state.
285 Hz — Reset & Restore
 Often associated with a gentle “reset” feeling; supports a sense of recovery, restoration, and emotional steadiness.
396 Hz — Release & Momentum
 Linked to letting go of guilt/fear patterns; encourages forward movement, confidence, and positive change.
417 Hz — Change & Creativity
 Paired with transitions and fresh starts; can nudge flexible thinking, problem‑solving, and creative flow.
528 Hz — Soothing Renewal
 A popular “feel‑good” tone; many listeners describe warmth, calm, and a renewing quality.
639 Hz — Connection & Communication
 Associated with empathy and clearer communication; a gentle support for relationship attunement.
741 Hz — Clear & Cleanse
 Used for mental decluttering; invites honest expression and a sense of inner clarity.
852 Hz — Intuition & Clarity
 Tied to reflective, intuitive states; can support inner guidance and calm focus.
963 Hz — Spacious & Open
 Often described as expansive; may promote a quiet mind, perspective, and a feeling of connectedness.
Note: These are experiential summaries, not medical claims. Individual responses vary.
A.2 Binaural Beats (Stereo, Headphones Recommended)
Binaural beats are created by playing two close frequencies—one to each ear—so the brain perceives their difference as a rhythmic “beat.” We render true stereo and display a Headphones badge when enabled.
Delta (1–4 Hz) — Deep Rest
 Associated with deep relaxation and sleep‑like calm; best for winding down or restorative sessions.
Theta (4–8 Hz) — Meditative Drift
 Linked to creativity, imagery, and meditative depth; good for journaling, visualization, and gentle focus.
Alpha (8–13 Hz) — Relaxed Focus
 Useful for learning and “calm concentration”; present yet unhurried.
Beta (14–30 Hz) — Alert & Engaged
 Supports active thinking, problem‑solving, and task engagement; avoid near bedtime.
Gamma (30+ Hz) — Insight & Integration
 Associated with high‑level integration and flashes of insight; best in shorter sessions for most listeners.
Implementation notes (engine): We generate left/right carriers (e.g., ~200–500 Hz) with a band‑appropriate beat frequency, ensure strict stereo (no downmix), and apply limiter/normalizer to maintain comfortable levels.