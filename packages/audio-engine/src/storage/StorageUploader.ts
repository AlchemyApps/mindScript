import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Result, Ok, Err } from "../types";
import { Readable } from "stream";
import * as path from "path";
import * as crypto from "crypto";

interface StorageUploaderConfig {
  supabaseUrl: string;
  supabaseKey: string;
  publicBucket: string;
  privateBucket: string;
  maxRetries?: number;
  retryDelay?: number;
  signedUrlExpiresIn?: number; // seconds
}

interface UploadOptions {
  file: Buffer | Uint8Array;
  fileName: string;
  isPublic: boolean;
  contentType: string;
  cacheControl?: string;
  useUniqueFileName?: boolean;
  useOrganizedPath?: boolean;
  maxSizeMB?: number;
}

interface StreamUploadOptions {
  stream: Readable;
  fileName: string;
  isPublic: boolean;
  contentType: string;
  fileSize?: number;
  cacheControl?: string;
  onProgress?: (progress: number) => void;
}

interface UploadResult {
  url: string;
  bucket: string;
  path: string;
  contentType: string;
  size?: number;
  signedUrlExpiresAt?: Date;
}

interface DeleteOptions {
  bucket: string;
  path: string;
}

interface SignedUrlOptions {
  bucket: string;
  path: string;
  expiresIn: number; // seconds
}

interface SignedUrlResult {
  url: string;
  expiresAt: Date;
}

interface ListOptions {
  bucket: string;
  path?: string;
  limit?: number;
  offset?: number;
}

interface ListResult {
  files: Array<{
    name: string;
    id: string;
    updatedAt: string;
    size?: number;
  }>;
  hasMore: boolean;
}

/**
 * Handles file uploads to Supabase Storage with retry logic
 */
export class StorageUploader {
  private supabase: SupabaseClient;
  private publicBucket: string;
  private privateBucket: string;
  private maxRetries: number;
  private retryDelay: number;
  private signedUrlExpiresIn: number;

  constructor(config: StorageUploaderConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.publicBucket = config.publicBucket;
    this.privateBucket = config.privateBucket;
    this.maxRetries = config.maxRetries ?? 5;
    this.retryDelay = config.retryDelay ?? 1000;
    this.signedUrlExpiresIn = config.signedUrlExpiresIn ?? 3600; // 1 hour default
  }

  /**
   * Upload a file to storage
   */
  async uploadFile(options: UploadOptions): Promise<Result<UploadResult>> {
    try {
      // Validate file size
      if (options.maxSizeMB) {
        const sizeMB = options.file.length / (1024 * 1024);
        if (sizeMB > options.maxSizeMB) {
          return Err(new Error(`File size (${sizeMB.toFixed(2)}MB) exceeds maximum size (${options.maxSizeMB}MB)`));
        }
      }

      // Generate file path
      const filePath = this.generateFilePath(options);
      const bucket = options.isPublic ? this.publicBucket : this.privateBucket;

      // Upload with retry logic
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const { data, error } = await this.supabase.storage
            .from(bucket)
            .upload(filePath, options.file, {
              contentType: options.contentType,
              cacheControl: options.cacheControl ?? "3600",
              upsert: false,
            });

          if (error) {
            throw new Error(error.message);
          }

          if (!data) {
            throw new Error("Upload succeeded but no data returned");
          }

          // Get the URL
          let url: string;
          let expiresAt: Date | undefined;

          if (options.isPublic) {
            const { data: urlData } = this.supabase.storage
              .from(bucket)
              .getPublicUrl(data.path);
            url = urlData.publicUrl;
          } else {
            const { data: signedUrlData, error: signedUrlError } = await this.supabase.storage
              .from(bucket)
              .createSignedUrl(data.path, this.signedUrlExpiresIn);

            if (signedUrlError || !signedUrlData) {
              throw new Error(`Failed to create signed URL: ${signedUrlError?.message}`);
            }

            url = signedUrlData.signedUrl;
            expiresAt = new Date(Date.now() + this.signedUrlExpiresIn * 1000);
          }

          return Ok({
            url,
            bucket,
            path: data.path,
            contentType: options.contentType,
            size: options.file.length,
            signedUrlExpiresAt: expiresAt,
          });
        } catch (error) {
          lastError = error as Error;
          
          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelay * attempt);
          }
        }
      }

      return Err(new Error(`Upload failed after ${this.maxRetries} attempts: ${lastError?.message}`));
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Upload a file using a stream (for large files)
   */
  async uploadStream(options: StreamUploadOptions): Promise<Result<UploadResult>> {
    try {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      let uploadedSize = 0;

      // Collect stream data
      return new Promise((resolve) => {
        options.stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          totalSize += chunk.length;
          
          if (options.fileSize && options.onProgress) {
            uploadedSize += chunk.length;
            const progress = Math.round((uploadedSize / options.fileSize) * 100);
            options.onProgress(progress);
          }
        });

        options.stream.on("end", async () => {
          const buffer = Buffer.concat(chunks);
          
          const result = await this.uploadFile({
            file: buffer,
            fileName: options.fileName,
            isPublic: options.isPublic,
            contentType: options.contentType,
            cacheControl: options.cacheControl,
          });

          if (options.onProgress) {
            options.onProgress(100);
          }

          resolve(result);
        });

        options.stream.on("error", (error) => {
          resolve(Err(error));
        });
      });
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(options: DeleteOptions): Promise<Result<void>> {
    try {
      const { error } = await this.supabase.storage
        .from(options.bucket)
        .remove([options.path]);

      if (error) {
        return Err(new Error(error.message));
      }

      return Ok(undefined);
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Generate a new signed URL for a private file
   */
  async getSignedUrl(options: SignedUrlOptions): Promise<Result<SignedUrlResult>> {
    try {
      const { data, error } = await this.supabase.storage
        .from(options.bucket)
        .createSignedUrl(options.path, options.expiresIn);

      if (error || !data) {
        return Err(new Error(`Failed to create signed URL: ${error?.message}`));
      }

      return Ok({
        url: data.signedUrl,
        expiresAt: new Date(Date.now() + options.expiresIn * 1000),
      });
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * List files in a bucket
   */
  async listFiles(options: ListOptions): Promise<Result<ListResult>> {
    try {
      const { data, error } = await this.supabase.storage
        .from(options.bucket)
        .list(options.path, {
          limit: options.limit ?? 100,
          offset: options.offset ?? 0,
        });

      if (error) {
        return Err(new Error(error.message));
      }

      const files = data?.map((file) => ({
        name: file.name,
        id: file.id!,
        updatedAt: file.updated_at,
        size: file.metadata?.size,
      })) ?? [];

      return Ok({
        files,
        hasMore: files.length === (options.limit ?? 100),
      });
    } catch (error) {
      return Err(error as Error);
    }
  }

  /**
   * Generate a file path with optional uniqueness and organization
   */
  private generateFilePath(options: UploadOptions): string {
    let fileName = options.fileName;
    
    // Add unique identifier if requested
    if (options.useUniqueFileName) {
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      const uniqueId = Date.now().toString() + "-" + crypto.randomBytes(4).toString("hex");
      fileName = `${base}-${uniqueId}${ext}`;
    }

    // Organize by date if requested
    if (options.useOrganizedPath) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}/${month}/${day}/${fileName}`;
    }

    return fileName;
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}