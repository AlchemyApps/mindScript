import { UserId, Timestamps } from "./common";

export type UserProfile = {
  id: UserId;
  email: string;
  displayName?: string;
  stripeCustomerId?: string;
  roleFlags: string[];
  accentColor?: string;
  bioMarkdown?: string;
  profileImageUrl?: string;
  headerBgImageUrl?: string;
  headerBgColor?: string;
  socialLinks?: Record<string, string>;
} & Timestamps;

// SellerAgreement is now defined in auth.ts to avoid duplicates

export type UserVoice = {
  id: string;
  ownerId: UserId;
  provider: "elevenlabs";
  providerVoiceId: string;
  title: string;
  previewUrl?: string;
  setupFeePaid: boolean;
  active: boolean;
} & Timestamps;