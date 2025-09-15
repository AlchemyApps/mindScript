import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST, DELETE } from "./route";
import { createClient } from "@supabase/supabase-js";
import { ElevenLabsVoiceCloning } from "@mindscript/audio-engine/providers/ElevenLabsCloning";

// Mock Supabase
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      count: vi.fn(),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
        remove: vi.fn(),
      })),
    },
  })),
}));

// Mock ElevenLabsVoiceCloning
vi.mock("@mindscript/audio-engine/providers/ElevenLabsCloning", () => ({
  ElevenLabsVoiceCloning: vi.fn().mockImplementation(() => ({
    cloneVoice: vi.fn(),
    deleteVoice: vi.fn(),
    validateAudioFile: vi.fn(),
  })),
}));

describe("/api/voices/clone", () => {
  let mockSupabase: any;
  let mockElevenLabs: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createClient("", "");
    mockElevenLabs = new ElevenLabsVoiceCloning();
  });

  describe("POST - Clone Voice", () => {
    it("should successfully clone a voice with valid data", async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "test@example.com",
          },
        },
      });

      // Mock user profile with premium subscription
      const mockProfile = {
        data: {
          id: "user-123",
          subscription_tier: "premium",
        },
      };
      mockSupabase.from().select().single.mockResolvedValue(mockProfile);

      // Mock voice count check
      mockSupabase.from().select().count.mockResolvedValue({
        data: [{ count: 1 }],
      });

      // Mock storage upload
      mockSupabase.storage.from().upload.mockResolvedValue({
        data: { path: "samples/user-123/voice-sample.mp3" },
      });

      // Mock signed URL creation
      mockSupabase.storage.from().createSignedUrl.mockResolvedValue({
        data: { signedUrl: "https://storage.example.com/signed-url" },
      });

      // Mock ElevenLabs clone response
      mockElevenLabs.cloneVoice.mockResolvedValue({
        isOk: true,
        value: {
          success: true,
          voiceId: "elevenlabs-voice-123",
        },
      });

      // Mock voice record insertion
      mockSupabase.from().insert().single.mockResolvedValue({
        data: {
          id: "voice-record-123",
          voice_id: "elevenlabs-voice-123",
          status: "active",
        },
      });

      // Create form data
      const formData = new FormData();
      formData.append("name", "My Custom Voice");
      formData.append("description", "A meditation voice");
      formData.append("audio", new Blob(["audio-data"], { type: "audio/mpeg" }));
      formData.append("consent", JSON.stringify({
        hasConsent: true,
        isOver18: true,
        acceptsTerms: true,
        ownsVoice: true,
        understandsUsage: true,
        noImpersonation: true,
        timestamp: new Date().toISOString(),
      }));
      formData.append("uploadData", JSON.stringify({
        fileName: "voice-sample.mp3",
        fileSize: 2048000,
        mimeType: "audio/mpeg",
        duration: 120,
        sampleRate: 44100,
        bitrate: 128000,
      }));

      const request = new Request("http://localhost/api/voices/clone", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.voice).toBeDefined();
      expect(data.voice.voice_id).toBe("elevenlabs-voice-123");
    });

    it("should reject if user is not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
      });

      const formData = new FormData();
      formData.append("name", "My Voice");

      const request = new Request("http://localhost/api/voices/clone", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("Unauthorized");
    });

    it("should reject if user exceeds voice limit", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "user-123" },
        },
      });

      mockSupabase.from().select().single.mockResolvedValue({
        data: {
          id: "user-123",
          subscription_tier: "basic", // Basic tier allows only 1 voice
        },
      });

      // User already has 1 voice
      mockSupabase.from().select().count.mockResolvedValue({
        data: [{ count: 1 }],
      });

      const formData = new FormData();
      formData.append("name", "Second Voice");

      const request = new Request("http://localhost/api/voices/clone", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("Voice limit reached");
    });

    it("should reject if consent is invalid", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "user-123" },
        },
      });

      mockSupabase.from().select().single.mockResolvedValue({
        data: {
          id: "user-123",
          subscription_tier: "premium",
        },
      });

      const formData = new FormData();
      formData.append("name", "My Voice");
      formData.append("consent", JSON.stringify({
        hasConsent: true,
        isOver18: false, // Invalid - must be 18+
        acceptsTerms: true,
        ownsVoice: true,
        understandsUsage: true,
        noImpersonation: true,
        timestamp: new Date().toISOString(),
      }));

      const request = new Request("http://localhost/api/voices/clone", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("18");
    });

    it("should handle ElevenLabs API errors", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "user-123" },
        },
      });

      mockSupabase.from().select().single.mockResolvedValue({
        data: {
          id: "user-123",
          subscription_tier: "premium",
        },
      });

      mockSupabase.from().select().count.mockResolvedValue({
        data: [{ count: 0 }],
      });

      mockSupabase.storage.from().upload.mockResolvedValue({
        data: { path: "samples/user-123/voice-sample.mp3" },
      });

      // Mock ElevenLabs error
      mockElevenLabs.cloneVoice.mockResolvedValue({
        isOk: false,
        error: new Error("Rate limit exceeded"),
      });

      const formData = new FormData();
      formData.append("name", "My Voice");
      formData.append("audio", new Blob(["audio-data"], { type: "audio/mpeg" }));
      formData.append("consent", JSON.stringify({
        hasConsent: true,
        isOver18: true,
        acceptsTerms: true,
        ownsVoice: true,
        understandsUsage: true,
        noImpersonation: true,
        timestamp: new Date().toISOString(),
      }));
      formData.append("uploadData", JSON.stringify({
        fileName: "voice-sample.mp3",
        fileSize: 2048000,
        mimeType: "audio/mpeg",
        duration: 120,
        sampleRate: 44100,
        bitrate: 128000,
      }));

      const request = new Request("http://localhost/api/voices/clone", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain("Failed to clone voice");
    });
  });

  describe("DELETE - Delete Voice", () => {
    it("should successfully delete a voice", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "user-123" },
        },
      });

      // Mock voice lookup
      mockSupabase.from().select().single.mockResolvedValue({
        data: {
          id: "voice-record-123",
          user_id: "user-123",
          voice_id: "elevenlabs-voice-123",
          sample_file_url: "https://storage.example.com/sample.mp3",
        },
      });

      // Mock ElevenLabs deletion
      mockElevenLabs.deleteVoice.mockResolvedValue({
        isOk: true,
        value: true,
      });

      // Mock storage deletion
      mockSupabase.storage.from().remove.mockResolvedValue({
        data: [{ name: "sample.mp3" }],
      });

      // Mock database soft delete
      mockSupabase.from().update().eq().single.mockResolvedValue({
        data: {
          id: "voice-record-123",
          status: "deleted",
          deleted_at: new Date().toISOString(),
        },
      });

      const request = new Request("http://localhost/api/voices/clone?voiceId=voice-record-123", {
        method: "DELETE",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("deleted");
    });

    it("should reject if voice not found", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "user-123" },
        },
      });

      mockSupabase.from().select().single.mockResolvedValue({
        data: null,
        error: { message: "Voice not found" },
      });

      const request = new Request("http://localhost/api/voices/clone?voiceId=non-existent", {
        method: "DELETE",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain("Voice not found");
    });

    it("should reject if user doesn't own the voice", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: {
          user: { id: "user-123" },
        },
      });

      mockSupabase.from().select().single.mockResolvedValue({
        data: {
          id: "voice-record-123",
          user_id: "different-user-456", // Different user owns this voice
          voice_id: "elevenlabs-voice-123",
        },
      });

      const request = new Request("http://localhost/api/voices/clone?voiceId=voice-record-123", {
        method: "DELETE",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain("permission");
    });
  });
});