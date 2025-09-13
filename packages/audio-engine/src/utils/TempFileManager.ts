import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import { Result, Ok, Err } from "../types";

interface TempFileConfig {
  baseDir?: string;
  prefix?: string;
  autoCleanup?: boolean;
}

interface CleanupStats {
  removed: number;
  failed: number;
  errors?: Error[];
}

interface Stats {
  totalPaths: number;
  totalSizeBytes: number;
  files: number;
  directories: number;
}

/**
 * Manages temporary files and directories for audio processing.
 * Provides automatic cleanup and tracking of created resources.
 */
export class TempFileManager {
  private baseDir: string;
  private prefix: string;
  private trackedPaths: Set<string> = new Set();
  private autoCleanup: boolean;

  constructor(config?: TempFileConfig) {
    this.baseDir = config?.baseDir || os.tmpdir();
    this.prefix = config?.prefix || "mindscript-audio";
    this.autoCleanup = config?.autoCleanup ?? true;

    if (this.autoCleanup) {
      this.registerCleanupHandlers();
    }
  }

  /**
   * Create a unique temporary directory.
   */
  async createTempDir(suffix?: string): Promise<Result<string>> {
    try {
      const uniqueId = crypto.randomBytes(8).toString("hex");
      const dirName = suffix 
        ? `${this.prefix}-${suffix}-${uniqueId}`
        : `${this.prefix}-${uniqueId}`;
      const dirPath = path.join(this.baseDir, dirName);

      await fs.mkdir(dirPath, { recursive: true });
      this.trackedPaths.add(dirPath);

      return Ok(dirPath);
    } catch (error) {
      return Err(new Error(`Failed to create temp directory: ${(error as Error).message}`));
    }
  }

  /**
   * Create a temporary file with optional content.
   */
  async createTempFile(
    filename: string,
    content: string | Buffer,
    subdir?: string
  ): Promise<Result<string>> {
    try {
      const dirResult = await this.createTempDir(subdir);
      if (!dirResult.isOk) {
        return dirResult;
      }

      const filePath = path.join(dirResult.value, filename);
      await fs.writeFile(filePath, content);
      this.trackedPaths.add(filePath);

      return Ok(filePath);
    } catch (error) {
      return Err(new Error(`Failed to create temp file: ${(error as Error).message}`));
    }
  }

  /**
   * Generate a unique temporary file path without creating the file.
   */
  async generateTempPath(filename: string): Promise<Result<string>> {
    try {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      const uniqueId = crypto.randomBytes(8).toString("hex");
      const uniqueName = `${base}-${uniqueId}${ext}`;
      const filePath = path.join(this.baseDir, this.prefix, uniqueName);

      // Ensure directory exists
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });
      this.trackedPaths.add(dir);

      return Ok(filePath);
    } catch (error) {
      return Err(new Error(`Failed to generate temp path: ${(error as Error).message}`));
    }
  }

  /**
   * Clean up all tracked temporary files and directories.
   */
  async cleanup(): Promise<Result<CleanupStats>> {
    const stats: CleanupStats = {
      removed: 0,
      failed: 0,
      errors: [],
    };

    const paths = Array.from(this.trackedPaths);
    
    for (const trackedPath of paths) {
      try {
        // Check if path exists
        await fs.access(trackedPath);
        
        // Remove path (file or directory)
        await fs.rm(trackedPath, { recursive: true, force: true });
        
        this.trackedPaths.delete(trackedPath);
        stats.removed++;
      } catch (error) {
        // If path doesn't exist, just remove from tracking
        if ((error as any).code === "ENOENT") {
          this.trackedPaths.delete(trackedPath);
        } else {
          stats.failed++;
          stats.errors?.push(error as Error);
        }
      }
    }

    return Ok(stats);
  }

  /**
   * Clean up old files in the temp directory.
   */
  async cleanupOldFiles(maxAgeMs: number): Promise<Result<{ removed: number }>> {
    try {
      const tempDir = path.join(this.baseDir, this.prefix);
      let removed = 0;

      try {
        const entries = await fs.readdir(tempDir);
        const now = Date.now();

        for (const entry of entries) {
          const entryPath = path.join(tempDir, entry);
          const stats = await fs.stat(entryPath);
          const age = now - stats.mtime.getTime();

          if (age > maxAgeMs) {
            await fs.rm(entryPath, { recursive: true, force: true });
            removed++;
          }
        }
      } catch (error) {
        // Directory might not exist yet
        if ((error as any).code !== "ENOENT") {
          throw error;
        }
      }

      return Ok({ removed });
    } catch (error) {
      return Err(new Error(`Failed to cleanup old files: ${(error as Error).message}`));
    }
  }

  /**
   * Track an external path for cleanup.
   */
  trackExternalPath(path: string): void {
    this.trackedPaths.add(path);
  }

  /**
   * Remove a path from tracking without deleting it.
   */
  untrackPath(path: string): void {
    this.trackedPaths.delete(path);
  }

  /**
   * Get all currently tracked paths.
   */
  getTrackedPaths(): string[] {
    return Array.from(this.trackedPaths);
  }

  /**
   * Get statistics about tracked paths.
   */
  async getStats(): Promise<Result<Stats>> {
    try {
      const stats: Stats = {
        totalPaths: this.trackedPaths.size,
        totalSizeBytes: 0,
        files: 0,
        directories: 0,
      };

      for (const trackedPath of this.trackedPaths) {
        try {
          const pathStats = await fs.stat(trackedPath);
          
          if (pathStats.isFile()) {
            stats.files++;
            stats.totalSizeBytes += pathStats.size;
          } else if (pathStats.isDirectory()) {
            stats.directories++;
            // For directories, we'd need to recursively calculate size
            // For now, just count them
          }
        } catch {
          // Path might not exist anymore
        }
      }

      return Ok(stats);
    } catch (error) {
      return Err(new Error(`Failed to get stats: ${(error as Error).message}`));
    }
  }

  /**
   * Register process cleanup handlers.
   */
  private registerCleanupHandlers(): void {
    // Cleanup on normal exit
    process.on("exit", () => {
      // Note: Only synchronous operations work here
      // Async cleanup should be done before exit
      this.syncCleanup();
    });

    // Cleanup on interrupt signals
    process.once("SIGINT", async () => {
      await this.cleanup();
      process.exit(0);
    });

    process.once("SIGTERM", async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  /**
   * Synchronous cleanup for process exit.
   * Note: This is a best-effort cleanup.
   */
  private syncCleanup(): void {
    // We can't use async operations in exit handler
    // This is why we also handle SIGINT/SIGTERM
    // In production, consider using a cleanup service
  }
}