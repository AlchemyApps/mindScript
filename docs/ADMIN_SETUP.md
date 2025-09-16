# Admin Portal Setup Guide

## Overview

The MindScript admin portal provides secure administrative access with role-based permissions. This guide covers setting up the initial admin user and managing the admin system.

## Features Implemented

✅ **Database Schema**
- Added `role` column to profiles table (user/admin/super_admin)
- Created admin audit logs table for tracking admin actions
- Added helper functions: `is_admin()`, `has_role()`, `log_admin_action()`

✅ **Authentication & Authorization**
- Role-based access control (RBAC)
- Automatic redirect for unauthorized users
- Session-based authentication checks

✅ **User Management Interface**
- View all users with search and filters
- Grant/revoke admin privileges (super_admin only)
- Update user account status
- Create new admin users directly
- Audit logging for all admin actions

✅ **Security Features**
- No public admin registration
- RLS policies for admin-only data
- Audit trail for all admin actions
- Account status validation

## Initial Setup

### 1. Apply Database Migration

The migration has already been applied and includes:
- Role column on profiles table
- Admin audit logs table
- Security functions and RLS policies

### 2. Create First Admin User

Run the seed script to create your first admin:

```bash
# Navigate to project root
cd /Users/chrisschrade/development/mindScript

# Set admin credentials and run the seed script
ADMIN_EMAIL=admin@mindscript.com \
ADMIN_PASSWORD=YourSecurePassword123! \
node scripts/seed-admin.js
```

**Important Security Notes:**
- Use a strong password (minimum 8 characters)
- Change the password after first login
- The script creates a super_admin by default

### 3. Access the Admin Portal

Once the admin user is created:

1. Navigate to: http://localhost:3002/login
2. Login with your admin credentials
3. You'll be redirected to the admin analytics dashboard

## Role Hierarchy

### User Roles

1. **user** (default)
   - Regular platform user
   - No admin access

2. **admin**
   - Access to admin portal
   - Can view analytics and moderate content
   - Cannot manage other admins

3. **super_admin**
   - Full admin portal access
   - Can create/modify other admins
   - Can view audit logs
   - Can change user roles

## Admin Portal Pages

### User Management (/users)
- View all registered users
- Search by name, email, or username
- Filter by role and status
- Update user roles (super_admin only)
- Update account status
- Create new admin users

### Analytics (/analytics)
- Platform usage statistics
- Revenue metrics
- Content performance
- User growth trends

### Queue Monitor (/monitoring/queue)
- View job queue status
- Monitor processing times
- Identify bottlenecks

## Security Best Practices

1. **Admin Creation**
   - Only super_admins can create new admins
   - All admin actions are logged
   - Email verification is auto-enabled for admin-created users

2. **Access Control**
   - Admin portal checks both authentication and role
   - Suspended accounts cannot access admin portal
   - Sessions expire after inactivity

3. **Audit Trail**
   - All role changes are logged
   - User status changes are tracked
   - Audit logs visible to super_admins only

## Troubleshooting

### Cannot Access Admin Portal

1. Verify user has admin or super_admin role:
   ```sql
   SELECT id, email, role, account_status
   FROM profiles
   WHERE email = 'your-email@example.com';
   ```

2. Check account is active:
   - account_status should be 'active'
   - deleted_at should be NULL

### Seed Script Issues

If the seed script fails:

1. Check environment variables are set correctly
2. Verify Supabase connection in .env.local
3. Ensure no existing user with same email
4. Check Supabase service role key has proper permissions

### Promoting Existing User to Admin

If you need to manually promote a user:

```sql
-- Find the user
SELECT id, email FROM profiles WHERE email = 'user@example.com';

-- Update their role
UPDATE profiles
SET role = 'admin'
WHERE id = 'user-uuid-here';
```

## Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Next Steps

1. Create your first admin user using the seed script
2. Login to the admin portal
3. Set up additional admin users as needed
4. Configure notification preferences
5. Review audit logs regularly

## Support

For issues or questions about the admin system:
1. Check the audit logs for recent actions
2. Review RLS policies in Supabase dashboard
3. Verify role assignments in the database