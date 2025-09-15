# CloudFront CDN Infrastructure

This directory contains Terraform configuration for deploying a CloudFront CDN distribution for MindScript's media delivery.

## Features

- **CloudFront Distribution** with multiple cache behaviors for different content types
- **Signed URLs** for private content access
- **Origin configuration** for Supabase Storage
- **Cache policies** optimized for different content types:
  - Public tracks: 7 days cache
  - Private tracks: No cache, requires signed URLs
  - Images: 30 days cache
  - Static assets: 1 year cache
- **Security features**:
  - HTTPS-only access
  - TLS 1.2+ enforcement
  - Optional WAF integration
  - Geo-restriction capabilities
  - CORS headers configuration
- **Monitoring**:
  - CloudWatch alarms for cache hit rate, origin latency, and error rate
  - Access logs stored in S3

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform >= 1.0
3. ACM certificate for custom domain (must be in us-east-1)
4. Supabase project with Storage enabled

## Setup

### 1. Configure Environment Variables

Copy the appropriate environment file and update the values:

```bash
cp environments/dev.tfvars environments/local.tfvars
```

Update the following in `local.tfvars`:
- `supabase_storage_url`: Your Supabase Storage URL
- `supabase_project_ref`: Your Supabase project reference
- `custom_domain`: Your custom domain for CDN
- `acm_certificate_arn`: ARN of your ACM certificate

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Plan Deployment

```bash
terraform plan -var-file=environments/dev.tfvars
```

### 4. Deploy

```bash
terraform apply -var-file=environments/dev.tfvars
```

## Cache Behaviors

| Path Pattern | Cache TTL | Description |
|-------------|-----------|-------------|
| `/public/tracks/*` | 7 days | Public audio tracks |
| `/private/*` | No cache | Private content requiring signed URLs |
| `/images/*` | 30 days | Image assets |
| `/static/*` | 1 year | Static assets |
| Default | 1 day | All other content |

## Signed URL Generation

For private content, use the `@mindscript/cdn` package:

```typescript
import { SignedUrlGenerator } from '@mindscript/cdn';

const generator = new SignedUrlGenerator({
  distributionDomain: 'https://cdn.mindscript.app',
  keyPairId: process.env.CDN_KEY_PAIR_ID,
  privateKey: process.env.CDN_PRIVATE_KEY,
  defaultTTL: 3600,
});

const signedUrl = generator.generateSignedUrl({
  path: 'private/track-123.mp3',
  expiresIn: 7200, // 2 hours
});
```

## Monitoring

CloudWatch alarms are configured for:

- **Cache Hit Rate**: Alert when below 80%
- **Origin Latency**: Alert when above 1000ms
- **Error Rate**: Alert when 4xx errors exceed 5%

## Cost Optimization

- Use `PriceClass_100` for development (North America and Europe only)
- Use `PriceClass_All` for production (all edge locations)
- Monitor CloudWatch metrics to optimize cache TTLs
- Use CloudFront compression for text assets

## Security

- All content served over HTTPS
- TLS 1.2 minimum protocol version
- Origin verification using custom header
- Optional WAF integration for DDoS protection
- Signed URLs for private content with expiration

## Outputs

After deployment, Terraform will output:

- `cloudfront_distribution_id`: Distribution ID for cache invalidation
- `cloudfront_distribution_domain_name`: CloudFront domain name
- `cdn_logs_bucket`: S3 bucket for access logs
- `cdn_secret_header_value`: Secret header for origin verification (sensitive)

## Cache Invalidation

To invalidate cached content:

```typescript
import { CacheInvalidator } from '@mindscript/cdn';

const invalidator = new CacheInvalidator(distributionId);
await invalidator.createInvalidation(['/path/to/invalidate/*']);
```

## Troubleshooting

### Low Cache Hit Rate
- Review cache behaviors and TTL settings
- Check if query strings are causing cache misses
- Verify origin response headers

### High Origin Latency
- Check Supabase Storage performance
- Consider increasing origin timeout settings
- Review origin connection limits

### Access Denied Errors
- Verify signed URL generation for private content
- Check CloudFront distribution status
- Review geo-restriction settings

## Cleanup

To destroy the infrastructure:

```bash
terraform destroy -var-file=environments/dev.tfvars
```

**Note**: This will delete the CloudFront distribution and associated resources. Access logs in S3 will be preserved.