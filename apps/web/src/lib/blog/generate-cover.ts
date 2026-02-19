import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const COVER_DIR = path.join(__dirname, '../../../public/images/blog');

const STYLE_PREFIX =
  'Abstract digital art, minimal and elegant, soft purple and teal gradients, dark background, no text, no words, no letters, no watermarks.';

/**
 * Generate a blog cover image using DALL-E 3 and save it locally.
 * Returns the public path (e.g. /images/blog/my-slug.webp).
 */
export async function generateBlogCover(opts: {
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

  // Download the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`Failed to download image: ${imageResponse.status}`);

  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  // Save as PNG (DALL-E returns PNG)
  fs.mkdirSync(COVER_DIR, { recursive: true });
  const filename = `${slug}.png`;
  const filepath = path.join(COVER_DIR, filename);
  fs.writeFileSync(filepath, buffer);

  const publicPath = `/images/blog/${filename}`;
  console.log(`Cover image saved: ${publicPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
  return publicPath;
}
