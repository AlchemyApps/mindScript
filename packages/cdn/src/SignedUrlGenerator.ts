import { getSignedUrl } from '@aws-sdk/cloudfront-signer';
import { z } from 'zod';

// Configuration schema
export const CDNConfigSchema = z.object({
  distributionDomain: z.string().url(),
  keyPairId: z.string(),
  privateKey: z.string(),
  defaultTTL: z.number().int().positive().default(3600), // 1 hour default
});

export type CDNConfig = z.infer<typeof CDNConfigSchema>;

// Signed URL options schema
export const SignedUrlOptionsSchema = z.object({
  path: z.string(),
  expiresIn: z.number().int().positive().optional(),
  ipAddress: z.string().ip().optional(),
  customPolicy: z.object({
    Statement: z.array(z.any()),
  }).optional(),
});

export type SignedUrlOptions = z.infer<typeof SignedUrlOptionsSchema>;

export class SignedUrlGenerator {
  private config: CDNConfig;

  constructor(config: CDNConfig) {
    this.config = CDNConfigSchema.parse(config);
  }

  /**
   * Generate a signed URL for private content
   */
  generateSignedUrl(options: SignedUrlOptions): string {
    const validatedOptions = SignedUrlOptionsSchema.parse(options);

    const url = `${this.config.distributionDomain}/${validatedOptions.path}`;
    const expiresIn = validatedOptions.expiresIn || this.config.defaultTTL;
    const dateLessThan = new Date(Date.now() + expiresIn * 1000).toISOString();

    if (validatedOptions.customPolicy) {
      // Use custom policy for advanced scenarios
      return getSignedUrl({
        url,
        keyPairId: this.config.keyPairId,
        privateKey: this.config.privateKey,
        policy: JSON.stringify(validatedOptions.customPolicy),
      });
    }

    // Build policy for standard scenarios
    const policy: any = {
      Statement: [
        {
          Resource: url,
          Condition: {
            DateLessThan: {
              'AWS:EpochTime': Math.floor(new Date(dateLessThan).getTime() / 1000),
            },
          },
        },
      ],
    };

    // Add IP restriction if specified
    if (validatedOptions.ipAddress) {
      policy.Statement[0].Condition.IpAddress = {
        'AWS:SourceIp': `${validatedOptions.ipAddress}/32`,
      };
    }

    return getSignedUrl({
      url,
      keyPairId: this.config.keyPairId,
      privateKey: this.config.privateKey,
      policy: JSON.stringify(policy),
    });
  }

  /**
   * Generate signed URLs for multiple paths
   */
  generateBatchSignedUrls(
    paths: string[],
    options?: Omit<SignedUrlOptions, 'path'>
  ): Map<string, string> {
    const signedUrls = new Map<string, string>();

    for (const path of paths) {
      const signedUrl = this.generateSignedUrl({
        path,
        ...options,
      });
      signedUrls.set(path, signedUrl);
    }

    return signedUrls;
  }

  /**
   * Generate a signed URL for audio streaming with range request support
   */
  generateStreamingUrl(
    path: string,
    options?: Omit<SignedUrlOptions, 'path'>
  ): string {
    // For streaming, we typically want a longer TTL
    const streamingOptions = {
      ...options,
      expiresIn: options?.expiresIn || 7200, // 2 hours default for streaming
    };

    return this.generateSignedUrl({
      path,
      ...streamingOptions,
    });
  }

  /**
   * Generate a signed URL for image with format conversion support
   */
  generateImageUrl(
    path: string,
    format?: 'webp' | 'avif' | 'original',
    options?: Omit<SignedUrlOptions, 'path'>
  ): string {
    let imagePath = path;

    if (format && format !== 'original') {
      // Add format conversion query parameter
      const separator = path.includes('?') ? '&' : '?';
      imagePath = `${path}${separator}format=${format}`;
    }

    return this.generateSignedUrl({
      path: imagePath,
      ...options,
    });
  }

  /**
   * Validate if a signed URL is still valid
   */
  isUrlValid(signedUrl: string): boolean {
    try {
      const url = new URL(signedUrl);
      const params = new URLSearchParams(url.search);

      // Check for CloudFront signed URL parameters
      const expires = params.get('Expires');
      if (!expires) {
        return false;
      }

      const expiryTime = parseInt(expires, 10) * 1000;
      return Date.now() < expiryTime;
    } catch (error) {
      return false;
    }
  }
}

// Cache invalidation helper
export class CacheInvalidator {
  private distributionId: string;

  constructor(distributionId: string) {
    this.distributionId = distributionId;
  }

  /**
   * Create an invalidation batch for CloudFront
   * Note: This requires AWS SDK v3 CloudFront client
   */
  async createInvalidation(paths: string[]): Promise<string> {
    // This would be implemented with CloudFront client
    // Placeholder for now - actual implementation would use:
    // import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";

    const invalidationId = `INV-${Date.now()}`;
    console.log(`Creating invalidation ${invalidationId} for paths:`, paths);

    // In real implementation:
    // const client = new CloudFrontClient({ region: 'us-east-1' });
    // const command = new CreateInvalidationCommand({
    //   DistributionId: this.distributionId,
    //   InvalidationBatch: {
    //     CallerReference: invalidationId,
    //     Paths: {
    //       Quantity: paths.length,
    //       Items: paths,
    //     },
    //   },
    // });
    // const response = await client.send(command);
    // return response.Invalidation?.Id || invalidationId;

    return invalidationId;
  }
}

// Export helper function for creating generator from environment
export function createSignedUrlGenerator(): SignedUrlGenerator {
  const config: CDNConfig = {
    distributionDomain: process.env.CDN_DISTRIBUTION_DOMAIN!,
    keyPairId: process.env.CDN_KEY_PAIR_ID!,
    privateKey: process.env.CDN_PRIVATE_KEY!,
    defaultTTL: parseInt(process.env.CDN_DEFAULT_TTL || '3600', 10),
  };

  return new SignedUrlGenerator(config);
}