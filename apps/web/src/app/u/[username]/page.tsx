import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Image from 'next/image';
import Link from 'next/link';

interface PageProps {
  params: {
    username: string;
  };
}

// Generate static params for SSG
export async function generateStaticParams() {
  const supabase = await createClient();

  // Fetch all active sellers with published tracks
  const { data: sellers } = await supabase
    .from('profiles')
    .select('username')
    .eq('account_status', 'active')
    .not('username', 'is', null)
    .limit(100); // Pre-generate top 100 sellers

  return sellers?.map((seller) => ({
    username: seller.username,
  })) || [];
}

// ISR configuration - revalidate every hour
export const revalidate = 3600;

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      bio,
      avatar_url,
      created_at
    `)
    .eq('username', params.username.toLowerCase())
    .single();

  if (!profile) {
    return {
      title: 'Seller Not Found | MindScript',
      description: 'The seller profile you are looking for could not be found.',
    };
  }

  // Fetch seller stats
  const { data: tracks } = await supabase
    .from('tracks')
    .select('id')
    .eq('user_id', profile.id)
    .eq('status', 'published')
    .eq('is_public', true);

  const trackCount = tracks?.length || 0;

  const title = `${profile.display_name || profile.username} | MindScript Creator`;
  const description = profile.bio ||
    `Discover ${trackCount} mindfulness tracks by ${profile.display_name || profile.username} on MindScript. AI-powered meditations, affirmations, and healing frequencies.`;

  return {
    title,
    description,
    keywords: [
      'mindfulness',
      'meditation',
      'guided meditation',
      'affirmations',
      'healing frequencies',
      'solfeggio',
      'binaural beats',
      profile.display_name || profile.username,
      'MindScript',
    ].join(', '),
    authors: [{ name: profile.display_name || profile.username }],
    creator: profile.display_name || profile.username,
    publisher: 'MindScript',
    openGraph: {
      title,
      description,
      type: 'profile',
      url: `https://mindscript.app/u/${params.username}`,
      images: [
        {
          url: `/api/og?type=seller&title=${encodeURIComponent(
            profile.display_name || profile.username
          )}&subtitle=${encodeURIComponent(
            profile.bio || ''
          )}&image=${encodeURIComponent(
            profile.avatar_url || ''
          )}&tracks=${trackCount}`,
          width: 1200,
          height: 630,
          alt: `${profile.display_name || profile.username} profile`,
        },
      ],
      siteName: 'MindScript',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og?type=seller&title=${encodeURIComponent(
        profile.display_name || profile.username
      )}&tracks=${trackCount}`],
    },
    alternates: {
      canonical: `https://mindscript.app/u/${params.username}`,
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
function generateJsonLd(profile: any, tracks: any[], stats: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `https://mindscript.app/u/${profile.username}`,
    name: profile.display_name || profile.username,
    alternateName: profile.username,
    description: profile.bio,
    image: profile.avatar_url,
    url: `https://mindscript.app/u/${profile.username}`,
    sameAs: [],
    // Professional/Creator attributes
    hasOccupation: {
      '@type': 'Occupation',
      name: 'Content Creator',
      occupationalCategory: 'Audio Content Creation',
    },
    // Performance metrics
    aggregateRating: stats.averageRating ? {
      '@type': 'AggregateRating',
      ratingValue: stats.averageRating,
      ratingCount: stats.totalReviews,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    // Works/Tracks
    audio: tracks.map(track => ({
      '@type': 'AudioObject',
      '@id': `https://mindscript.app/u/${profile.username}/${track.slug}`,
      name: track.title,
      description: track.description,
      creator: {
        '@type': 'Person',
        name: profile.display_name || profile.username,
      },
      duration: track.duration_seconds ? `PT${Math.floor(track.duration_seconds / 60)}M${track.duration_seconds % 60}S` : undefined,
      datePublished: track.created_at,
      contentUrl: track.preview_url,
      thumbnailUrl: track.thumbnail_url,
      genre: track.tags?.join(', '),
      keywords: track.tags?.join(', '),
    })),
    // Marketplace seller info
    makesOffer: tracks.map(track => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'AudioObject',
        name: track.title,
      },
      price: track.price_cents ? (track.price_cents / 100).toFixed(2) : '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Person',
        name: profile.display_name || profile.username,
      },
    })),
  };
}

export default async function SellerProfilePage({ params }: PageProps) {
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
      created_at,
      email_verified,
      account_status
    `)
    .eq('username', params.username.toLowerCase())
    .single();

  if (profileError || !profile || profile.account_status !== 'active') {
    notFound();
  }

  // Fetch seller stats from seller_profiles if exists
  const { data: sellerProfile } = await supabase
    .from('seller_profiles')
    .select(`
      total_sales,
      total_revenue,
      average_rating,
      status,
      business_name
    `)
    .eq('user_id', profile.id)
    .single();

  // Fetch published tracks
  const { data: tracks } = await supabase
    .from('tracks')
    .select(`
      id,
      title,
      description,
      slug:title,
      audio_url,
      preview_url: audio_url,
      thumbnail_url: audio_url,
      duration_seconds,
      price_cents,
      play_count,
      tags,
      created_at,
      updated_at
    `)
    .eq('user_id', profile.id)
    .eq('status', 'published')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  // Transform track slugs (in production, you'd have actual slugs in DB)
  const tracksWithSlugs = tracks?.map(track => ({
    ...track,
    slug: track.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  })) || [];

  // Calculate stats
  const totalTracks = tracksWithSlugs.length;
  const totalPlays = tracksWithSlugs.reduce((sum, track) => sum + (track.play_count || 0), 0);

  const stats = {
    totalTracks,
    totalPlays,
    totalSales: sellerProfile?.total_sales || 0,
    totalRevenue: sellerProfile?.total_revenue || 0,
    averageRating: sellerProfile?.average_rating || 0,
    totalReviews: 0, // Would come from reviews table
  };

  // Generate structured data
  const jsonLd = generateJsonLd(profile, tracksWithSlugs, stats);

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <div className="container mx-auto px-4 py-16">
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Avatar */}
              <div className="relative w-32 h-32 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-white shadow-xl">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={profile.display_name || profile.username}
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-400 to-indigo-400 flex items-center justify-center">
                    <span className="text-4xl md:text-6xl font-bold">
                      {(profile.display_name || profile.username)[0].toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Profile Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-bold mb-2">
                  {profile.display_name || profile.username}
                </h1>
                {sellerProfile?.business_name && (
                  <p className="text-lg md:text-xl opacity-90 mb-4">
                    {sellerProfile.business_name}
                  </p>
                )}
                {profile.bio && (
                  <p className="text-base md:text-lg opacity-90 mb-6 max-w-2xl">
                    {profile.bio}
                  </p>
                )}

                {/* Stats */}
                <div className="flex flex-wrap justify-center md:justify-start gap-6 text-sm md:text-base">
                  <div>
                    <span className="font-bold text-2xl md:text-3xl block">
                      {stats.totalTracks}
                    </span>
                    <span className="opacity-75">Tracks</span>
                  </div>
                  <div>
                    <span className="font-bold text-2xl md:text-3xl block">
                      {stats.totalPlays.toLocaleString()}
                    </span>
                    <span className="opacity-75">Total Plays</span>
                  </div>
                  {stats.averageRating > 0 && (
                    <div>
                      <span className="font-bold text-2xl md:text-3xl block">
                        {stats.averageRating.toFixed(1)}
                      </span>
                      <span className="opacity-75">Rating</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tracks Section */}
        <div className="container mx-auto px-4 py-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-gray-900">
            Published Tracks ({stats.totalTracks})
          </h2>

          {tracksWithSlugs.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-lg">No tracks published yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {tracksWithSlugs.map((track) => (
                <Link
                  key={track.id}
                  href={`/u/${params.username}/${track.slug}`}
                  className="group block"
                >
                  <article className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden">
                    {/* Thumbnail */}
                    <div className="aspect-square bg-gradient-to-br from-purple-400 to-indigo-400 relative">
                      <div className="absolute inset-0 flex items-center justify-center text-white">
                        <svg
                          className="w-16 h-16 opacity-50 group-hover:scale-110 transition-transform"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                        </svg>
                      </div>
                    </div>

                    {/* Track Info */}
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-2 text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-1">
                        {track.title}
                      </h3>
                      {track.description && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {track.description}
                        </p>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>
                          {track.duration_seconds
                            ? `${Math.floor(track.duration_seconds / 60)}:${(track.duration_seconds % 60).toString().padStart(2, '0')}`
                            : 'N/A'}
                        </span>
                        {track.price_cents !== null && track.price_cents > 0 && (
                          <span className="font-semibold text-green-600">
                            ${(track.price_cents / 100).toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Tags */}
                      {track.tags && track.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {track.tags.slice(0, 3).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}