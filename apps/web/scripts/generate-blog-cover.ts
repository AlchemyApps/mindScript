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
import fs from 'fs';
import OpenAI from 'openai';

// Load env from the web app
config({ path: path.join(__dirname, '../.env.local') });

const COVER_DIR = path.join(__dirname, '../public/images/blog');

const STYLE_PREFIX =
  'Abstract digital art, minimal and elegant, soft purple and teal gradients, dark background, no text, no words, no letters, no watermarks.';

async function generateBlogCover(opts: {
  slug: string;
  prompt: string;
  size?: '1792x1024' | '1024x1024' | '1024x1792';
}): Promise<string> {
  const { slug, prompt, size = '1792x1024' } = opts;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: `${STYLE_PREFIX} ${prompt}`,
    n: 1,
    size,
    quality: 'standard',
    response_format: 'url',
  });

  const imageUrl = response.data[0]?.url;
  if (!imageUrl) throw new Error('DALL-E 3 returned no image URL');

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`Failed to download image: ${imageResponse.status}`);

  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  fs.mkdirSync(COVER_DIR, { recursive: true });
  const filename = `${slug}.png`;
  const filepath = path.join(COVER_DIR, filename);
  fs.writeFileSync(filepath, buffer);

  const publicPath = `/images/blog/${filename}`;
  console.log(`Cover image saved: ${publicPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  return publicPath;
}

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
