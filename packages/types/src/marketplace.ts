import { 
  UserId, 
  RenderId, 
  PublicationId,
  Platform,
  Timestamps 
} from "./common";
import { SolfeggioFrequency, BinauralBand } from "./audio";

export type Publication = {
  id: PublicationId;
  renderId: RenderId;
  sellerId: UserId;
  isPublished: boolean;
  slug: string;
  description?: string;
  images: string[];
  coverImageUrl?: string;
  bgColor?: string;
  bgImageUrl?: string;
  tags: string[];
  solfeggioHz?: SolfeggioFrequency;
  binauralBand?: BinauralBand;
  priceTierIos?: string;
  priceTierAndroid?: string;
  priceWebCents: number;
} & Timestamps;

export type MarketplaceFilter = {
  category?: string;
  backgroundType?: string;
  voiceProvider?: string;
  language?: string;
  duration?: number;
  priceTier?: string;
  seller?: string;
  stereoOnly?: boolean;
  hasSolfeggio?: boolean;
  hasBinaural?: boolean;
  solfeggioHz?: SolfeggioFrequency;
  binauralBand?: BinauralBand;
};

export type SearchParams = {
  query?: string;
  filters?: MarketplaceFilter;
  sortBy?: "relevance" | "date" | "price" | "popularity";
  sortOrder?: "asc" | "desc";
};

export type MarketplaceFeed = "trending" | "forYou" | "featured" | "new";

export type TrackCard = {
  id: PublicationId;
  title: string;
  description?: string;
  coverImageUrl?: string;
  previewUrl?: string; // 30-60s preview clip
  price: number;
  currency: string;
  platform: Platform;
  seller: {
    id: UserId;
    displayName: string;
    profileImageUrl?: string;
  };
  layers: {
    hasVoice: boolean;
    hasBackground: boolean;
    hasSolfeggio: boolean;
    hasBinaural: boolean;
    solfeggioHz?: SolfeggioFrequency;
    binauralBand?: BinauralBand;
  };
  stats?: {
    plays: number;
    purchases: number;
    saves: number;
  };
};