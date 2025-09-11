// Brand types for type safety
export type UserId = string & { __brand: "UserId" };
export type AudioProjectId = string & { __brand: "AudioProjectId" };
export type RenderId = string & { __brand: "RenderId" };
export type ScriptId = string & { __brand: "ScriptId" };
export type BackgroundTrackId = string & { __brand: "BackgroundTrackId" };
export type VoiceId = string & { __brand: "VoiceId" };
export type PublicationId = string & { __brand: "PublicationId" };
export type PurchaseId = string & { __brand: "PurchaseId" };

// Common utility types
export type Timestamps = {
  createdAt: string;
  updatedAt: string;
};

export type OptionalTimestamps = Partial<Timestamps>;

export type PaginationParams = {
  page?: number;
  limit?: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// Status enums
export type Status = "pending" | "processing" | "completed" | "failed" | "cancelled";

export type Platform = "web" | "ios" | "android";

// Error types
export type ApiError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};