# MindScript

> Program your inner voice through personalized affirmation loops with AI voice and binaural sound.

## Overview

MindScript is a comprehensive AI-powered audio affirmation platform that allows users to create, customize, and distribute personalized audio content with:

- **AI-Generated Voices**: OpenAI TTS and ElevenLabs custom voice cloning
- **Background Music**: Platform library and personal uploads
- **Solfeggio Frequencies**: Pure tone generation (174-963 Hz)
- **Binaural Beats**: L/R channel separation for brainwave entrainment
- **Cross-Platform**: Web (Next.js) and mobile (React Native/Expo)
- **Marketplace**: Seller system with Stripe Connect payouts

## Architecture

This is a Turborepo monorepo containing:

```
├── apps/
│   ├── web/          # Next.js web application
│   └── mobile/       # Expo React Native app
└── packages/
    ├── ui/           # Shared UI components
    ├── types/        # TypeScript type definitions
    ├── schemas/      # Zod validation schemas
    ├── audio-engine/ # Audio processing utilities
    └── config/       # Shared tooling configuration
```

## Tech Stack

- **Frontend**: Next.js 14, React Native (Expo), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Audio**: FFmpeg, OpenAI TTS, ElevenLabs
- **Payments**: Stripe Checkout, Stripe Connect, RevenueCat (mobile)
- **Deployment**: Vercel (web), EAS (mobile)

## Development

### Prerequisites

- Node.js 18+
- npm 8+

### Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Configure your environment variables
   ```

3. Start development servers:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run build` - Build all apps and packages
- `npm run dev` - Start development servers
- `npm run lint` - Lint all packages
- `npm run typecheck` - Run TypeScript checks
- `npm run test` - Run all tests
- `npm run clean` - Clean build artifacts

## Quality Standards

- **TypeScript**: Strict mode, no `any` types
- **Testing**: ≥80% coverage (≥90% for critical packages)
- **Security**: RLS policies, signed URLs, webhook verification
- **Performance**: <400ms API p95, <60s audio rendering
- **Audio**: Stereo enforcement, LUFS normalization

## Contributing

1. Follow the task-driven development workflow with Archon
2. Write tests first (TDD approach)
3. Ensure all quality gates pass
4. Update documentation as needed

## License

All rights reserved.