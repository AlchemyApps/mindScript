import { describe, it, expect } from "vitest";
import {
  voiceUploadSchema,
  voiceConsentSchema,
  clonedVoiceSchema,
  voiceCloneRequestSchema,
  voiceCloneResponseSchema,
  voicePreviewRequestSchema,
  voiceUsageSchema,
  voiceManagementSchema,
} from "./voice-cloning";

describe("Voice Cloning Schemas", () => {
  describe("voiceUploadSchema", () => {
    it("should validate valid voice upload data", () => {
      const validData = {
        fileName: "voice-sample.mp3",
        fileSize: 2048000, // 2MB
        mimeType: "audio/mpeg",
        duration: 120, // 2 minutes
        sampleRate: 44100,
        bitrate: 128000,
      };

      const result = voiceUploadSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject files that are too large", () => {
      const invalidData = {
        fileName: "voice-sample.mp3",
        fileSize: 11000000, // 11MB
        mimeType: "audio/mpeg",
        duration: 120,
        sampleRate: 44100,
        bitrate: 128000,
      };

      const result = voiceUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("10MB");
      }
    });

    it("should reject invalid audio formats", () => {
      const invalidData = {
        fileName: "voice-sample.txt",
        fileSize: 2048000,
        mimeType: "text/plain",
        duration: 120,
        sampleRate: 44100,
        bitrate: 128000,
      };

      const result = voiceUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject audio that is too short", () => {
      const invalidData = {
        fileName: "voice-sample.mp3",
        fileSize: 2048000,
        mimeType: "audio/mpeg",
        duration: 30, // 30 seconds
        sampleRate: 44100,
        bitrate: 128000,
      };

      const result = voiceUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("60 seconds");
      }
    });

    it("should reject audio that is too long", () => {
      const invalidData = {
        fileName: "voice-sample.mp3",
        fileSize: 2048000,
        mimeType: "audio/mpeg",
        duration: 200, // Over 3 minutes
        sampleRate: 44100,
        bitrate: 128000,
      };

      const result = voiceUploadSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("180 seconds");
      }
    });
  });

  describe("voiceConsentSchema", () => {
    it("should validate valid consent data", () => {
      const validData = {
        hasConsent: true,
        isOver18: true,
        acceptsTerms: true,
        ownsVoice: true,
        understandsUsage: true,
        noImpersonation: true,
        timestamp: new Date().toISOString(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const result = voiceConsentSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject if any consent is false", () => {
      const invalidData = {
        hasConsent: true,
        isOver18: false, // Under 18
        acceptsTerms: true,
        ownsVoice: true,
        understandsUsage: true,
        noImpersonation: true,
        timestamp: new Date().toISOString(),
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
      };

      const result = voiceConsentSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("clonedVoiceSchema", () => {
    it("should validate valid cloned voice data", () => {
      const validData = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        userId: "550e8400-e29b-41d4-a716-446655440001",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        voiceName: "My Custom Voice",
        description: "A custom voice for meditation",
        sampleFileUrl: "https://storage.example.com/samples/voice.mp3",
        consentData: {
          hasConsent: true,
          isOver18: true,
          acceptsTerms: true,
          ownsVoice: true,
          understandsUsage: true,
          noImpersonation: true,
          timestamp: new Date().toISOString(),
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        },
        status: "active",
        usageCount: 5,
        monthlyUsageLimit: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = clonedVoiceSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate different status values", () => {
      const statuses = ["pending", "processing", "active", "failed", "deleted"];

      statuses.forEach(status => {
        const data = {
          id: "550e8400-e29b-41d4-a716-446655440000",
          userId: "550e8400-e29b-41d4-a716-446655440001",
          voiceId: "21m00Tcm4TlvDq8ikWAM",
          voiceName: "My Custom Voice",
          status,
          usageCount: 0,
          monthlyUsageLimit: 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const result = clonedVoiceSchema.safeParse(data);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("voiceCloneRequestSchema", () => {
    it("should validate valid clone request", () => {
      const validData = {
        name: "Meditation Voice",
        description: "Calming voice for guided meditations",
        uploadData: {
          fileName: "voice-sample.mp3",
          fileSize: 2048000,
          mimeType: "audio/mpeg",
          duration: 120,
          sampleRate: 44100,
          bitrate: 128000,
        },
        consent: {
          hasConsent: true,
          isOver18: true,
          acceptsTerms: true,
          ownsVoice: true,
          understandsUsage: true,
          noImpersonation: true,
          timestamp: new Date().toISOString(),
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        },
        labels: {
          accent: "american",
          age: "middle",
          gender: "neutral",
        },
      };

      const result = voiceCloneRequestSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should require all fields", () => {
      const invalidData = {
        name: "Meditation Voice",
        // Missing other required fields
      };

      const result = voiceCloneRequestSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("voiceUsageSchema", () => {
    it("should validate usage tracking data", () => {
      const validData = {
        voiceId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "550e8400-e29b-41d4-a716-446655440001",
        currentMonthUsage: 25,
        monthlyLimit: 100,
        totalUsage: 250,
        lastUsedAt: new Date().toISOString(),
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const result = voiceUsageSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should validate when approaching limit", () => {
      const data = {
        voiceId: "550e8400-e29b-41d4-a716-446655440000",
        userId: "550e8400-e29b-41d4-a716-446655440001",
        currentMonthUsage: 95,
        monthlyLimit: 100,
        totalUsage: 1000,
      };

      const result = voiceUsageSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        const remaining = result.data.monthlyLimit - result.data.currentMonthUsage;
        expect(remaining).toBe(5);
      }
    });
  });

  describe("voiceManagementSchema", () => {
    it("should validate voice management actions", () => {
      const actions = [
        { action: "delete" as const, voiceId: "550e8400-e29b-41d4-a716-446655440000" },
        { action: "rename" as const, voiceId: "550e8400-e29b-41d4-a716-446655440000", newName: "New Name" },
        { action: "updateDescription" as const, voiceId: "550e8400-e29b-41d4-a716-446655440000", description: "New description" },
        { action: "archive" as const, voiceId: "550e8400-e29b-41d4-a716-446655440000" },
      ];

      actions.forEach(actionData => {
        const result = voiceManagementSchema.safeParse(actionData);
        expect(result.success).toBe(true);
      });
    });

    it("should require newName for rename action", () => {
      const invalidData = {
        action: "rename" as const,
        voiceId: "550e8400-e29b-41d4-a716-446655440000",
        // Missing newName
      };

      const result = voiceManagementSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});