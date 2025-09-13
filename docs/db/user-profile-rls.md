# User Profile Management - RLS Policy Matrix

## Overview
This document describes the Row Level Security (RLS) policies for the User Profile Management System (Phase 2.1.4). All policies follow a **default-deny** approach with explicit grants for specific operations.

## Tables and Access Control

### 1. `public.profiles` Table

#### Schema Extensions (Phase 2.1.4)
- `username` (text, unique, nullable) - Public profile URL identifier
- `theme` (text) - UI theme preference: 'light', 'dark', 'system'
- `notification_settings` (jsonb) - Email and push notification preferences
- `privacy_settings` (jsonb) - Profile visibility and data sharing controls
- `account_status` (text) - 'active', 'suspended', 'deleted', 'pending_verification'
- `email_verified` (boolean) - Email verification status
- `email_verified_at` (timestamptz) - Verification timestamp
- `deleted_at` (timestamptz) - Soft delete timestamp
- `deletion_reason` (text) - Reason for account deletion
- `suspended_at` (timestamptz) - Suspension timestamp
- `suspension_reason` (text) - Reason for suspension
- `suspension_expires_at` (timestamptz) - Auto-lift timestamp

#### RLS Policy Matrix

| Policy Name | Operation | Role | Conditions | Description |
|------------|-----------|------|------------|-------------|
| `Users can view own profile` | SELECT | authenticated | `auth.uid() = id` | Users always see their complete profile |
| `Public profiles viewable with privacy` | SELECT | authenticated | Multiple conditions | View public profiles based on privacy settings |
| `Users can update own profile` | UPDATE | authenticated | Active/pending accounts only | Update with field restrictions |
| `Service role has full access` | ALL | service_role | None | Admin bypass for server operations |

#### Field-Level Access Control

**User-Editable Fields:**
- `username` - With validation and uniqueness check
- `display_name` - Max 50 characters
- `bio` - Max 500 characters
- `avatar_url` - Via storage upload
- `theme` - UI preference
- `notification_settings` - Notification preferences
- `privacy_settings` - Privacy controls
- `settings` - General settings JSON
- `metadata` - User metadata

**System-Only Fields (Cannot be directly edited by users):**
- `email` - Managed by auth system
- `stripe_customer_id` - Set by payment system
- `role_flags` - Admin-managed roles
- `is_premium` - Subscription status
- `subscription_tier` - Subscription level
- `subscription_expires_at` - Subscription expiry
- `credits_remaining` - Credit balance
- `account_status` - Account state
- `email_verified` - Verification status
- `email_verified_at` - Verification timestamp
- `suspended_at` - Suspension timestamp
- `suspension_reason` - Suspension details
- `suspension_expires_at` - Suspension expiry

#### Privacy Settings Structure

```json
{
  "profile_visibility": "public|private|friends",
  "show_email": false,
  "show_purchases": false,
  "show_projects": true,
  "allow_messages": true,
  "searchable": true
}
```

#### Notification Settings Structure

```json
{
  "email_marketing": true,
  "email_updates": true,
  "email_security": true,
  "push_enabled": false,
  "render_complete": true,
  "purchase_receipts": true,
  "weekly_digest": false
}
```

### 2. `public.user_preferences` Table

#### RLS Policy Matrix

| Policy Name | Operation | Role | Conditions | Description |
|------------|-----------|------|------------|-------------|
| `Users can view own preferences` | SELECT | authenticated | User not deleted | View own preferences |
| `Users can update own preferences` | UPDATE | authenticated | Account active | Update own preferences |

### 3. Storage Buckets

#### `avatars` Bucket (To be configured)

| Policy Name | Operation | Conditions | Description |
|------------|-----------|------------|-------------|
| `Users upload own avatar` | INSERT | `auth.uid() = owner` | Upload avatar images |
| `Users update own avatar` | UPDATE | `auth.uid() = owner` | Replace avatar |
| `Users delete own avatar` | DELETE | `auth.uid() = owner` | Remove avatar |
| `Public read with signed URLs` | SELECT | Signed URL required | Access via signed URLs only |

**File Restrictions:**
- Max size: 5MB
- Allowed types: image/jpeg, image/png, image/gif, image/webp
- Auto-resize to standard dimensions
- CDN delivery for performance

## Access Patterns

### 1. Profile Viewing

```sql
-- Own profile (always visible)
SELECT * FROM profiles WHERE id = auth.uid();

-- Public profiles (respects privacy)
SELECT * FROM profiles 
WHERE account_status = 'active'
  AND deleted_at IS NULL
  AND privacy_settings->>'profile_visibility' = 'public';
```

### 2. Profile Updates

```sql
-- Allowed update (user-editable fields only)
UPDATE profiles 
SET 
  display_name = 'New Name',
  bio = 'Updated bio',
  theme = 'dark'
WHERE id = auth.uid();

-- Blocked update (system fields)
UPDATE profiles 
SET email_verified = true  -- Will be rejected by RLS
WHERE id = auth.uid();
```

### 3. Account Deletion

```sql
-- Soft delete with anonymization
SELECT public.soft_delete_user_account(
  user_id := auth.uid(),
  reason := 'User requested'
);
```

## Security Considerations

### 1. Username Security
- Validated for format and reserved names
- Normalized to lowercase
- Unique constraint prevents duplicates
- Cannot start with numbers or special characters
- 3-30 character limit

### 2. Account Status Controls
- Suspended accounts cannot update profiles
- Deleted accounts are anonymized
- Pending verification has limited access
- Service role required for status changes

### 3. Audit Trail
- All significant changes logged to `audit_logs`
- Username changes tracked
- Email verification logged
- Account status changes recorded
- Deletion reasons preserved

### 4. Data Anonymization
- Soft delete anonymizes PII
- Email replaced with hash
- Username cleared
- Display name genericized
- Scripts and projects anonymized

## Testing Requirements

All RLS policies must be tested for:

1. **Positive Cases** - Allowed operations succeed
2. **Negative Cases** - Blocked operations fail
3. **Edge Cases** - Boundary conditions handled
4. **Status Transitions** - Account state changes
5. **Cascade Effects** - Related data handling

## Migration Safety

### Forward-Only Design
- All changes are additive
- No data loss on migration
- Backward compatible with existing code
- Default values for new fields

### Rollback Considerations
- New columns can be ignored if rollback needed
- RLS policies can be reverted independently
- Audit trail preserved for compliance

## Performance Optimizations

### Indexes
- `idx_profiles_account_status` - Filter active users
- `idx_profiles_email_verified` - Find unverified accounts
- `idx_profiles_deleted_at` - Exclude deleted accounts
- `idx_profiles_last_login_at` - Activity tracking
- Username unique index (existing)

### Query Patterns
- Use account_status index for active user queries
- Filter deleted_at IS NULL for performance
- Privacy settings JSON indexed for common queries

## Compliance Notes

1. **GDPR Compliance**
   - Soft delete preserves audit requirements
   - Data anonymization on deletion
   - User can request full deletion

2. **Data Retention**
   - Audit logs retained indefinitely
   - Deleted account shells retained for integrity
   - Anonymized data cannot be recovered

3. **Access Logging**
   - All profile changes audited
   - Last login tracked
   - IP addresses logged for security