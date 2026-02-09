"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@mindscript/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@mindscript/ui";
import { Badge } from "@mindscript/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@mindscript/ui";
import { 
  PlayIcon, 
  ShoppingCartIcon, 
  ClockIcon,
  TagIcon,
  UserIcon,
  StarIcon,
} from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { getCategoryIcon, getCategoryLabel } from "@mindscript/schemas";
import { TrackCard } from "../../components/TrackCard";

interface TrackDetailClientProps {
  track: any;
  relatedTracks: any[];
  sellerTracks: any[];
}

export function TrackDetailClient({ 
  track, 
  relatedTracks, 
  sellerTracks 
}: TrackDetailClientProps) {
  const router = useRouter();
  const addToCart = useCartStore((state) => state.addItem);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleAddToCart = () => {
    addToCart({
      trackId: track.id,
      title: track.title,
      price: track.price_cents,
      sellerId: track.user_id,
      artistName: track.seller.display_name || "Unknown",
      artistId: track.user_id,
      sellerConnectAccountId: "",
      imageUrl: track.cover_image_url,
    });
  };

  const handlePreview = () => {
    setIsPlaying(!isPlaying);
    // TODO: Implement actual audio preview
  };

  const handleTrackClick = (trackId: string) => {
    router.push(`/marketplace/track/${trackId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-sm mb-6">
          <ol className="flex items-center space-x-2">
            <li>
              <a href="/marketplace" className="text-muted-foreground hover:text-foreground">
                Marketplace
              </a>
            </li>
            <li className="text-muted-foreground">/</li>
            <li>
              <a 
                href={`/marketplace?category=${track.category}`}
                className="text-muted-foreground hover:text-foreground"
              >
                {getCategoryLabel(track.category)}
              </a>
            </li>
            <li className="text-muted-foreground">/</li>
            <li className="text-foreground font-medium">{track.title}</li>
          </ol>
        </nav>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Track Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Track Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  {/* Cover Image */}
                  {track.cover_image_url && (
                    <div className="w-full md:w-48 h-48 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={track.cover_image_url}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  {/* Track Info */}
                  <div className="flex-1 space-y-4">
                    <div>
                      <h1 className="text-3xl font-bold mb-2">{track.title}</h1>
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-4 w-4" />
                          {track.seller.display_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          {track.formatted_duration}
                        </span>
                      </div>
                    </div>
                    
                    {/* Tags and Category */}
                    <div className="flex flex-wrap gap-2">
                      <Badge>
                        {getCategoryIcon(track.category)} {getCategoryLabel(track.category)}
                      </Badge>
                      {track.tags?.map((tag: string) => (
                        <Badge key={tag} variant="secondary">
                          <TagIcon className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    
                    {/* Price and Actions */}
                    <div className="flex items-center gap-4">
                      <span className="text-3xl font-bold">
                        {track.formatted_price}
                      </span>
                      <Button size="lg" onClick={handleAddToCart}>
                        <ShoppingCartIcon className="h-5 w-5 mr-2" />
                        Add to Cart
                      </Button>
                      <Button size="lg" variant="outline" onClick={handlePreview}>
                        <PlayIcon className="h-5 w-5 mr-2" />
                        {isPlaying ? "Pause" : "Preview"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description and Details */}
            <Tabs defaultValue="description" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
              </TabsList>
              
              <TabsContent value="description" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {track.description || "No description available."}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="features" className="mt-4">
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {track.hasVoice && (
                        <div>
                          <h4 className="font-medium mb-1">Voice Narration</h4>
                          <p className="text-sm text-muted-foreground">
                            Professional voice guidance included
                          </p>
                        </div>
                      )}
                      {track.hasBackground && (
                        <div>
                          <h4 className="font-medium mb-1">Background Music</h4>
                          <p className="text-sm text-muted-foreground">
                            Calming background music
                          </p>
                        </div>
                      )}
                      {track.hasSolfeggio && (
                        <div>
                          <h4 className="font-medium mb-1">Solfeggio Frequencies</h4>
                          <p className="text-sm text-muted-foreground">
                            {track.solfeggioHz}Hz healing frequency
                          </p>
                        </div>
                      )}
                      {track.hasBinaural && (
                        <div>
                          <h4 className="font-medium mb-1">Binaural Beats</h4>
                          <p className="text-sm text-muted-foreground">
                            {track.binauralBand} band frequencies
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="reviews" className="mt-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center py-8 text-muted-foreground">
                      <StarIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>No reviews yet</p>
                      <p className="text-sm mt-2">Be the first to review this track</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Seller Info */}
          <div className="space-y-6">
            {/* Seller Card */}
            <Card>
              <CardHeader>
                <CardTitle>About the Seller</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
                    {track.seller.avatar_url ? (
                      <img src={track.seller.avatar_url} alt={track.seller.display_name || ''} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-semibold text-gray-500">
                        {track.seller.display_name?.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{track.seller.display_name}</h3>
                    {track.seller.badge && (
                      <Badge variant="secondary" className="mt-1">
                        {track.seller.badge}
                      </Badge>
                    )}
                  </div>
                </div>
                {track.seller.bio && (
                  <p className="text-sm text-muted-foreground">
                    {track.seller.bio}
                  </p>
                )}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => router.push(`/u/${track.seller.display_name}`)}
                >
                  View Profile
                </Button>
              </CardContent>
            </Card>

            {/* More from Seller */}
            {sellerTracks.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>More from {track.seller.display_name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {sellerTracks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded-md transition-colors"
                      onClick={() => handleTrackClick(t.id)}
                    >
                      {t.cover_image_url && (
                        <div className="w-12 h-12 rounded bg-muted flex-shrink-0">
                          <img
                            src={t.cover_image_url}
                            alt={t.title}
                            className="w-full h-full object-cover rounded"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.formatted_price}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Related Tracks */}
        {relatedTracks.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Related Tracks</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedTracks.map((t) => (
                <TrackCard
                  key={t.id}
                  track={t}
                  onClick={handleTrackClick}
                  variant="grid"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}