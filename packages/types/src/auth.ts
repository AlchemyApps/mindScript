import { UserId } from "./common";

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
};