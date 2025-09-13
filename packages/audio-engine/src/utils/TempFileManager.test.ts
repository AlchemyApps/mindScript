import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TempFileManager } from "./TempFileManager";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// Mock fs and os modules
vi.mock("fs/promises", () => ({
  mkdir: vi.fn(),
  rm: vi.fn(),
  access: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  stat: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock("os", () => ({
  tmpdir: vi.fn(() => "/tmp"),
}));

describe("TempFileManager", () => {
  let manager: TempFileManager;

  beforeEach(() => {
    manager = new TempFileManager();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup manager to prevent memory leaks
    await manager.cleanup();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should create instance with default configuration", () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(TempFileManager);
    });

    it("should accept custom base directory", () => {
      const customManager = new TempFileManager({
        baseDir: "/custom/temp",
      });
      expect(customManager).toBeDefined();
    });

    it("should register process exit handlers", () => {
      const processOnSpy = vi.spyOn(process, "on");
      const processOnceSpy = vi.spyOn(process, "once");

      new TempFileManager({ autoCleanup: true });

      expect(processOnSpy).toHaveBeenCalledWith("exit", expect.any(Function));
      expect(processOnceSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
      expect(processOnceSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    });
  });

  describe("createTempDir", () => {
    it("should create a unique temporary directory", async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      mockMkdir.mockResolvedValueOnce(undefined);

      const result = await manager.createTempDir("audio-processing");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toMatch(/^\/tmp\/mindscript-audio-/);
        expect(result.value).toContain("audio-processing");
        expect(mockMkdir).toHaveBeenCalledWith(result.value, { recursive: true });
      }
    });

    it("should track created directories for cleanup", async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      mockMkdir.mockResolvedValue(undefined);

      const result1 = await manager.createTempDir("test1");
      const result2 = await manager.createTempDir("test2");

      expect(result1.isOk).toBe(true);
      expect(result2.isOk).toBe(true);

      const tracked = manager.getTrackedPaths();
      expect(tracked.length).toBe(2);
    });

    it("should handle directory creation errors", async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      mockMkdir.mockRejectedValueOnce(new Error("Permission denied"));

      const result = await manager.createTempDir("test");

      expect(result.isOk).toBe(false);
      if (!result.isOk) {
        expect(result.error.message).toContain("Permission denied");
      }
    });
  });

  describe("createTempFile", () => {
    it("should create a temporary file with content", async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      const content = "test audio data";
      const result = await manager.createTempFile("test.mp3", content);

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toMatch(/\/test\.mp3$/);
        expect(mockWriteFile).toHaveBeenCalledWith(result.value, content);
      }
    });

    it("should create file in subdirectory if specified", async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      const result = await manager.createTempFile("output.mp3", Buffer.from([]), "renders");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toContain("/renders/");
        expect(result.value).toEndWith("output.mp3");
      }
    });

    it("should track created files for cleanup", async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      await manager.createTempFile("file1.mp3", "data1");
      await manager.createTempFile("file2.mp3", "data2");

      const tracked = manager.getTrackedPaths();
      expect(tracked.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("generateTempPath", () => {
    it("should generate unique path for file", async () => {
      const result = await manager.generateTempPath("audio.mp3");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toMatch(/\/audio-[a-z0-9]+\.mp3$/);
      }
    });

    it("should preserve file extension", async () => {
      const result = await manager.generateTempPath("test.wav");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.endsWith(".wav")).toBe(true);
      }
    });

    it("should handle files without extension", async () => {
      const result = await manager.generateTempPath("audiofile");

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value).toMatch(/\/audiofile-[a-z0-9]+$/);
      }
    });
  });

  describe("cleanup", () => {
    it("should remove all tracked files and directories", async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);
      const mockRm = vi.mocked(fs.rm);
      const mockAccess = vi.mocked(fs.access);

      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);
      mockAccess.mockResolvedValue(undefined);

      // Create some temp files
      await manager.createTempDir("dir1");
      await manager.createTempFile("file1.mp3", "data");

      const trackedBefore = manager.getTrackedPaths();
      expect(trackedBefore.length).toBeGreaterThan(0);

      const result = await manager.cleanup();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.removed).toBeGreaterThan(0);
        expect(result.value.failed).toBe(0);
      }

      const trackedAfter = manager.getTrackedPaths();
      expect(trackedAfter.length).toBe(0);
    });

    it("should handle partial cleanup failures gracefully", async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);
      const mockRm = vi.mocked(fs.rm);
      const mockAccess = vi.mocked(fs.access);

      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      mockAccess.mockResolvedValue(undefined);

      await manager.createTempFile("file1.mp3", "data");
      await manager.createTempFile("file2.mp3", "data");

      // First removal succeeds, second fails
      mockRm.mockResolvedValueOnce(undefined);
      mockRm.mockRejectedValueOnce(new Error("Permission denied"));

      const result = await manager.cleanup();

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.removed).toBeGreaterThan(0);
        expect(result.value.failed).toBeGreaterThan(0);
      }
    });

    it("should skip non-existent paths during cleanup", async () => {
      const mockAccess = vi.mocked(fs.access);
      const mockRm = vi.mocked(fs.rm);

      // Track a path manually
      manager["trackedPaths"].add("/tmp/nonexistent");

      mockAccess.mockRejectedValueOnce(new Error("ENOENT"));

      const result = await manager.cleanup();

      expect(result.isOk).toBe(true);
      expect(mockRm).not.toHaveBeenCalled();
    });
  });

  describe("cleanupOldFiles", () => {
    it("should remove files older than specified age", async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockRm = vi.mocked(fs.rm);

      const now = Date.now();
      const oldFile = "old-file.mp3";
      const newFile = "new-file.mp3";

      mockReaddir.mockResolvedValueOnce([oldFile, newFile] as any);
      mockStat.mockImplementation(async (filepath) => {
        const isOld = filepath.toString().includes("old");
        return {
          isFile: () => true,
          isDirectory: () => false,
          mtime: new Date(now - (isOld ? 3600000 : 60000)), // 1 hour vs 1 minute
        } as any;
      });
      mockRm.mockResolvedValue(undefined);

      const result = await manager.cleanupOldFiles(1800000); // 30 minutes

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(result.value.removed).toBe(1);
        expect(mockRm).toHaveBeenCalledTimes(1);
      }
    });

    it("should recursively clean old directories", async () => {
      const mockReaddir = vi.mocked(fs.readdir);
      const mockStat = vi.mocked(fs.stat);
      const mockRm = vi.mocked(fs.rm);

      mockReaddir.mockResolvedValueOnce(["old-dir"] as any);
      mockStat.mockResolvedValueOnce({
        isFile: () => false,
        isDirectory: () => true,
        mtime: new Date(Date.now() - 7200000), // 2 hours old
      } as any);
      mockRm.mockResolvedValueOnce(undefined);

      const result = await manager.cleanupOldFiles(3600000); // 1 hour

      expect(result.isOk).toBe(true);
      if (result.isOk) {
        expect(mockRm).toHaveBeenCalledWith(expect.any(String), {
          recursive: true,
          force: true,
        });
      }
    });
  });

  describe("trackExternalPath", () => {
    it("should track external paths for cleanup", async () => {
      const externalPath = "/external/audio.mp3";
      manager.trackExternalPath(externalPath);

      const tracked = manager.getTrackedPaths();
      expect(tracked).toContain(externalPath);
    });

    it("should not track the same path twice", () => {
      const path = "/external/audio.mp3";
      manager.trackExternalPath(path);
      manager.trackExternalPath(path);

      const tracked = manager.getTrackedPaths();
      const count = tracked.filter((p) => p === path).length;
      expect(count).toBe(1);
    });
  });

  describe("untrackPath", () => {
    it("should remove path from tracking", async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await manager.createTempFile("test.mp3", "data");
      expect(result.isOk).toBe(true);

      if (result.isOk) {
        const path = result.value;
        expect(manager.getTrackedPaths()).toContain(path);

        manager.untrackPath(path);
        expect(manager.getTrackedPaths()).not.toContain(path);
      }
    });
  });

  describe("getStats", () => {
    it("should return statistics about tracked paths", async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);
      const mockStat = vi.mocked(fs.stat);

      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      mockStat.mockResolvedValue({
        size: 1024,
        isFile: () => true,
        isDirectory: () => false,
      } as any);

      await manager.createTempFile("file1.mp3", "data");
      await manager.createTempDir("dir1");

      const stats = await manager.getStats();

      expect(stats.isOk).toBe(true);
      if (stats.isOk) {
        expect(stats.value.totalPaths).toBeGreaterThan(0);
        expect(stats.value.totalSizeBytes).toBeGreaterThan(0);
        expect(stats.value.directories).toBeGreaterThan(0);
        expect(stats.value.files).toBeGreaterThan(0);
      }
    });
  });

  describe("error recovery", () => {
    it("should handle process exit gracefully", async () => {
      const mockMkdir = vi.mocked(fs.mkdir);
      const mockWriteFile = vi.mocked(fs.writeFile);
      const mockRm = vi.mocked(fs.rm);
      const mockAccess = vi.mocked(fs.access);

      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);
      mockRm.mockResolvedValue(undefined);
      mockAccess.mockResolvedValue(undefined);

      const exitManager = new TempFileManager({ autoCleanup: true });
      await exitManager.createTempFile("test.mp3", "data");

      // Simulate process exit
      const exitHandler = vi.fn();
      process.on("exit", exitHandler);
      process.emit("exit", 0);

      // Cleanup should have been called
      expect(mockRm).toHaveBeenCalled();
    });

    it("should handle SIGINT signal", async () => {
      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
        // Don't actually exit
        return undefined as never;
      });

      const signalManager = new TempFileManager({ autoCleanup: true });

      // Simulate SIGINT (but prevent actual exit)
      const listeners = process.listeners("SIGINT");
      if (listeners.length > 0) {
        // Call the listener but prevent the exit
        await (listeners[0] as any)();
      }

      expect(mockExit).toHaveBeenCalledWith(0);
      mockExit.mockRestore();
    });

    it("should handle SIGTERM signal", async () => {
      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
        // Don't actually exit
        return undefined as never;
      });

      const signalManager = new TempFileManager({ autoCleanup: true });

      // Simulate SIGTERM (but prevent actual exit)
      const listeners = process.listeners("SIGTERM");
      if (listeners.length > 0) {
        // Call the listener but prevent the exit
        await (listeners[0] as any)();
      }

      expect(mockExit).toHaveBeenCalledWith(0);
      mockExit.mockRestore();
    });
  });
});