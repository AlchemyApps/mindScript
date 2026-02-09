# Creator Studio - Vision Document

**Status:** Future Feature (Pre-Development)
**Created:** 2026-02-09
**Author:** Chris Schrade + Claude Code

---

## 1. Product Vision

### The Progression

MindScript's audio creation tools evolve through three tiers of complexity:

| Tier | Surface | Audience | Control Level |
|------|---------|----------|---------------|
| **Builder** | Step-by-step wizard | Everyone | Guided choices (voice, music, frequency, duration) |
| **Edit Tools** | Post-creation adjustments | Returning users | Tweak voice, music, frequencies on existing tracks |
| **Creator Studio** | Multi-track DAW | Power creators / sellers | Near-full control over audio production |

Creator Studio is the third tier - unlocked when creators have proven traction on the marketplace and want deeper creative control. It gives them a GarageBand-like experience in the browser: multiple audio tracks on a timeline, per-track effects, custom audio uploads, and full mastering control before publishing to the marketplace.

### Who It's For

- Creators who have successfully published and sold tracks through the standard Builder
- Meditation teachers, sound healers, and audio creators who want professional-grade control
- Users willing to pay for a premium subscription tier that unlocks the Studio

### What It Enables

- **Multiple tracks on a timeline** - Not just voice + music + tone, but N arbitrary tracks that can be layered, positioned, and trimmed
- **Custom audio uploads** - Bring your own background music, field recordings, sound effects, guided segments, or spoken word
- **Per-track effects** - EQ, compression, reverb, panning, volume automation on each track independently
- **Timeline editing** - Drag, drop, trim, crossfade, reposition audio clips visually
- **Real-time preview** - Hear the mix as you build it, without waiting for server renders
- **Production-quality export** - Server-side FFmpeg render produces mastered output
- **Marketplace publishing** - Render and list directly to the MindScript marketplace

---

## 2. Technical Architecture

### The Hybrid Model

The proven architecture used by commercial web DAWs (BandLab, Soundtrap) is a **client/server hybrid**:

```
                        Creator Studio Architecture

    +----------------------------------------------------------+
    |                    BROWSER (Client)                       |
    |                                                           |
    |  +------------------+  +-----------------------------+   |
    |  | Timeline UI      |  | Web Audio API Engine        |   |
    |  | (React + Canvas) |  | - Real-time playback        |   |
    |  | - Track lanes    |  | - Per-track effects chain    |   |
    |  | - Drag/drop      |  | - Live mixing preview       |   |
    |  | - Waveform viz   |  | - Metering / analysis       |   |
    |  +--------+---------+  +-------------+---------------+   |
    |           |                           |                   |
    |  +--------v---------------------------v-----------+      |
    |  | Project State (Zustand)                         |      |
    |  | - Track list, positions, effects configs        |      |
    |  | - Undo/redo stack (command pattern)              |      |
    |  | - Serializes to StudioProject JSON              |      |
    |  +---------------------------+---------------------+      |
    +----------------------------------------|------------------+
                                             |
                           Save / Render     |
                                             v
    +----------------------------------------------------------+
    |                    SERVER                                 |
    |                                                           |
    |  +--------------------+  +----------------------------+  |
    |  | Project Storage    |  | Render Pipeline             |  |
    |  | (Supabase)         |  | - Translate JSON -> FFmpeg  |  |
    |  | - Project configs  |  | - filter_complex builder    |  |
    |  | - Uploaded audio   |  | - Per-track effect chains   |  |
    |  | - Auto-save drafts |  | - Loudness normalization   |  |
    |  +--------------------+  | - Master limiting           |  |
    |                          | - Stereo enforcement        |  |
    |                          +----------------------------+  |
    |                                                           |
    |  +----------------------------------------------------+  |
    |  | Existing Infrastructure (reused)                    |  |
    |  | - audio_job_queue + QueueManager                    |  |
    |  | - FFmpegProcessor + AudioMixer + GainController     |  |
    |  | - StorageUploader + TempFileManager                 |  |
    |  | - TTS providers (OpenAI, ElevenLabs)                |  |
    |  +----------------------------------------------------+  |
    +----------------------------------------------------------+
```

**Why hybrid:**
- **Client-side preview** is instant - no upload/download latency while editing
- **Server-side render** uses full FFmpeg power for production quality
- **Project files are lightweight JSON** - only the audio files and config, not rendered output
- The existing `packages/audio-engine` infrastructure handles the heavy server-side work

---

## 3. FFmpeg Capabilities Inventory

FFmpeg is the right tool for server-side rendering. Here's what's available:

### Already Using (in `packages/audio-engine`)

| Capability | FFmpeg Filter/Method | Current Usage |
|------------|---------------------|---------------|
| Multi-track mixing | `amix` via `filter_complex` | `FFmpegProcessor.mixAudioTracks()` |
| Per-track gain | `volume` filter | dB-to-linear conversion per layer |
| Loudness normalization | `loudnorm` (EBU R128) | `-16 LUFS` target with `-1.5 TP` |
| Fade in/out | `afade` | Configurable ms durations |
| Tone generation | `sine` lavfi source | Solfeggio frequencies |
| Binaural beats | `amerge` of two `sine` sources | L/R frequency split |
| Silence insertion | `anullsrc` + `concat` | Start/end padding |
| Dynamic compression | `acompressor` | `GainController.applyCompression()` |
| Soft limiting | `alimiter` | `GainController.preventClipping()` |
| Format conversion | codec selection | MP3 (192k) / WAV (PCM 16-bit) |
| Stereo enforcement | `aformat=channel_layouts=stereo` | Mandatory on all outputs |

### Available for Creator Studio (new)

| Capability | FFmpeg Filter | Use Case |
|------------|--------------|----------|
| **Parametric EQ** | `equalizer` | Per-track frequency shaping (boost bass, cut harshness) |
| **High/low pass** | `highpass`, `lowpass` | Remove rumble or hiss from uploads |
| **Sidechain ducking** | `sidechaincompress` | Auto-duck music when voice is present |
| **Noise gate** | `agate` | Clean silence between speech segments |
| **Crossfade** | `acrossfade` | Smooth transitions between clips |
| **Delay/echo** | `adelay`, `aecho` | Spatial effects, echo trails |
| **Stereo widening** | `stereotools`, `stereowiden` | Expand or narrow stereo image |
| **Panning** | `pan` | Position tracks in the stereo field |
| **Time stretch** | `atempo` (basic) or `rubberband` (quality) | Speed up/slow down without pitch change |
| **Pitch shift** | `rubberband` or `asetrate`+`atempo` | Change pitch without tempo change |
| **Multiband split** | `acrossover` | Process frequency bands independently |
| **Convolution reverb** | `afir` | Apply room/space character via impulse responses |
| **Trim** | `atrim` | Cut audio to specific start/end points |
| **Concatenation** | `concat` filter | Join clips sequentially |

### FFmpeg Limitations to Plan Around

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| No real-time playback | Can't use for live preview | Web Audio API handles preview client-side |
| No native reverb algorithm | Must use convolution (`afir`) with IR files | Bundle a curated set of impulse response files (rooms, halls, plates) |
| Weak pitch shifting | `atempo`+`asetrate` is low quality | Compile FFmpeg with `--enable-librubberband` for quality pitch/time manipulation |
| No volume automation keyframes | Complex automation requires segment-by-segment processing | Build automation as discrete segments, render in sequence, concatenate |
| Single-threaded filters | Complex chains can be slow | Optimize filter graphs, consider parallel track pre-processing |
| No undo/project files | Destructive processing only | All state lives in the client-side project JSON; FFmpeg only touches final render |

---

## 4. Client-Side Technology Stack

### Web Audio API (Preview Engine)

The Web Audio API provides real-time audio processing in the browser through a node graph:

```
Track 1 (AudioBufferSource) -> GainNode -> BiquadFilter -> PannerNode ──┐
Track 2 (AudioBufferSource) -> GainNode -> BiquadFilter -> PannerNode ──┤
Track 3 (MediaElementSource) -> GainNode -> ConvolverNode -> GainNode ──┼─> Destination
Track 4 (OscillatorNode)    -> GainNode ────────────────────────────────┘
```

**Available nodes for preview effects:**
- `GainNode` - Volume control per track
- `BiquadFilterNode` - EQ (lowpass, highpass, bandpass, peaking, lowshelf, highshelf)
- `DynamicsCompressorNode` - Compression
- `ConvolverNode` - Reverb (via impulse responses)
- `DelayNode` - Echo/delay effects
- `StereoPannerNode` - Left/right panning
- `WaveShaperNode` - Saturation/distortion
- `AnalyserNode` - Real-time metering and spectrum display
- `AudioWorkletNode` - Custom DSP in a dedicated thread (replaces deprecated ScriptProcessorNode)

**Key consideration:** Preview quality won't be identical to the FFmpeg render, but it's close enough for real-time editing. The final render is what gets published.

### Recommended Libraries

| Library | Purpose | Why |
|---------|---------|-----|
| **wavesurfer.js v7** | Waveform rendering | Most popular (10k GitHub stars), plugin ecosystem (regions, timeline, minimap), Shadow DOM isolation |
| **Tone.js** | High-level Web Audio abstractions | DAW-grade transport, effects, instruments - saves building from scratch |
| **react-timeline-editor** | Timeline track lanes | Lightweight React component for DAW-style timeline with drag/drop |
| **dnd-kit** | Drag and drop | Modern, accessible DnD toolkit for track reordering and clip positioning |

### Large File Handling Strategy

Browser memory is limited - a 60-min stereo WAV at 32-bit/44.1kHz is ~1.2GB of RAM.

**Approach:**
1. **Short clips (< 45s):** Decode fully into `AudioBuffer` - instant playback, supports all effects
2. **Long files (> 45s):** Use `MediaElementAudioSourceNode` connected to Web Audio graph - streams from disk, lower memory, still supports effects chain
3. **Waveform display:** Pre-compute peaks server-side on upload, send lightweight waveform data to client (not full audio decode)
4. **Uploads:** Chunk large files, store in Supabase `studio-uploads` bucket, generate waveform data server-side

---

## 5. Project Data Model

### StudioProject Schema (client-side state, saved to DB)

```typescript
interface StudioProject {
  id: string
  userId: string
  title: string
  createdAt: string
  updatedAt: string

  // Global settings
  bpm?: number                    // Optional tempo reference
  masterGainDb: number            // Master output gain
  targetLufs: number              // -16 default (broadcast standard)
  outputFormat: 'mp3' | 'wav'

  // Timeline
  tracks: StudioTrack[]

  // Master effects chain (applied to final mix)
  masterEffects: EffectConfig[]
}

interface StudioTrack {
  id: string
  name: string
  type: TrackType
  color: string                    // Track lane color in UI
  muted: boolean
  solo: boolean
  locked: boolean

  // Audio positioning
  gainDb: number                   // Track volume
  pan: number                      // -1 (left) to 1 (right)

  // Clips on this track's timeline
  clips: StudioClip[]

  // Per-track effects chain (order matters)
  effects: EffectConfig[]
}

type TrackType =
  | 'voice'           // TTS-generated voice
  | 'music'           // Background music (from catalog or uploaded)
  | 'upload'          // User-uploaded audio
  | 'solfeggio'       // Generated solfeggio tone
  | 'binaural'        // Generated binaural beat
  | 'recording'       // In-browser recorded audio

interface StudioClip {
  id: string
  sourceId: string                 // Reference to audio source
  sourceType: 'tts' | 'catalog' | 'upload' | 'generated' | 'recording'

  // Timeline position (in seconds)
  startTime: number                // Where clip begins on timeline
  duration: number                 // Clip length

  // Trimming (within the source audio)
  trimStart: number                // Offset into source audio
  trimEnd: number                  // End point in source audio

  // Clip-level adjustments
  gainDb: number                   // Clip volume offset
  fadeInMs: number
  fadeOutMs: number

  // Optional time/pitch manipulation
  playbackRate?: number            // 0.5x to 2.0x
  pitchShiftSemitones?: number     // -12 to +12
}

interface EffectConfig {
  type: EffectType
  enabled: boolean
  params: Record<string, number>   // Effect-specific parameters
}

type EffectType =
  | 'eq'              // Parametric EQ (frequency, Q, gain per band)
  | 'compressor'      // Dynamic compression (threshold, ratio, attack, release)
  | 'reverb'          // Convolution reverb (impulse response selection, wet/dry)
  | 'delay'           // Echo/delay (time, feedback, wet/dry)
  | 'gate'            // Noise gate (threshold, attack, release)
  | 'limiter'         // Brick-wall limiter (threshold)
  | 'highpass'        // High-pass filter (frequency, Q)
  | 'lowpass'         // Low-pass filter (frequency, Q)
  | 'stereowidth'     // Stereo widening (width amount)
  | 'sidechain'       // Sidechain ducking (source track, threshold, ratio)
```

### Relationship to Current AudioJob Schema

The existing `AudioJob` type in `packages/audio-engine` handles the simple Builder/Edit flows. Creator Studio introduces `StudioProject` as a superset:

```
AudioJob (current)              StudioProject (Creator Studio)
├── voiceUrl                    ├── tracks[] (N tracks, any type)
├── musicUrl                    │   ├── clips[] (positioned on timeline)
├── solfeggio config            │   ├── effects[] (per-track chain)
├── binaural config             │   └── gain, pan, mute, solo
├── gains (4 fixed layers)      ├── masterEffects[] (master chain)
├── fade config                 ├── masterGainDb
├── safety/limiter              └── targetLufs, outputFormat
└── outputFormat
```

The server-side render pipeline would translate a `StudioProject` into an FFmpeg `filter_complex` command - the same infrastructure, just more complex filter graphs.

---

## 6. Database & Storage Extensions

### New Tables

```sql
-- Studio projects (the "save file")
CREATE TABLE studio_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  project_data JSONB NOT NULL,        -- Full StudioProject JSON
  thumbnail_url TEXT,                   -- Auto-generated waveform preview
  is_draft BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Uploaded audio files for studio use
CREATE TABLE studio_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  project_id UUID REFERENCES studio_projects(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,           -- Path in studio-uploads bucket
  duration_ms INTEGER,
  format TEXT,                          -- mp3, wav, etc.
  size_bytes BIGINT,
  waveform_data JSONB,                 -- Pre-computed peaks for visualization
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Impulse response library for reverb
CREATE TABLE impulse_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                   -- "Large Hall", "Plate Reverb", etc.
  category TEXT NOT NULL,               -- "rooms", "halls", "plates", "spaces"
  storage_path TEXT NOT NULL,
  duration_ms INTEGER,
  is_active BOOLEAN DEFAULT true
);
```

### New Storage Bucket

```
studio-uploads (private)
├── Max file size: 100MB (or Supabase gateway limit)
├── Allowed types: audio/mpeg, audio/wav, audio/flac, audio/ogg, audio/aac
├── RLS: Users can only access their own uploads
└── Waveform data generated on upload via server-side FFmpeg analysis
```

---

## 7. UI Component Breakdown

### Studio Layout

```
+-----------------------------------------------------------------------+
| Studio Header                                                          |
| [< Back]  Project Title (editable)   [Save Draft] [Preview] [Render]  |
+-----------------------------------------------------------------------+
| Toolbar                                                                |
| [+ Voice] [+ Music] [+ Upload] [+ Tone] [Undo] [Redo] [Zoom -/+]    |
+------------------+----------------------------------------------------+
| Track Controls   | Timeline / Waveform Canvas                         |
|                  |                                                     |
| Track 1: Voice   | ╔══════════════════════════════╗                   |
| [M] [S] [-12 dB] | ║ ▁▂▃▅▇▅▃▂▁▂▃▅▇▅▃▂▁        ║                   |
| [Pan] [FX]       | ╚══════════════════════════════╝                   |
|                  |                                                     |
| Track 2: Music   |    ╔═══════════════════════════════════════════╗   |
| [M] [S] [-10 dB] |    ║ ▁▁▂▂▃▃▃▃▂▂▃▃▃▃▂▂▁▁▂▂▃▃▃▃▂▂▃▃▃▃▂▂     ║   |
| [Pan] [FX]       |    ╚═══════════════════════════════════════════╝   |
|                  |                                                     |
| Track 3: Upload  |          ╔══════════╗                               |
| [M] [S] [0 dB]  |          ║ ▅▇▅▃▂▁  ║                               |
| [Pan] [FX]       |          ╚══════════╝                               |
|                  |                                                     |
| Track 4: Tone    | ╔═════════════════════════════════════════════════╗ |
| [M] [S] [-16 dB] | ║ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~       ║ |
| [Pan] [FX]       | ╚═════════════════════════════════════════════════╝ |
|                  |                                                     |
+------------------+----------------------------------------------------+
| Transport Bar                                                          |
| [|<] [<] [Play/Pause] [>] [>|]  00:00 / 10:00  [Loop]               |
+-----------------------------------------------------------------------+
| Effects Panel (toggleable, shown when [FX] clicked on a track)        |
| EQ: [Low ▼] [Mid ▼] [High ▼]  Comp: [Thresh] [Ratio]  Reverb: [▼]  |
+-----------------------------------------------------------------------+
| Master Section                                                         |
| Master Vol: [====|====]  LUFS: -16.2  Peak: -3.1 dB  [Limiter ON]   |
+-----------------------------------------------------------------------+
```

### Key Components

| Component | Responsibility |
|-----------|---------------|
| `StudioLayout` | Main layout shell, panel management |
| `StudioHeader` | Project title, save/render/preview actions |
| `StudioToolbar` | Add tracks, undo/redo, zoom controls |
| `TrackLane` | Single track row with controls + waveform |
| `TrackControls` | Mute, solo, gain slider, pan knob, FX button |
| `TimelineCanvas` | Waveform rendering, clip positioning, playhead |
| `ClipHandle` | Individual audio clip (drag, resize, trim) |
| `TransportBar` | Play/pause, scrub, time display, loop toggle |
| `EffectsPanel` | Per-track effect chain editor |
| `EffectModule` | Individual effect (EQ, compressor, reverb, etc.) |
| `MasterSection` | Master gain, metering, limiter, LUFS display |
| `AudioUploader` | Drag-and-drop audio file upload |
| `VoiceGenerator` | TTS generation panel (reuses existing voice picker) |
| `ToneGenerator` | Solfeggio/binaural tone configuration |

---

## 8. Effect Modules - Detail

### Parametric EQ
- 3-band minimum (low shelf, mid peak, high shelf)
- Expandable to 6+ bands for advanced users
- Visual frequency curve display
- FFmpeg: `equalizer` filter per band
- Web Audio: `BiquadFilterNode` chain

### Compressor
- Threshold, ratio, attack, release, makeup gain
- Visual gain reduction meter
- FFmpeg: `acompressor`
- Web Audio: `DynamicsCompressorNode`

### Reverb
- Curated impulse response library (5-10 presets: Small Room, Large Hall, Plate, Cathedral, Outdoor)
- Wet/dry mix control
- Pre-delay option
- FFmpeg: `afir` with bundled IR files
- Web Audio: `ConvolverNode` with IR AudioBuffer

### Sidechain Ducker
- Select trigger track (usually voice)
- Threshold, ratio, attack, release
- "Auto-duck music under voice" as a one-click preset
- FFmpeg: `sidechaincompress`
- Web Audio: Custom `AudioWorkletNode` analyzing trigger track amplitude

### Noise Gate
- Threshold, attack, release
- Useful for cleaning up voice recordings
- FFmpeg: `agate`
- Web Audio: Custom `AudioWorkletNode`

### Time/Pitch
- Playback rate: 0.5x to 2.0x
- Pitch shift: -12 to +12 semitones
- FFmpeg: `rubberband` filter (requires compilation flag)
- Web Audio: `AudioBufferSourceNode.playbackRate` (changes both pitch and speed) or Tone.js `PitchShift`

---

## 9. Render Pipeline - Server Side

When a creator clicks "Render", the `StudioProject` JSON is sent to the server and translated into FFmpeg commands:

### Translation Process

```
StudioProject JSON
       |
       v
  Parse tracks, clips, effects
       |
       v
  For each track:
    1. Collect clip audio sources
    2. Apply clip-level trim (atrim)
    3. Apply clip-level gain (volume)
    4. Apply clip-level fade (afade)
    5. Position clips on timeline (adelay)
    6. Concatenate/overlay clips within track
    7. Apply track effects chain:
       - EQ (equalizer)
       - Compressor (acompressor)
       - Reverb (afir)
       - Gate (agate)
       - Stereo width (stereotools)
    8. Apply track gain + pan
       |
       v
  Mix all tracks:
    [track1][track2]...[trackN]amix=inputs=N:duration=longest
       |
       v
  Apply master effects chain:
    - Master EQ
    - Master compression
    - Sidechain ducking (if configured)
    - Loudness normalization (loudnorm, -16 LUFS)
    - Brick-wall limiting (alimiter)
    - Stereo enforcement (aformat=channel_layouts=stereo)
       |
       v
  Output: MP3 (192-320 kbps) or WAV (PCM 16-bit)
       |
       v
  Upload to audio-renders bucket
  Update track record in DB
  Notify creator
```

### Example Generated filter_complex

For a 3-track project (voice, music, uploaded nature sounds):

```
[0:a]atrim=start=0:end=120,volume=0.891[voice_clip];
[voice_clip]adelay=0|0[voice_pos];
[voice_pos]equalizer=f=200:g=-3:t=q:w=1,acompressor=threshold=-20dB:ratio=3:attack=10:release=100[voice_fx];
[voice_fx]volume=0.891,pan=stereo|c0=c0|c1=c1[voice_out];

[1:a]volume=0.316[music_clip];
[music_clip]adelay=0|0[music_pos];
[music_pos]equalizer=f=100:g=2:t=q:w=0.7[music_fx];
[music_fx]volume=0.316,pan=stereo|c0=0.8*c0|c1=0.8*c1[music_out];

[2:a]atrim=start=5:end=65,volume=0.5[nature_clip];
[nature_clip]adelay=30000|30000[nature_pos];
[nature_pos]highpass=f=80[nature_fx];
[nature_fx]volume=0.5,pan=stereo|c0=c0|c1=c1[nature_out];

[voice_out][music_out][nature_out]amix=inputs=3:duration=longest[mixed];
[mixed]loudnorm=I=-16:TP=-1.5:LRA=11[normalized];
[normalized]alimiter=limit=-0.1dB:attack=5:release=50[limited];
[limited]aformat=channel_layouts=stereo[out]
```

---

## 10. Monetization Model

### Subscription Tier: "Creator Pro"

Creator Studio is gated behind a premium subscription, separate from standard track purchases:

| Feature | Free / Standard | Creator Pro |
|---------|----------------|-------------|
| Builder (guided) | Yes | Yes |
| Edit existing tracks | Yes (with edit fee) | Yes (unlimited) |
| **Creator Studio** | No | **Yes** |
| Custom audio uploads | No | **Yes** |
| Per-track effects | No | **Yes** |
| Multi-track timeline | No | **Yes** |
| High-quality export (320kbps / WAV) | No | **Yes** |
| Priority render queue | No | **Yes** |
| Studio project storage | N/A | **10 projects (expandable)** |
| Upload storage | N/A | **1 GB (expandable)** |

### Pricing Considerations (TBD)

- Monthly subscription ($X/month) or annual ($Y/year)
- Possibly tiered: Creator Pro vs Creator Pro+ (more storage, more projects)
- Render credits system possible if server costs are significant
- Marketplace seller commission structure remains the same

---

## 11. Phased Implementation Roadmap

### Phase 0: Foundation Prep (Before Creator Studio)
*Can be done incrementally alongside other work*

- [ ] Compile FFmpeg with `--enable-librubberband` on render servers
- [ ] Bundle 5-10 impulse response WAV files for reverb presets
- [ ] Extend `FFmpegProcessor` with new filter methods: `applyEQ()`, `applySidechainDuck()`, `applyGate()`, `applyReverb()`, `applyTimeStretch()`, `applyPitchShift()`
- [ ] Build `FilterComplexBuilder` utility that programmatically constructs `filter_complex` strings from a config object (avoids string manipulation bugs)
- [ ] Add waveform peak extraction to `AudioAnalyzer` (for client-side visualization)

### Phase 1: Core Studio UI (MVP)
*Minimum viable studio experience*

- [ ] `StudioLayout` with track lanes and timeline canvas
- [ ] Add/remove tracks (voice, music, upload types)
- [ ] Waveform visualization per clip (wavesurfer.js)
- [ ] Drag clips to position on timeline
- [ ] Per-track gain and mute/solo
- [ ] Basic transport (play/pause/scrub) with Web Audio API
- [ ] Save/load project state (Supabase `studio_projects` table)
- [ ] Server-side render from project JSON via existing job queue

### Phase 2: Audio Upload & Management
*Let creators bring their own audio*

- [ ] Audio file upload UI (drag-and-drop, file picker)
- [ ] Server-side upload processing (format validation, waveform generation, duration extraction)
- [ ] `studio-uploads` storage bucket with RLS
- [ ] Upload library panel (browse/search uploaded files)
- [ ] Clip trimming in timeline (drag clip edges)
- [ ] Fade in/out handles on clips

### Phase 3: Effects System
*Per-track audio processing*

- [ ] Effects panel UI (add/remove/reorder effects per track)
- [ ] EQ module (3-band with visual curve)
- [ ] Compressor module (with gain reduction meter)
- [ ] Reverb module (impulse response presets, wet/dry)
- [ ] Web Audio preview of effects (real-time)
- [ ] FFmpeg render with per-track effect chains

### Phase 4: Advanced Features
*Power-user capabilities*

- [ ] Sidechain ducking (select trigger track)
- [ ] Stereo panning per track
- [ ] Time stretching / pitch shifting
- [ ] Noise gate
- [ ] Master effects chain
- [ ] LUFS metering display
- [ ] Undo/redo (command pattern)
- [ ] Keyboard shortcuts (space = play, delete = remove clip, etc.)

### Phase 5: Polish & Marketplace Integration
*Ready for public launch*

- [ ] Render progress UI with real-time status
- [ ] One-click "Publish to Marketplace" from rendered project
- [ ] Project templates / starter kits
- [ ] Project duplication
- [ ] Export options (MP3 128/192/320, WAV, FLAC)
- [ ] Mobile-responsive studio (simplified view)
- [ ] Creator Pro subscription flow (Stripe)
- [ ] Usage/storage metering and limits

---

## 12. What We're Building On

### Current Audio Engine Strengths (reuse everything)

The existing `packages/audio-engine` is production-ready and provides:

- **FFmpegProcessor** - Multi-track mixing, loudness normalization, format conversion, tone generation, binaural beats, silence insertion, fade effects, stereo enforcement
- **AudioMixer** - Multi-layer orchestration, automatic gain staging, clipping prevention, crossfading
- **GainController** - dB/linear conversion, compression, limiting, LUFS measurement/normalization
- **SolfeggioGenerator** - 9 frequency presets with waveform options
- **BinauralGenerator** - 5 brainwave bands with carrier/beat frequency control
- **QueueManager** - Job submission, status tracking, progress reporting
- **ProgressTracker** - 0-100% progress with status messages and cancellation
- **AudioAnalyzer** - Duration, format, stereo validation, level measurement, metadata extraction
- **StorageUploader** - Supabase storage integration with public/private buckets
- **TempFileManager** - Temp file lifecycle management
- **TTS Providers** - OpenAI (6 voices) and ElevenLabs (premium + cloning)

### Key Extensions Needed

| Current | Creator Studio Extension |
|---------|------------------------|
| 4 fixed layer types | N arbitrary tracks |
| Pre-defined gain levels | User-controlled per-track gain + pan |
| Single effect stage (normalize + limit) | Per-track + master effect chains |
| Fixed timeline (voice loops over music) | Free-form clip positioning |
| Server-only rendering | Client preview + server render |
| No reverb | Convolution reverb via impulse responses |
| No EQ | Parametric EQ per track |
| No sidechain | Sidechain compression between tracks |

---

## 13. Open Questions

1. **FFmpeg.wasm for client-side rendering?** Could eliminate server render costs for simple projects, but adds complexity. Worth investigating for Phase 5+.

2. **Collaborative editing?** Multiple creators working on the same project. CRDTs would support offline editing. Very complex - future consideration only.

3. **MIDI / virtual instruments?** Web Audio API supports oscillators and synthesis. Could add simple instrument tracks (pads, drones) without audio files. Nice-to-have for Phase 5+.

4. **In-browser recording?** `MediaRecorder` API allows recording directly in the studio. Could replace the separate voice clone recording flow. Phase 2 candidate.

5. **Project versioning?** Save multiple versions of a project, compare, revert. JSONB diffing in Postgres. Phase 5 candidate.

6. **Preset effect chains?** "Meditation Voice" preset (compression + EQ + reverb), "Nature Ambiance" preset (highpass + stereo widen). Phase 4 candidate.

7. **AI-assisted mixing?** Use audio analysis to suggest gain levels, EQ curves, or effect settings. "Auto-mix" button. Future exploration.

---

## 14. Competitive Reference

| Product | What to Learn |
|---------|--------------|
| **BandLab** | Free web DAW, multi-track, effects, collaboration. Proves the model works at scale. |
| **Soundtrap** (Spotify) | Web DAW focused on simplicity. Good UX patterns for non-musicians. |
| **Descript** | Audio editing via transcript. Could inspire text-based voice track editing. |
| **Audacity** | Desktop reference for essential features. Keep it simpler than this. |
| **GarageBand** | The UX gold standard for accessible music creation. Our north star for approachability. |
| **Calm / Insight Timer creator tools** | Direct competitors in meditation audio. Their creator tools are basic - opportunity to differentiate. |

---

## 15. Success Criteria

Creator Studio is successful when:

1. **Creators can produce tracks they couldn't make with the Builder** - multiple voice segments, custom audio layers, precise timing
2. **The preview is close enough to final render** - creators don't get surprised by the exported result
3. **Render times remain reasonable** - < 2 minutes for a 10-minute multi-track project
4. **The UI is approachable** - a meditation teacher, not an audio engineer, can use it effectively
5. **It drives subscription revenue** - Creator Pro becomes a meaningful revenue stream
6. **Marketplace quality increases** - Tracks made in Creator Studio are measurably higher quality/more diverse

---

*This document is a living reference. Update it as decisions are made and phases are completed.*
