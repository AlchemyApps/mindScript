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

export type SellerAgreement = {
  profileId: UserId;
  acceptedAt: string;
  stripeConnectId?: string;
  status: "pending" | "active" | "suspended" | "rejected";
} & Timestamps;

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