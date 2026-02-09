import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { TrackTemplate } from './templates/track';
import { SellerTemplate } from './templates/seller';
import { PlaylistTemplate } from './templates/playlist';

export const runtime = 'edge';

// Image dimensions
const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

// Cache configuration
export const revalidate = 604800; // 1 week

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get parameters
    const type = searchParams.get('type') || 'default';
    const id = searchParams.get('id');
    const title = searchParams.get('title');
    const subtitle = searchParams.get('subtitle');
    const image = searchParams.get('image');
    
    // Route to appropriate template based on type
    let element: React.ReactElement;
    
    switch (type) {
      case 'track':
        element = await generateTrackImage(request, { id, title, subtitle, image });
        break;
      case 'seller':
        element = await generateSellerImage(request, { id, title, subtitle, image });
        break;
      case 'playlist':
        element = await generatePlaylistImage(request, { id, title, subtitle, image });
        break;
      default:
        element = await generateDefaultImage({ title, subtitle });
    }
    
    return new ImageResponse(
      element,
      {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        headers: {
          'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400',
        },
      }
    );
  } catch (e: any) {
    console.error(`Failed to generate OG image: ${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}

// Default template
async function generateDefaultImage({ title, subtitle }: any) {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        backgroundImage: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      {/* Logo/Brand */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 40,
        }}
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 100 100"
          fill="white"
          style={{ marginRight: 20 }}
        >
          <circle cx="50" cy="50" r="45" stroke="white" strokeWidth="2" fill="none" />
          <path
            d="M 30 50 Q 50 30, 70 50 T 90 50"
            stroke="white"
            strokeWidth="3"
            fill="none"
          />
          <circle cx="30" cy="50" r="5" fill="white" />
          <circle cx="50" cy="40" r="5" fill="white" />
          <circle cx="70" cy="50" r="5" fill="white" />
        </svg>
        <span style={{ fontSize: 48, fontWeight: 700, color: 'white' }}>
          MindScript
        </span>
      </div>
      
      {/* Title */}
      <div
        style={{
          fontSize: title ? 56 : 72,
          fontWeight: 700,
          color: 'white',
          textAlign: 'center',
          maxWidth: '90%',
          lineHeight: 1.2,
        }}
      >
        {title || 'Transform Your Mind with AI-Powered Audio'}
      </div>
      
      {/* Subtitle */}
      {subtitle && (
        <div
          style={{
            fontSize: 28,
            color: 'rgba(255, 255, 255, 0.9)',
            textAlign: 'center',
            marginTop: 20,
            maxWidth: '80%',
          }}
        >
          {subtitle}
        </div>
      )}
      
      {/* Footer */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: 20,
        }}
      >
        <span>mindscript.app</span>
        <span>•</span>
        <span>AI Meditation & Affirmations</span>
      </div>
    </div>
  );
}

// Track template
async function generateTrackImage(request: NextRequest, { id, title, subtitle, image }: any) {
  const { searchParams } = new URL(request.url);
  const duration = searchParams.get('duration') || '5:00';
  const category = searchParams.get('category') || 'Meditation';
  const playCount = parseInt(searchParams.get('plays') || '0');

  return (
    <TrackTemplate
      title={title || 'Untitled Track'}
      artist={subtitle || 'MindScript Creator'}
      duration={duration}
      category={category}
      playCount={playCount}
      backgroundImage={image}
    />
  );
}

// Seller template
async function generateSellerImage(request: NextRequest, { id, title, subtitle, image }: any) {
  const { searchParams } = new URL(request.url);
  const trackCount = parseInt(searchParams.get('tracks') || '0');
  const followerCount = parseInt(searchParams.get('followers') || '0');
  const rating = parseFloat(searchParams.get('rating') || '0');
  const verified = searchParams.get('verified') === 'true';

  return (
    <SellerTemplate
      name={title || 'Creator'}
      bio={subtitle}
      avatar={image}
      trackCount={trackCount}
      followerCount={followerCount}
      rating={rating}
      verified={verified}
    />
  );
}

// Playlist template
async function generatePlaylistImage(request: NextRequest, { id, title, subtitle, image }: any) {
  const { searchParams } = new URL(request.url);
  const trackCount = parseInt(searchParams.get('tracks') || '0');
  const duration = searchParams.get('duration') || '1h 30m';
  const author = searchParams.get('author');

  // Parse cover images (comma-separated URLs)
  const covers = searchParams.get('covers');
  const coverImages = covers ? covers.split(',') : image ? [image] : [];

  return (
    <PlaylistTemplate
      title={title || 'Untitled Playlist'}
      description={subtitle}
      trackCount={trackCount}
      totalDuration={duration}
      author={author ?? undefined}
      coverImages={coverImages}
    />
  );
}