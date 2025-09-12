import { UserId } from "./common";

// ============================================================================
// Core Authentication Types
// ============================================================================

export type AuthUser = {
  id: UserId;
  email: string;
  emailVerified?: boolean;
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
  role?: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
};

export type AuthError = {
  message: string;
  status?: number;
  code?: string;
};

// ============================================================================
// Profile & User Management Types
// ============================================================================

export interface Profile {
  id: UserId;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  stripeCustomerId?: string;
  roleFlags: {
    isAdmin: boolean;
    isSeller: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  userId: UserId;
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  emailUpdates: boolean;
  language: string;
  timezone: string;
  privacySettings: {
    profilePublic: boolean;
    showPurchases: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SellerAgreement {
  id: string;
  userId: UserId;
  acceptedAt: string;
  agreementVersion: string;
  stripeConnectId?: string;
  onboardingStatus: 'pending' | 'in_progress' | 'completed' | 'failed';
  capabilities: {
    transfers: boolean;
    payouts: boolean;
  };
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProfile {
  id: UserId;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  createdAt: string;
  isSeller: boolean;
}

// ============================================================================
// Authentication Flow Types
// ============================================================================

export type AuthProvider = 'email' | 'google' | 'github';

export interface SignUpCredentials {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
}

export interface ProfileUpdateData {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface PreferencesUpdateData {
  theme?: 'light' | 'dark' | 'system';
  notificationsEnabled?: boolean;
  emailUpdates?: boolean;
  language?: string;
  timezone?: string;
  privacySettings?: Partial<UserPreferences['privacySettings']>;
}

export interface SellerAgreementAcceptance {
  agreementVersion: string;
  acceptedAt: string;
}

export interface StripeConnectOnboarding {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
  onboardingUrl: string;
}

// ============================================================================
// Extended User Type with Profile
// ============================================================================

export interface AuthUserWithProfile extends AuthUser {
  profile?: Profile;
  preferences?: UserPreferences;
  sellerAgreement?: SellerAgreement;
}