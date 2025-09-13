import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StorageUploader } from "../../src/storage/StorageUploader";
import { createReadStream } from "fs";
import { Readable } from "stream";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(),
    },
  })),
}));

describe("StorageUploader", () => {
  let uploader: StorageUploader;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      storage: {
        from: vi.fn().mockReturnThis(),
        upload: vi.fn(),
        createSignedUrl: vi.fn(),
        getPublicUrl: vi.fn(),
        remove: vi.fn(),
      },
    };

    uploader = new StorageUploader({
      supabaseUrl: "https://test.supabase.co",
      supabaseKey: "test-key",
      publicBucket: "public-audio",
      privateBucket: "private-audio",
      maxRetries: 5,
      retryDelay: 100,
    });

    // Inject mock
    (uploader as any).supabase = mockSupabase;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadFile", () => {
    const mockFile = Buffer.from("mock audio data");
    const fileName = "test-audio.mp3";

    it("should upload to public bucket when isPublic is true", async () => {
      mockSupabase.storage.from = vi.fn((bucket) => {
        expect(bucket).toBe("public-audio");
        return {
          upload: vi.fn().mockResolvedValue({
            data: { path: fileName },
            error: null,
          }),
          getPublicUrl: vi.fn().mockReturnValue({
            data: { publicUrl: `https://test.supabase.co/storage/v1/object/public/${bucket}/${fileName}` },
          }),
        };
      });

      const result = await uploader.uploadFile({
        file: mockFile,
        fileName,
        isPublic: true,
        contentType: "audio/mpeg",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toContain("public-audio");
        expect(result.data.bucket).toBe("public-audio");
        expect(result.data.path).toBe(fileName);
      }
    });

    it("should upload to private bucket and generate signed URL", async () => {
      const signedUrl = "https://test.supabase.co/storage/v1/object/sign/private-audio/test-audio.mp3?token=abc";
      
      mockSupabase.storage.from = vi.fn((bucket) => {
        expect(bucket).toBe("private-audio");
        return {
          upload: vi.fn().mockResolvedValue({
            data: { path: fileName },
            error: null,
          }),
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl },
            error: null,
          }),
        };
      });

      const result = await uploader.uploadFile({
        file: mockFile,
        fileName,
        isPublic: false,
        contentType: "audio/mpeg",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe(signedUrl);
        expect(result.data.bucket).toBe("private-audio");
        expect(result.data.signedUrlExpiresAt).toBeDefined();
      }
    });

    it("should handle stream uploads for large files", async () => {
      const stream = Readable.from([mockFile]);
      
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: fileName },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://test.url/file.mp3" },
        }),
      });

      const result = await uploader.uploadStream({
        stream,
        fileName,
        isPublic: true,
        contentType: "audio/mpeg",
        fileSize: mockFile.length,
      });

      expect(result.success).toBe(true);
    });

    it("should retry on network failure", async () => {
      let attempts = 0;
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        upload: vi.fn().mockImplementation(() => {
          attempts++;
          if (attempts < 3) {
            return Promise.resolve({
              data: null,
              error: { message: "Network timeout" },
            });
          }
          return Promise.resolve({
            data: { path: fileName },
            error: null,
          });
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://test.url/file.mp3" },
        }),
      });

      const result = await uploader.uploadFile({
        file: mockFile,
        fileName,
        isPublic: true,
        contentType: "audio/mpeg",
      });

      expect(result.success).toBe(true);
      expect(attempts).toBe(3);
    });

    it("should fail after max retries", async () => {
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Persistent error" },
        }),
      });

      const result = await uploader.uploadFile({
        file: mockFile,
        fileName,
        isPublic: true,
        contentType: "audio/mpeg",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Persistent error");
        expect(result.error).toContain("after 5 attempts");
      }
    });

    it("should use unique file names to avoid collisions", async () => {
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        upload: vi.fn().mockImplementation((path) => {
          // Check that path includes timestamp or UUID
          expect(path).toMatch(/\d{13}|[a-f0-9]{8}-[a-f0-9]{4}/);
          return Promise.resolve({
            data: { path },
            error: null,
          });
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://test.url/file.mp3" },
        }),
      });

      const result = await uploader.uploadFile({
        file: mockFile,
        fileName: "audio.mp3",
        isPublic: true,
        contentType: "audio/mpeg",
        useUniqueFileName: true,
      });

      expect(result.success).toBe(true);
    });

    it("should validate file size limits", async () => {
      const largeFile = Buffer.alloc(500 * 1024 * 1024); // 500MB
      
      const result = await uploader.uploadFile({
        file: largeFile,
        fileName,
        isPublic: true,
        contentType: "audio/mpeg",
        maxSizeMB: 100,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("exceeds maximum size");
      }
    });

    it("should set correct content type and cache headers", async () => {
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        upload: vi.fn().mockImplementation((path, file, options) => {
          expect(options.contentType).toBe("audio/mpeg");
          expect(options.cacheControl).toBe("3600");
          expect(options.upsert).toBe(false);
          return Promise.resolve({
            data: { path },
            error: null,
          });
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://test.url/file.mp3" },
        }),
      });

      await uploader.uploadFile({
        file: mockFile,
        fileName,
        isPublic: true,
        contentType: "audio/mpeg",
        cacheControl: "3600",
      });
    });

    it("should handle WAV file uploads", async () => {
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: "audio.wav" },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://test.url/audio.wav" },
        }),
      });

      const result = await uploader.uploadFile({
        file: mockFile,
        fileName: "audio.wav",
        isPublic: true,
        contentType: "audio/wav",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.path).toContain(".wav");
        expect(result.data.contentType).toBe("audio/wav");
      }
    });

    it("should organize files in folders by date", async () => {
      const date = new Date("2024-01-15");
      vi.setSystemTime(date);

      mockSupabase.storage.from = vi.fn().mockReturnValue({
        upload: vi.fn().mockImplementation((path) => {
          expect(path).toMatch(/2024\/01\/15/);
          return Promise.resolve({
            data: { path },
            error: null,
          });
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://test.url/file.mp3" },
        }),
      });

      const result = await uploader.uploadFile({
        file: mockFile,
        fileName,
        isPublic: true,
        contentType: "audio/mpeg",
        useOrganizedPath: true,
      });

      expect(result.success).toBe(true);
      
      vi.useRealTimers();
    });

    it("should track upload progress for streams", async () => {
      const progressUpdates: number[] = [];
      const stream = Readable.from([mockFile]);
      
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: fileName },
          error: null,
        }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://test.url/file.mp3" },
        }),
      });

      const result = await uploader.uploadStream({
        stream,
        fileName,
        isPublic: true,
        contentType: "audio/mpeg",
        fileSize: mockFile.length,
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      });

      expect(result.success).toBe(true);
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });
  });

  describe("deleteFile", () => {
    it("should delete file from storage", async () => {
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({
          data: [{ name: "test.mp3" }],
          error: null,
        }),
      });

      const result = await uploader.deleteFile({
        bucket: "public-audio",
        path: "test.mp3",
      });

      expect(result.success).toBe(true);
    });

    it("should handle deletion errors", async () => {
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "File not found" },
        }),
      });

      const result = await uploader.deleteFile({
        bucket: "public-audio",
        path: "nonexistent.mp3",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("File not found");
      }
    });
  });

  describe("getSignedUrl", () => {
    it("should generate new signed URL for private file", async () => {
      const signedUrl = "https://test.supabase.co/storage/v1/object/sign/private-audio/test.mp3?token=new";
      
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl },
          error: null,
        }),
      });

      const result = await uploader.getSignedUrl({
        bucket: "private-audio",
        path: "test.mp3",
        expiresIn: 7200,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.url).toBe(signedUrl);
        expect(result.data.expiresAt).toBeDefined();
      }
    });

    it("should handle signed URL generation errors", async () => {
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Unauthorized" },
        }),
      });

      const result = await uploader.getSignedUrl({
        bucket: "private-audio",
        path: "test.mp3",
        expiresIn: 3600,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("Unauthorized");
      }
    });
  });

  describe("listFiles", () => {
    it("should list files in bucket", async () => {
      mockSupabase.storage.from = vi.fn().mockReturnValue({
        list: vi.fn().mockResolvedValue({
          data: [
            { name: "file1.mp3", id: "1", updated_at: "2024-01-01" },
            { name: "file2.mp3", id: "2", updated_at: "2024-01-02" },
          ],
          error: null,
        }),
      });

      const result = await uploader.listFiles({
        bucket: "public-audio",
        path: "uploads/",
        limit: 10,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.files).toHaveLength(2);
        expect(result.data.files[0].name).toBe("file1.mp3");
      }
    });
  });
});