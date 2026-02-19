#!/usr/bin/env npx tsx
/**
 * Generate a blog cover image using DALL-E 3.
 *
 * Usage:
 *   npx tsx apps/web/scripts/generate-blog-cover.ts <slug> "<prompt>"
 *
 * Example:
 *   npx tsx apps/web/scripts/generate-blog-cover.ts what-are-binaural-beats \
 *     "Sound waves converging into a human brain silhouette, binaural frequency visualization with dual tone waves meeting at the auditory cortex"
 *
 * The image is saved to apps/web/public/images/blog/<slug>.png
 * and the registry entry's coverImage should be set to /images/blog/<slug>.png
 */

import { config } from 'dotenv';
import path from 'path';

// Load env from the web app
config({ path: path.join(__dirname, '../.env.local') });

import { generateBlogCover } from '../src/lib/blog/generate-cover';

async function main() {
  const [slug, prompt] = process.argv.slice(2);

  if (!slug || !prompt) {
    console.error('Usage: npx tsx apps/web/scripts/generate-blog-cover.ts <slug> "<prompt>"');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not found in apps/web/.env.local');
    process.exit(1);
  }

  console.log(`Generating cover for "${slug}"...`);
  console.log(`Prompt: ${prompt}`);

  const publicPath = await generateBlogCover({ slug, prompt });
  console.log(`\nDone! Update registry.ts with:\n  coverImage: '${publicPath}',`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
