# MindScript Storage Access Control Matrix

## Overview

MindScript uses three distinct storage buckets for managing audio files with granular access control through Row Level Security (RLS) policies. This document outlines the complete access control matrix and security implementation.

## Storage Buckets

### 1. tracks-private (Full Audio Files)
- **Purpose**: Store complete audio tracks that users purchase
- **Access Model**: Private (authenticated access only)
- **File Size Limit**: 500MB
- **Path Structure**: `{user_id}/{year}/{month}/{track_id}/{filename}`

### 2. tracks-public (Preview Clips)
- **Purpose**: Store 15-30 second preview clips for discovery
- **Access Model**: Public (anyone can read)
- **File Size Limit**: 10MB
- **Path Structure**: `{user_id}/{year}/{month}/{track_id}/{filename}`

### 3. tracks-temp (Processing Files)
- **Purpose**: Temporary storage during audio processing
- **Access Model**: Service role only
- **File Size Limit**: 1GB
- **Auto-cleanup**: Files deleted after 24 hours

## Access Control Matrix

### tracks-private Bucket

| Operation | Anonymous | Authenticated User | Track Owner | Purchaser | Service Role |
|-----------|-----------|-------------------|--------------|-----------|--------------|
| SELECT    | ❌        | ❌                | ✅           | ✅        | ✅           |
| INSERT    | ❌        | ❌                | ✅           | ❌        | ✅           |
| UPDATE    | ❌        | ❌                | ✅           | ❌        | ✅           |
| DELETE    | ❌        | ❌                | ✅           | ❌        | ✅           |

**Access Rules:**
- Track owners can perform all operations on their own files
- Purchasers can only read tracks they've bought (status = 'completed')
- Files must follow the path pattern: `{user_id}/{year}/{month}/{track_id}/{filename}`
- Service role has unrestricted access for system operations

### tracks-public Bucket

| Operation | Anonymous | Authenticated User | Track Owner | Service Role |
|-----------|-----------|-------------------|--------------|--------------|
| SELECT    | ✅        | ✅                | ✅           | ✅           |
| INSERT    | ❌        | ❌                | ✅           | ✅           |
| UPDATE    | ❌        | ❌                | ✅           | ✅           |
| DELETE    | ❌        | ❌                | ✅           | ✅           |

**Access Rules:**
- Anyone can read preview files (public access)
- Only track owners can upload/modify their own previews
- Files must follow the path pattern for write operations
- Service role has unrestricted access

### tracks-temp Bucket

| Operation | Anonymous | Authenticated User | Track Owner | Service Role |
|-----------|-----------|-------------------|--------------|--------------|
| SELECT    | ❌        | ❌                | ❌           | ✅           |
| INSERT    | ❌        | ❌                | ❌           | ✅           |
| UPDATE    | ❌        | ❌                | ❌           | ✅           |
| DELETE    | ❌        | ❌                | ❌           | ✅           |

**Access Rules:**
- Exclusively for service role operations
- No user access allowed
- Automatic cleanup after 24 hours via `cleanup_temp_storage()` function

## RLS Policy Implementation

### Key Security Principles

1. **Default Deny**: All buckets start with no access; policies explicitly grant permissions
2. **Least Privilege**: Users only get the minimum access required
3. **Path Enforcement**: File paths must follow strict patterns to prevent unauthorized access
4. **Ownership Verification**: User ID from auth token must match path structure
5. **Purchase Validation**: Access to purchased tracks requires completed payment status

### Policy Patterns Used

#### Owner-based Access
```sql
storage.objects.owner = auth.uid()
AND storage.objects.name ~ ('^' || auth.uid()::text || '/')
```

#### Purchase-based Access
```sql
EXISTS (
  SELECT 1 FROM public.purchases p
  INNER JOIN public.tracks t ON t.id = p.track_id
  WHERE p.user_id = auth.uid()
  AND p.status = 'completed'
  AND storage.objects.name LIKE '%/' || t.id::text || '/%'
)
```

#### Path Pattern Validation
```sql
storage.objects.name ~ ('^' || auth.uid()::text || '/\d{4}/\d{2}/[a-f0-9\-]{36}/.+$')
```
This ensures:
- Path starts with user's ID
- Followed by 4-digit year
- Followed by 2-digit month
- Followed by valid UUID (track ID)
- Followed by filename

## Helper Functions

### generate_storage_path()
Generates standardized paths for file storage:
```sql
SELECT generate_storage_path(
  user_id,
  track_id,
  filename,
  'private' -- or 'public' or 'temp'
);
```

### get_track_signed_url()
Validates access and prepares for signed URL generation:
```sql
SELECT get_track_signed_url(
  track_id,
  3600 -- expiry in seconds
);
```

### cleanup_temp_storage()
Removes temporary files older than 24 hours:
```sql
SELECT cleanup_temp_storage();
```

## Security Considerations

### File Upload Security
- MIME type restrictions prevent non-audio file uploads
- File size limits prevent resource abuse
- Path patterns prevent directory traversal attacks

### Access Token Security
- All private bucket access requires valid JWT
- Tokens are validated against auth.uid()
- Purchase verification happens in real-time

### Signed URL Best Practices
- Use short expiry times (1 hour default)
- Generate URLs server-side only
- Never expose service keys to clients
- Log URL generation for audit trails

## CORS Configuration

### tracks-private
- **Allowed Origins**: Application domains only
- **Methods**: GET, POST, PUT, DELETE
- **Headers**: authorization, x-client-info, apikey, content-type, range
- **Max Age**: 3600 seconds

### tracks-public
- **Allowed Origins**: * (public access)
- **Methods**: GET, HEAD
- **Headers**: range, content-type
- **Max Age**: 86400 seconds

### tracks-temp
- **Allowed Origins**: Server domains only
- **Methods**: GET, POST, PUT, DELETE
- **Headers**: authorization, x-client-info, apikey, content-type
- **Max Age**: 300 seconds

## Monitoring and Metrics

### Storage Usage View
The `user_storage_usage` view provides:
- File count per user per bucket
- Total storage used in bytes and MB
- Last upload timestamp

```sql
SELECT * FROM public.user_storage_usage
WHERE user_id = auth.uid();
```

### Performance Indexes
Optimized indexes for:
- Bucket + owner queries
- Temp file cleanup by creation date
- Path pattern matching for RLS evaluation

## Testing Checklist

### Positive Tests (Should Succeed)
- [ ] Track owner can upload to private bucket
- [ ] Track owner can read their own files
- [ ] Purchaser can read bought tracks
- [ ] Anyone can read public previews
- [ ] Service role can access all buckets

### Negative Tests (Should Fail)
- [ ] Non-owner cannot upload to another user's path
- [ ] Non-purchaser cannot read private tracks
- [ ] Anonymous users cannot upload to any bucket
- [ ] Regular users cannot access temp bucket
- [ ] Invalid path patterns are rejected

## Migration Rollback Plan

If issues arise, rollback with:
```sql
-- Remove policies
DROP POLICY IF EXISTS "Track owners can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Purchasers can read purchased tracks" ON storage.objects;
-- ... (all other policies)

-- Remove functions
DROP FUNCTION IF EXISTS public.generate_storage_path(UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.cleanup_temp_storage();
DROP FUNCTION IF EXISTS public.get_track_signed_url(UUID, INTEGER);

-- Remove view
DROP VIEW IF EXISTS public.user_storage_usage;

-- Note: Buckets should be manually removed after ensuring no data loss
```

## Related Documentation
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage Security](https://supabase.com/docs/guides/storage/security)