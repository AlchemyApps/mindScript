# MindScript Database RLS (Row Level Security) Documentation

## Overview

This document provides a comprehensive overview of all Row Level Security (RLS) policies implemented in the MindScript database. RLS ensures data security at the database level, enforcing access control regardless of the application layer.

## Core Security Principles

1. **Default Deny**: All tables have RLS enabled with no implicit access
2. **Least Privilege**: Users only get the minimum access required
3. **Service Role Isolation**: Service role access is restricted to server-side operations
4. **Identity Verification**: All policies verify user identity through `auth.uid()`
5. **Status Checks**: Account status is verified for sensitive operations

## Access Control Matrix

### User Profiles (`public.profiles`)

| Role | SELECT | INSERT | UPDATE | DELETE | Conditions |
|------|--------|--------|--------|--------|------------|
| Anonymous | ❌ | ❌ | ❌ | ❌ | No access |
| Authenticated User | ✅ | ✅ | ✅ | ❌ | Own profile only |
| Admin | ✅ | ❌ | ✅ | ❌ | All profiles (read), own profile (update) |
| Service Role | ✅ | ✅ | ✅ | ✅ | Full access |

**Policies:**
- Users can read and update their own profile
- Admins can read all profiles for moderation
- Profile creation happens automatically on signup via trigger

### Webhook Events (`public.webhook_events`)

| Role | SELECT | INSERT | UPDATE | DELETE | Conditions |
|------|--------|--------|--------|--------|------------|
| Anonymous | ❌ | ❌ | ❌ | ❌ | No access |
| Authenticated User | ❌ | ❌ | ❌ | ❌ | No access |
| Admin | ✅ | ❌ | ❌ | ❌ | Read-only for monitoring |
| Service Role | ✅ | ✅ | ✅ | ✅ | Full access |

**Policies:**
- Service role has exclusive write access for webhook processing
- Admins can monitor webhook events but cannot modify
- Idempotency enforced via unique constraint on (event_id, source)

### Webhook Processing Logs (`public.webhook_processing_logs`)

| Role | SELECT | INSERT | UPDATE | DELETE | Conditions |
|------|--------|--------|--------|--------|------------|
| Anonymous | ❌ | ❌ | ❌ | ❌ | No access |
| Authenticated User | ❌ | ❌ | ❌ | ❌ | No access |
| Admin | ✅ | ❌ | ❌ | ❌ | Read-only for auditing |
| Service Role | ✅ | ✅ | ✅ | ✅ | Full access |

**Policies:**
- Audit trail maintained by service role only
- Admins can review processing history
- Logs are immutable once created

### Webhook DLQ (`public.webhook_dlq`)

| Role | SELECT | INSERT | UPDATE | DELETE | Conditions |
|------|--------|--------|--------|--------|------------|
| Anonymous | ❌ | ❌ | ❌ | ❌ | No access |
| Authenticated User | ❌ | ❌ | ❌ | ❌ | No access |
| Admin | ✅ | ❌ | ✅ | ❌ | Can resolve DLQ entries |
| Service Role | ✅ | ✅ | ✅ | ✅ | Full access |

**Policies:**
- Service role manages failed event queue
- Admins can view and resolve DLQ entries
- Resolution tracking includes who resolved and when

### Webhook Signatures (`public.webhook_signatures`)

| Role | SELECT | INSERT | UPDATE | DELETE | Conditions |
|------|--------|--------|--------|--------|------------|
| Anonymous | ❌ | ❌ | ❌ | ❌ | No access |
| Authenticated User | ❌ | ❌ | ❌ | ❌ | No access |
| Admin | ❌ | ❌ | ❌ | ❌ | No access (security sensitive) |
| Service Role | ✅ | ✅ | ✅ | ✅ | Full access |

**Policies:**
- Highly sensitive table containing signing secrets
- Only service role has access
- Secrets should be encrypted at application layer

## Storage Bucket Policies

### Public Assets (`public-assets`)

| Operation | Anonymous | Authenticated | Owner | Admin | Service Role |
|-----------|-----------|---------------|--------|--------|--------------|
| SELECT | ✅ | ✅ | ✅ | ✅ | ✅ |
| INSERT | ❌ | ✅ | ✅ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ✅ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ✅ | ✅ | ✅ |

**Usage:**
- Published tracks, cover images, public avatars
- CDN-friendly with public read access
- Authenticated users can upload
- Only owners and admins can modify/delete

### Private Assets (`private-assets`)

| Operation | Anonymous | Authenticated | Owner | Admin | Service Role |
|-----------|-----------|---------------|--------|--------|--------------|
| SELECT | ❌ | ❌ | ✅ | ✅ | ✅ |
| INSERT | ❌ | ✅ | ✅ | ✅ | ✅ |
| UPDATE | ❌ | ❌ | ✅ | ✅ | ✅ |
| DELETE | ❌ | ❌ | ✅ | ✅ | ✅ |

**Usage:**
- User uploads, unpublished content, personal recordings
- Requires signed URLs for access
- Owner-only access pattern
- Admin access for moderation

### Audio Processing (`audio-processing`)

| Operation | Anonymous | Authenticated | Owner | Admin | Service Role |
|-----------|-----------|---------------|--------|--------|--------------|
| SELECT | ❌ | ❌ | ❌ | ❌ | ✅ |
| INSERT | ❌ | ❌ | ❌ | ❌ | ✅ |
| UPDATE | ❌ | ❌ | ❌ | ❌ | ✅ |
| DELETE | ❌ | ❌ | ❌ | ❌ | ✅ |

**Usage:**
- Temporary storage for audio rendering
- Service role exclusive access
- Auto-cleanup after processing
- No user access to intermediate files

## Common RLS Patterns

### User-Owned Resources
```sql
CREATE POLICY "Users can access own resources"
ON table_name
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Admin Read Access
```sql
CREATE POLICY "Admins can read all resources"
ON table_name
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
    AND profiles.account_status = 'active'
  )
);
```

### Service Role Full Access
```sql
CREATE POLICY "Service role has full access"
ON table_name
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

### Published Content Pattern
```sql
CREATE POLICY "Public can read published content"
ON table_name
FOR SELECT
TO anon, authenticated
USING (is_published = true AND published_at <= NOW());
```

## Security Considerations

### Webhook Processing
- Idempotency enforced at database level via unique constraints
- Event replay protection through timestamp validation
- Failed events automatically moved to DLQ after max retries
- All webhook signatures stored encrypted

### User Data Protection
- PII (email, IP) access restricted to user and admins
- Soft delete pattern preserves audit trail
- Account suspension prevents all access
- Email verification required for sensitive operations

### Admin Access
- Admin role verified on every request
- Account status must be 'active'
- Read-only access to most system tables
- Write access limited to moderation actions

### Service Role Usage
- Never expose service key to client applications
- Use only in server-side route handlers and Edge Functions
- Rotate keys periodically
- Monitor service role usage in logs

## Testing RLS Policies

### Test Approach
1. Test positive cases (allowed access)
2. Test negative cases (denied access)
3. Test role transitions
4. Test edge cases (null values, expired tokens)

### Example Test Pattern
```sql
-- Test user can read own profile
SET LOCAL "request.jwt.claims" TO '{"sub": "user-uuid"}';
SET LOCAL ROLE authenticated;
SELECT * FROM profiles WHERE id = 'user-uuid'; -- Should succeed
SELECT * FROM profiles WHERE id = 'other-uuid'; -- Should fail
RESET ROLE;
```

## Monitoring and Compliance

### Access Logging
- All webhook events logged with timestamps
- Processing logs maintain audit trail
- Failed access attempts tracked in application logs

### Regular Reviews
- Quarterly RLS policy audit
- Check for overly permissive policies
- Verify service role usage patterns
- Review admin access logs

### Compliance Requirements
- GDPR: User data access limited to owner
- Data retention: Cleanup policies for old webhooks
- Right to deletion: Soft delete with cleanup jobs
- Audit trail: Immutable logs for all operations

## Migration Guidelines

### Adding New Tables
1. Always enable RLS: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
2. Start with no policies (default deny)
3. Add service role policy first
4. Add user policies with strict conditions
5. Test all access patterns
6. Document in this file

### Modifying Existing Policies
1. Test changes in staging environment
2. Create rollback plan
3. Apply during low-traffic period
4. Verify with integration tests
5. Monitor for access errors

## Emergency Procedures

### Suspected Breach
1. Rotate all service keys immediately
2. Review recent webhook events for anomalies
3. Check admin access logs
4. Temporarily restrict admin roles if needed
5. Audit all recent RLS policy changes

### Policy Rollback
1. Keep previous policy definitions in migrations
2. Test rollback in staging first
3. Apply with transaction wrapper
4. Verify application functionality
5. Document incident and resolution