import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrackDetailClient } from "./client";
import { formatPrice, formatDuration } from "@mindscript/schemas";

interface PageProps {
  params: { id: string };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = createClient();
  
  const { data: track } = await supabase
    .from("tracks")
    .select(`
      *,
      owner:profiles!user_id (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq("id", params.id)
    .eq("status", "published")
    .single();

  if (!track) {
    return {
      title: "Track Not Found",
    };
  }

  const price = formatPrice(track.price_cents || 0);
  const duration = formatDuration(track.duration_seconds || 0);

  return {
    title: `${track.title} - MindScript Marketplace`,
    description: track.description || `${track.title} by ${track.owner?.display_name}. ${duration} audio track available for ${price}.`,
    openGraph: {
      title: track.title,
      description: track.description || `Audio track by ${track.owner?.display_name}`,
      type: "music.song",
      images: track.cover_image_url ? [track.cover_image_url] : [],
      siteName: "MindScript",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: track.title,
      description: track.description || `Audio track by ${track.owner?.display_name}`,
      images: track.cover_image_url ? [track.cover_image_url] : [],
    },
    alternates: {
      canonical: `/marketplace/track/${track.id}`,
    },
  };
}

// Generate JSON-LD structured data
function generateJsonLd(track: any) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: track.title,
    description: track.description,
    image: track.cover_image_url,
    offers: {
      "@type": "Offer",
      price: (track.price_cents / 100).toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Person",
        name: track.owner?.display_name || "Unknown",
      },
    },
    category: track.category,
    duration: `PT${Math.floor(track.duration_seconds / 60)}M${track.duration_seconds % 60}S`,
    aggregateRating: track.rating_average ? {
      "@type": "AggregateRating",
      ratingValue: track.rating_average,
      reviewCount: track.rating_count || 0,
    } : undefined,
  };
}

export default async function TrackDetailPage({ params }: PageProps) {
  const supabase = createClient();
  
  // Fetch track details
  const { data: track, error } = await supabase
    .from("tracks")
    .select(`
      *,
      owner:profiles!user_id (
        id,
        display_name,
        avatar_url,
        bio
      )
    `)
    .eq("id", params.id)
    .eq("status", "published")
    .single();

  if (error || !track) {
    notFound();
  }

  // Fetch related tracks (same category, different track)
  const { data: relatedTracks } = await supabase
    .from("tracks")
    .select(`
      *,
      owner:profiles!user_id (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq("category", track.category)
    .eq("status", "published")
    .neq("id", track.id)
    .limit(4);

  // Fetch more tracks from the same seller
  const { data: sellerTracks } = await supabase
    .from("tracks")
    .select(`
      *,
      owner:profiles!user_id (
        id,
        display_name,
        avatar_url
      )
    `)
    .eq("user_id", track.user_id)
    .eq("status", "published")
    .neq("id", track.id)
    .limit(4);

  // Format track for client
  const formattedTrack = {
    ...track,
    formatted_price: formatPrice(track.price_cents || 0),
    formatted_duration: formatDuration(track.duration_seconds || 0),
    seller: {
      id: track.user_id,
      display_name: track.owner?.display_name || "Unknown",
      avatar_url: track.owner?.avatar_url,
      bio: track.owner?.bio,
    },
  };

  const formattedRelated = (relatedTracks || []).map(t => ({
    ...t,
    formatted_price: formatPrice(t.price_cents || 0),
    seller: {
      id: t.user_id,
      display_name: t.owner?.display_name || "Unknown",
      avatar_url: t.owner?.avatar_url,
    },
  }));

  const formattedSellerTracks = (sellerTracks || []).map(t => ({
    ...t,
    formatted_price: formatPrice(t.price_cents || 0),
    seller: {
      id: t.user_id,
      display_name: t.owner?.display_name || "Unknown",
      avatar_url: t.owner?.avatar_url,
    },
  }));

  const jsonLd = generateJsonLd(track);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TrackDetailClient
        track={formattedTrack}
        relatedTracks={formattedRelated}
        sellerTracks={formattedSellerTracks}
      />
    </>
  );
}