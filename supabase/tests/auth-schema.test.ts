import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

describe('Authentication Schema & RLS Policies', () => {
  let anonClient: SupabaseClient;
  let serviceClient: SupabaseClient;
  let testUserId: string;
  let testUser2Id: string;

  beforeAll(async () => {
    // Initialize clients
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
    serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Create test users using service role
    const { data: user1, error: error1 } = await serviceClient.auth.admin.createUser({
      email: 'test1@example.com',
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (error1) throw error1;
    testUserId = user1.user.id;

    const { data: user2, error: error2 } = await serviceClient.auth.admin.createUser({
      email: 'test2@example.com',
      password: 'TestPassword123!',
      email_confirm: true,
    });
    if (error2) throw error2;
    testUser2Id = user2.user.id;
  });

  afterAll(async () => {
    // Clean up test users
    if (testUserId) {
      await serviceClient.auth.admin.deleteUser(testUserId);
    }
    if (testUser2Id) {
      await serviceClient.auth.admin.deleteUser(testUser2Id);
    }
  });

  describe('Profiles Table RLS', () => {
    it('should automatically create profile on user signup', async () => {
      // Profile should be created by trigger
      const { data: profile, error } = await serviceClient
        .from('profiles')
        .select('*')
        .eq('id', testUserId)
        .single();

      expect(error).toBeNull();
      expect(profile).toBeDefined();
      expect(profile.email).toBe('test1@example.com');
      expect(profile.display_name).toBe('test1'); // Extracted from email
    });

    it('should allow public read access to profiles', async () => {
      // Using anon client (not authenticated)
      const { data: profiles, error } = await anonClient
        .from('profiles')
        .select('id, display_name, avatar_url, bio');

      expect(error).toBeNull();
      expect(profiles).toBeDefined();
    });

    it('should allow users to update their own profile', async () => {
      // Sign in as test user
      const { data: session } = await serviceClient.auth.admin.generateLink({
        type: 'magiclink',
        email: 'test1@example.com',
      });

      const { error: signInError } = await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      const newDisplayName = 'Updated Name';
      const { data, error } = await anonClient
        .from('profiles')
        .update({ display_name: newDisplayName })
        .eq('id', testUserId)
        .select();

      expect(error).toBeNull();
      expect(data[0].display_name).toBe(newDisplayName);
    });

    it('should prevent users from updating other profiles', async () => {
      // Sign in as test user 1
      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      // Try to update test user 2's profile
      const { error } = await anonClient
        .from('profiles')
        .update({ display_name: 'Hacked!' })
        .eq('id', testUser2Id);

      expect(error).toBeDefined();
      expect(error.code).toBe('42501'); // Insufficient privilege
    });

    it('should enforce display_name length constraint', async () => {
      const longName = 'a'.repeat(51); // Over 50 char limit
      
      const { error } = await serviceClient
        .from('profiles')
        .update({ display_name: longName })
        .eq('id', testUserId);

      expect(error).toBeDefined();
      expect(error.message).toContain('display_name_length');
    });

    it('should enforce bio length constraint', async () => {
      const longBio = 'a'.repeat(501); // Over 500 char limit
      
      const { error } = await serviceClient
        .from('profiles')
        .update({ bio: longBio })
        .eq('id', testUserId);

      expect(error).toBeDefined();
      expect(error.message).toContain('bio_length');
    });
  });

  describe('User Preferences RLS', () => {
    it('should automatically create preferences on user signup', async () => {
      const { data: prefs, error } = await serviceClient
        .from('user_preferences')
        .select('*')
        .eq('user_id', testUserId)
        .single();

      expect(error).toBeNull();
      expect(prefs).toBeDefined();
      expect(prefs.theme).toBe('light'); // Default value
      expect(prefs.notifications_enabled).toBe(true);
    });

    it('should allow users to view only their own preferences', async () => {
      // Sign in as test user 1
      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      const { data: prefs, error } = await anonClient
        .from('user_preferences')
        .select('*');

      expect(error).toBeNull();
      expect(prefs).toHaveLength(1);
      expect(prefs[0].user_id).toBe(testUserId);
    });

    it('should prevent users from viewing other preferences', async () => {
      // Sign in as test user 1
      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      // Try to query test user 2's preferences
      const { data: prefs, error } = await anonClient
        .from('user_preferences')
        .select('*')
        .eq('user_id', testUser2Id);

      expect(error).toBeNull();
      expect(prefs).toHaveLength(0); // RLS filters out the result
    });

    it('should allow users to update their own preferences', async () => {
      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      const { data, error } = await anonClient
        .from('user_preferences')
        .update({ theme: 'dark', notifications_enabled: false })
        .eq('user_id', testUserId)
        .select();

      expect(error).toBeNull();
      expect(data[0].theme).toBe('dark');
      expect(data[0].notifications_enabled).toBe(false);
    });

    it('should enforce theme enum constraint', async () => {
      const { error } = await serviceClient
        .from('user_preferences')
        .update({ theme: 'invalid' })
        .eq('user_id', testUserId);

      expect(error).toBeDefined();
      expect(error.message).toContain('theme');
    });
  });

  describe('Seller Agreements RLS', () => {
    let agreementId: string;

    beforeEach(async () => {
      // Create a seller agreement for test user 1
      const { data, error } = await serviceClient
        .from('seller_agreements')
        .insert({
          user_id: testUserId,
          agreement_version: '1.0',
        })
        .select()
        .single();

      if (!error && data) {
        agreementId = data.id;
      }
    });

    it('should allow users to create their own seller agreement', async () => {
      await anonClient.auth.signInWithPassword({
        email: 'test2@example.com',
        password: 'TestPassword123!',
      });

      const { data, error } = await anonClient
        .from('seller_agreements')
        .insert({
          user_id: testUser2Id,
          agreement_version: '1.0',
        })
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0].user_id).toBe(testUser2Id);
    });

    it('should prevent duplicate agreements for same user', async () => {
      const { error } = await serviceClient
        .from('seller_agreements')
        .insert({
          user_id: testUserId,
          agreement_version: '1.0',
        });

      expect(error).toBeDefined();
      expect(error.message).toContain('unique_user_agreement');
    });

    it('should allow users to view their own agreement', async () => {
      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      const { data, error } = await anonClient
        .from('seller_agreements')
        .select('*')
        .eq('user_id', testUserId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(agreementId);
    });

    it('should prevent users from viewing other agreements', async () => {
      await anonClient.auth.signInWithPassword({
        email: 'test2@example.com',
        password: 'TestPassword123!',
      });

      const { data, error } = await anonClient
        .from('seller_agreements')
        .select('*')
        .eq('user_id', testUserId);

      expect(error).toBeNull();
      expect(data).toHaveLength(0); // RLS filters out
    });

    it('should allow users to update their own agreement', async () => {
      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      const { data, error } = await anonClient
        .from('seller_agreements')
        .update({ 
          onboarding_status: 'in_progress',
          stripe_connect_id: 'acct_test123',
        })
        .eq('id', agreementId)
        .select();

      expect(error).toBeNull();
      expect(data[0].onboarding_status).toBe('in_progress');
      expect(data[0].stripe_connect_id).toBe('acct_test123');
    });

    it('should enforce onboarding_status enum', async () => {
      const { error } = await serviceClient
        .from('seller_agreements')
        .update({ onboarding_status: 'invalid' })
        .eq('id', agreementId);

      expect(error).toBeDefined();
      expect(error.message).toContain('onboarding_status');
    });

    it('should allow admins to view all agreements', async () => {
      // Update test user 1 to be admin
      await serviceClient
        .from('profiles')
        .update({ role_flags: { is_admin: true, is_seller: false } })
        .eq('id', testUserId);

      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      const { data, error } = await anonClient
        .from('seller_agreements')
        .select('*');

      expect(error).toBeNull();
      expect(data.length).toBeGreaterThanOrEqual(1); // Can see all agreements
    });
  });

  describe('Storage Bucket RLS', () => {
    it('should allow users to upload to their own avatar folder', async () => {
      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      const file = new File(['test'], 'avatar.png', { type: 'image/png' });
      const { data, error } = await anonClient.storage
        .from('avatars')
        .upload(`${testUserId}/avatar.png`, file);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should prevent users from uploading to other user folders', async () => {
      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      const file = new File(['test'], 'avatar.png', { type: 'image/png' });
      const { error } = await anonClient.storage
        .from('avatars')
        .upload(`${testUser2Id}/avatar.png`, file);

      expect(error).toBeDefined();
    });

    it('should allow anyone to view avatars', async () => {
      // Upload an avatar first
      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      const file = new File(['test'], 'test.png', { type: 'image/png' });
      await anonClient.storage
        .from('avatars')
        .upload(`${testUserId}/test.png`, file);

      // Sign out and try to get public URL
      await anonClient.auth.signOut();
      
      const { data } = anonClient.storage
        .from('avatars')
        .getPublicUrl(`${testUserId}/test.png`);

      expect(data.publicUrl).toBeDefined();
    });

    it('should enforce file size limit', async () => {
      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      // Create a file larger than 5MB
      const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.png', { 
        type: 'image/png' 
      });
      
      const { error } = await anonClient.storage
        .from('avatars')
        .upload(`${testUserId}/large.png`, largeFile);

      expect(error).toBeDefined();
      expect(error.message).toContain('size');
    });

    it('should enforce allowed mime types', async () => {
      await anonClient.auth.signInWithPassword({
        email: 'test1@example.com',
        password: 'TestPassword123!',
      });

      const file = new File(['test'], 'document.pdf', { type: 'application/pdf' });
      const { error } = await anonClient.storage
        .from('avatars')
        .upload(`${testUserId}/document.pdf`, file);

      expect(error).toBeDefined();
      expect(error.message).toContain('mime');
    });
  });

  describe('Cascade Deletes', () => {
    it('should cascade delete preferences when user is deleted', async () => {
      // Create a new user
      const { data: newUser } = await serviceClient.auth.admin.createUser({
        email: 'cascade@example.com',
        password: 'TestPassword123!',
        email_confirm: true,
      });

      // Verify preferences exist
      const { data: prefsBefore } = await serviceClient
        .from('user_preferences')
        .select('*')
        .eq('user_id', newUser.user.id);
      
      expect(prefsBefore).toHaveLength(1);

      // Delete user
      await serviceClient.auth.admin.deleteUser(newUser.user.id);

      // Verify preferences are deleted
      const { data: prefsAfter } = await serviceClient
        .from('user_preferences')
        .select('*')
        .eq('user_id', newUser.user.id);
      
      expect(prefsAfter).toHaveLength(0);
    });

    it('should cascade delete seller agreements when user is deleted', async () => {
      // Create a new user
      const { data: newUser } = await serviceClient.auth.admin.createUser({
        email: 'seller@example.com',
        password: 'TestPassword123!',
        email_confirm: true,
      });

      // Create seller agreement
      await serviceClient
        .from('seller_agreements')
        .insert({
          user_id: newUser.user.id,
          agreement_version: '1.0',
        });

      // Delete user
      await serviceClient.auth.admin.deleteUser(newUser.user.id);

      // Verify agreement is deleted
      const { data: agreements } = await serviceClient
        .from('seller_agreements')
        .select('*')
        .eq('user_id', newUser.user.id);
      
      expect(agreements).toHaveLength(0);
    });
  });

  describe('Audit Logging', () => {
    it('should log profile creation', async () => {
      // Create a new user to trigger profile creation
      const { data: newUser } = await serviceClient.auth.admin.createUser({
        email: 'audit@example.com',
        password: 'TestPassword123!',
        email_confirm: true,
      });

      // Check audit log
      const { data: logs } = await serviceClient
        .from('audit_logs')
        .select('*')
        .eq('user_id', newUser.user.id)
        .eq('action', 'CREATE')
        .eq('table_name', 'profiles');

      expect(logs).toHaveLength(1);
      expect(logs[0].metadata.auto_created).toBe(true);

      // Clean up
      await serviceClient.auth.admin.deleteUser(newUser.user.id);
    });

    it('should log profile deletion', async () => {
      // Create and delete a user
      const { data: newUser } = await serviceClient.auth.admin.createUser({
        email: 'delete@example.com',
        password: 'TestPassword123!',
        email_confirm: true,
      });

      const userId = newUser.user.id;
      await serviceClient.auth.admin.deleteUser(userId);

      // Check audit log
      const { data: logs } = await serviceClient
        .from('audit_logs')
        .select('*')
        .eq('record_id', userId)
        .eq('action', 'DELETE')
        .eq('table_name', 'profiles');

      expect(logs).toHaveLength(1);
      expect(logs[0].metadata.cascade_delete).toBe(true);
    });
  });
});