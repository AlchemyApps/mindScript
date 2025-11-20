import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import Link from 'next/link';
import { TrackPurchaseButton } from '@/components/track/purchase-button';

interface PageProps {
  params: {
    username: string;
    slug: string;
  };
}

const formatPrice = (priceCents?: number | null) => {
  if (!priceCents || priceCents <= 0) return 'Free';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(priceCents / 100);
};

const formatDuration = (durationSeconds?: number | null) => {
  if (!durationSeconds || durationSeconds <= 0) return 'N/A';
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = (durationSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
};

// Generate static params for SSG
export async function generateStaticParams() {
  const supabase = await createClient();

  // Fetch top published tracks with their sellers
  const { data: tracks } = await supabase
    .from('tracks')
    .select(`
      slug,
      user_id,
      profiles!inner(username)
    `)
    .eq('status', 'published')
    .eq('is_public', true)
    .order('play_count', { ascending: false })
    .limit(100); // Pre-generate top 100 tracks

  return tracks
    ?.filter((track) => track.slug)
    .map((track) => ({
      username: track.profiles.username,
      slug: track.slug,
    })) || [];
}

// ISR configuration - revalidate every hour
export const revalidate = 3600;

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient();

  // First get the seller profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .eq('username', params.username.toLowerCase())
    .single();

  if (!profile) {
    return {
      title: 'Track Not Found | MindScript',
      description: 'The track you are looking for could not be found.',
    };
  }

  // Get the track by matching the slug pattern
  const { data: track } = await supabase
    .from('tracks')
    .select(`
      id,
      slug,
      title,
      description,
      duration_seconds,
      price_cents,
      tags,
      play_count,
      created_at,
      updated_at,
      audio_url
    `)
    .eq('user_id', profile.id)
    .eq('status', 'published')
    .eq('is_public', true)
    .eq('slug', params.slug)
    .maybeSingle();

  if (!track) {
    return {
      title: 'Track Not Found | MindScript',
      description: 'The track you are looking for could not be found.',
    };
  }

  const title = `${track.title} by ${profile.display_name || profile.username} | MindScript`;
  const description = track.description ||
    `Listen to "${track.title}" by ${profile.display_name || profile.username} on MindScript. ${track.tags?.join(', ') || 'Mindfulness audio'}.`;

  const duration = track.duration_seconds
    ? `${Math.floor(track.duration_seconds / 60)}:${(track.duration_seconds % 60).toString().padStart(2, '0')}`
    : undefined;

  return {
    title,
    description,
    keywords: [
      track.title,
      profile.display_name || profile.username,
      ...(track.tags || []),
      'mindfulness',
      'meditation',
      'guided meditation',
      'affirmations',
      'MindScript',
    ].join(', '),
    authors: [{ name: profile.display_name || profile.username }],
    creator: profile.display_name || profile.username,
    publisher: 'MindScript',
    openGraph: {
      title,
      description,
      type: 'music.song',
      url: `https://mindscript.app/u/${params.username}/${params.slug}`,
      audio: track.audio_url,
      images: [
        {
          url: `/api/og?type=track&title=${encodeURIComponent(
            track.title
          )}&subtitle=${encodeURIComponent(
            profile.display_name || profile.username
          )}&duration=${encodeURIComponent(duration || '')}&category=${encodeURIComponent(
            track.tags?.[0] || 'Meditation'
          )}&plays=${track.play_count}`,
          width: 1200,
          height: 630,
          alt: track.title,
        },
      ],
      siteName: 'MindScript',
      'music:duration': track.duration_seconds,
      'music:album': 'MindScript Library',
      'music:musician': `https://mindscript.app/u/${params.username}`,
    },
    twitter: {
      card: 'player',
      title,
      description,
      images: [`/api/og?type=track&title=${encodeURIComponent(track.title)}`],
      players: [
        {
          playerUrl: `https://mindscript.app/embed/${track.id}`,
          streamUrl: track.audio_url,
          width: 480,
          height: 480,
        },
      ],
    },
    alternates: {
      canonical: `https://mindscript.app/u/${params.username}/${params.slug}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

// Generate JSON-LD structured data
function generateJsonLd(track: any, profile: any, relatedTracks: any[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AudioObject',
    '@id': `https://mindscript.app/u/${profile.username}/${track.slug}`,
    name: track.title,
    description: track.description,
    creator: {
      '@type': 'Person',
      '@id': `https://mindscript.app/u/${profile.username}`,
      name: profile.display_name || profile.username,
      url: `https://mindscript.app/u/${profile.username}`,
      image: profile.avatar_url,
    },
    datePublished: track.created_at,
    dateModified: track.updated_at,
    duration: track.duration_seconds ? `PT${Math.floor(track.duration_seconds / 60)}M${track.duration_seconds % 60}S` : undefined,
    contentUrl: track.audio_url,
    encodingFormat: 'audio/mpeg',
    genre: track.tags?.join(', '),
    keywords: track.tags?.join(', '),
    interactionStatistic: {
      '@type': 'InteractionCounter',
      interactionType: 'https://schema.org/ListenAction',
      userInteractionCount: track.play_count || 0,
    },
    offers: track.price_cents > 0 ? {
      '@type': 'Offer',
      price: (track.price_cents / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Person',
        name: profile.display_name || profile.username,
      },
    url: `https://mindscript.app/u/${profile.username}/${track.slug}`,
    } : undefined,
    isPartOf: {
      '@type': 'AudioObjectCollection',
      name: `${profile.display_name || profile.username}'s Tracks`,
      url: `https://mindscript.app/u/${profile.username}`,
    },
    // Related tracks
    relatedLink: relatedTracks.map(related => {
      const relatedSlug = related.slug ||
        related.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return `https://mindscript.app/u/${profile.username}/${relatedSlug}`;
    }),
  };
}

// Audio Player Component
function AudioPlayer({ track, previewUrl }: { track: any; previewUrl?: string | null }) {
  const duration = formatDuration(track.duration_seconds);
  const priceLabel = formatPrice(track.price_cents);

  return (
    <div className="rounded-lg border border-purple-100 bg-white/70 p-6 shadow-sm">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-600 mb-2">Preview</p>
          {previewUrl ? (
            <audio
              controls
              preload="none"
              src={previewUrl}
              className="w-full"
            >
              Your browser does not support the audio element.
            </audio>
          ) : (
            <p className="text-sm text-gray-500">
              Preview not available for this track yet.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-gray-500">Duration</p>
            <p className="text-lg font-semibold text-gray-900">{duration}</p>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">Price</p>
            <p className="text-3xl font-bold text-gray-900">{priceLabel}</p>
            <TrackPurchaseButton
              trackId={track.id}
              className="mt-3 w-full md:w-auto"
            >
              {track.price_cents > 0 ? `Buy for ${priceLabel}` : 'Add to Library'}
            </TrackPurchaseButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function TrackDetailPage({ params }: PageProps) {
  const supabase = await createClient();

  // Fetch seller profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      bio,
      avatar_url,
      account_status
    `)
    .eq('username', params.username.toLowerCase())
    .single();

  if (profileError || !profile || profile.account_status !== 'active') {
    notFound();
  }

  // Fetch requested track by slug
  const { data: track, error: trackError } = await supabase
    .from('tracks')
    .select(`
      id,
      slug,
      title,
      description,
      script,
      audio_url,
      preview_url,
      duration_seconds,
      price_cents,
      play_count,
      tags,
      voice_config,
      music_config,
      frequency_config,
      created_at,
      updated_at
    `)
    .eq('user_id', profile.id)
    .eq('status', 'published')
    .eq('is_public', true)
    .eq('slug', params.slug)
    .maybeSingle();

  if (trackError || !track) {
    notFound();
  }

  const { data: relatedTracks } = await supabase
    .from('tracks')
    .select(`
      id,
      slug,
      title,
      description,
      duration_seconds,
      price_cents,
      play_count,
      tags
    `)
    .eq('user_id', profile.id)
    .eq('status', 'published')
    .eq('is_public', true)
    .neq('id', track.id)
    .limit(4);

  let previewSignedUrl: string | null = null;
  try {
    if (track.preview_url) {
      const { data, error } = await supabase.storage
        .from('tracks-public')
        .createSignedUrl(track.preview_url, 3600);
      if (error) {
        console.error('Failed to sign public preview URL', error);
      } else {
        previewSignedUrl = data?.signedUrl || null;
      }
    } else if (track.audio_url) {
      const { data, error } = await supabase.storage
        .from('tracks-private')
        .createSignedUrl(track.audio_url, 300);
      if (error) {
        console.error('Failed to sign private preview URL', error);
      } else {
        previewSignedUrl = data?.signedUrl || null;
      }
    }
  } catch (error) {
    console.error('Unable to generate preview URL', error);
  }

  const jsonLd = generateJsonLd(track, profile, relatedTracks || []);

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Breadcrumb */}
        <nav className="container mx-auto px-4 py-4" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-sm text-gray-500">
            <li>
              <Link href="/" className="hover:text-purple-600">
                Home
              </Link>
            </li>
            <li>
              <span className="mx-2">/</span>
            </li>
            <li>
              <Link
                href={`/u/${params.username}`}
                className="hover:text-purple-600"
              >
                {profile.display_name || profile.username}
              </Link>
            </li>
            <li>
              <span className="mx-2">/</span>
            </li>
            <li className="text-gray-900 font-medium">{track.title}</li>
          </ol>
        </nav>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Column */}
            <div className="lg:col-span-2">
              {/* Track Header */}
              <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
                  {track.title}
                </h1>

                {/* Creator Info */}
                <Link
                  href={`/u/${params.username}`}
                  className="inline-flex items-center gap-3 mb-6 group"
                >
                  <div className="relative w-12 h-12 rounded-full overflow-hidden">
                    {profile.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={profile.display_name || profile.username}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-400 flex items-center justify-center text-white font-bold">
                        {(profile.display_name || profile.username)[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                      {profile.display_name || profile.username}
                    </p>
                    <p className="text-sm text-gray-500">Creator</p>
                  </div>
                </Link>

                {/* Audio Player */}
                <AudioPlayer track={track} previewUrl={previewSignedUrl} />

                {/* Tags */}
                {track.tags && track.tags.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Categories
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {track.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {track.description && (
                <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900">
                    About This Track
                  </h2>
                  <p className="text-gray-700 leading-relaxed">
                    {track.description}
                  </p>
                </div>
              )}

              {/* Script */}
              {track.script && (
                <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900">
                    Script
                  </h2>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap font-mono text-sm">
                      {track.script}
                    </p>
                  </div>
                </div>
              )}

              {/* Technical Details */}
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold mb-4 text-gray-900">
                  Technical Details
                </h2>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {track.voice_config?.provider && (
                    <>
                      <dt className="font-semibold text-gray-700">Voice Provider</dt>
                      <dd className="text-gray-600 capitalize">
                        {track.voice_config.provider}
                      </dd>
                    </>
                  )}
                  {track.voice_config?.voice_id && (
                    <>
                      <dt className="font-semibold text-gray-700">Voice</dt>
                      <dd className="text-gray-600 capitalize">
                        {track.voice_config.voice_id}
                      </dd>
                    </>
                  )}
                  {track.music_config && (
                    <>
                      <dt className="font-semibold text-gray-700">Background Music</dt>
                      <dd className="text-gray-600">Yes</dd>
                    </>
                  )}
                  {track.frequency_config && (
                    <>
                      <dt className="font-semibold text-gray-700">Frequencies</dt>
                      <dd className="text-gray-600">
                        {track.frequency_config.type || 'Custom'}
                      </dd>
                    </>
                  )}
                  <dt className="font-semibold text-gray-700">Format</dt>
                  <dd className="text-gray-600">MP3</dd>
                  <dt className="font-semibold text-gray-700">Published</dt>
                  <dd className="text-gray-600">
                    {new Date(track.created_at).toLocaleDateString()}
                  </dd>
                </dl>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              {/* Stats */}
              <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <h3 className="text-lg font-bold mb-4 text-gray-900">Statistics</h3>
                <dl className="space-y-3">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Total Plays</dt>
                    <dd className="font-semibold text-gray-900">
                      {(track.play_count || 0).toLocaleString()}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Duration</dt>
                    <dd className="font-semibold text-gray-900">
                      {formatDuration(track.duration_seconds)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Price</dt>
                    <dd className="font-semibold text-green-600">
                      {formatPrice(track.price_cents)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Related Tracks */}
              {relatedTracks && relatedTracks.length > 0 && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-bold mb-4 text-gray-900">
                    More from {profile.display_name || profile.username}
                  </h3>
                  <div className="space-y-3">
                    {relatedTracks.map((related) => {
                      const relatedSlug = related.slug
                        || related.title
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .replace(/^-|-$/g, '');
                      return (
                        <Link
                          key={related.id}
                          href={`/u/${params.username}/${relatedSlug}`}
                          className="block p-3 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <p className="font-medium text-gray-900 mb-1">
                            {related.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDuration(related.duration_seconds)}
                            {related.price_cents > 0 && (
                              <span className="ml-2">
                                • {formatPrice(related.price_cents)}
                              </span>
                            )}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
