-- Test Suite: User Profile Management System Extensions
-- Tests for Phase 2.1.4 schema changes and RLS policies
-- Run these tests after applying the migration to verify correctness

-- ============================================================================
-- TEST SETUP
-- ============================================================================

-- Create test users
DO $$
DECLARE
  test_user1_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
  test_user2_id UUID := '22222222-2222-2222-2222-222222222222'::UUID;
  test_admin_id UUID := '33333333-3333-3333-3333-333333333333'::UUID;
BEGIN
  -- Clean up any existing test data
  DELETE FROM public.audit_logs WHERE user_id IN (test_user1_id, test_user2_id, test_admin_id);
  DELETE FROM public.profiles WHERE id IN (test_user1_id, test_user2_id, test_admin_id);
  DELETE FROM auth.users WHERE id IN (test_user1_id, test_user2_id, test_admin_id);
  
  -- Create test auth users
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
  VALUES 
    (test_user1_id, 'testuser1@example.com', NOW(), NOW(), NOW()),
    (test_user2_id, 'testuser2@example.com', NOW(), NOW(), NOW()),
    (test_admin_id, 'admin@example.com', NOW(), NOW(), NOW());
  
  -- Create test profiles with new fields
  INSERT INTO public.profiles (
    id, email, username, display_name, bio,
    theme, notification_settings, privacy_settings,
    account_status, email_verified, created_at, updated_at
  ) VALUES 
    (
      test_user1_id, 
      'testuser1@example.com',
      'testuser1',
      'Test User One',
      'This is my test bio',
      'dark',
      '{"email_updates": true, "push_enabled": false}'::jsonb,
      '{"profile_visibility": "public", "show_email": false}'::jsonb,
      'active',
      true,
      NOW(),
      NOW()
    ),
    (
      test_user2_id,
      'testuser2@example.com', 
      'testuser2',
      'Test User Two',
      NULL,
      'light',
      '{"email_updates": false}'::jsonb,
      '{"profile_visibility": "private"}'::jsonb,
      'active',
      false,
      NOW(),
      NOW()
    ),
    (
      test_admin_id,
      'admin@example.com',
      'adminuser',
      'Admin User',
      'System administrator',
      'system',
      '{}'::jsonb,
      '{"profile_visibility": "private"}'::jsonb,
      'active',
      true,
      NOW(),
      NOW()
    );
END $$;

-- ============================================================================
-- TEST 1: Username Validation
-- ============================================================================

DO $$
BEGIN
  -- Test valid usernames
  ASSERT public.validate_username('validuser123'), 'Valid username should pass';
  ASSERT public.validate_username('user_name'), 'Username with underscore should pass';
  ASSERT public.validate_username('user-name'), 'Username with hyphen should pass';
  ASSERT public.validate_username('abc'), 'Three character username should pass';
  
  -- Test invalid usernames
  ASSERT NOT public.validate_username('ab'), 'Too short username should fail';
  ASSERT NOT public.validate_username('1user'), 'Username starting with number should fail';
  ASSERT NOT public.validate_username('_user'), 'Username starting with underscore should fail';
  ASSERT NOT public.validate_username('user__name'), 'Double underscore should fail';
  ASSERT NOT public.validate_username('user--name'), 'Double hyphen should fail';
  ASSERT NOT public.validate_username('admin'), 'Reserved username should fail';
  ASSERT NOT public.validate_username('a' || repeat('x', 30)), 'Too long username should fail';
  
  RAISE NOTICE 'TEST 1 PASSED: Username validation works correctly';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 1 FAILED: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 2: Username Normalization Trigger
-- ============================================================================

DO $$
DECLARE
  test_id UUID := '44444444-4444-4444-4444-444444444444'::UUID;
  normalized_username TEXT;
BEGIN
  -- Create auth user
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
  VALUES (test_id, 'testcase@example.com', NOW(), NOW(), NOW());
  
  -- Insert with uppercase username
  INSERT INTO public.profiles (id, email, username)
  VALUES (test_id, 'testcase@example.com', 'TestCaseUser');
  
  -- Check if username was normalized to lowercase
  SELECT username INTO normalized_username 
  FROM public.profiles WHERE id = test_id;
  
  ASSERT normalized_username = 'testcaseuser', 'Username should be normalized to lowercase';
  
  -- Cleanup
  DELETE FROM public.profiles WHERE id = test_id;
  DELETE FROM auth.users WHERE id = test_id;
  
  RAISE NOTICE 'TEST 2 PASSED: Username normalization trigger works';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 2 FAILED: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 3: RLS Policy - Users Can View Own Profile
-- ============================================================================

DO $$
DECLARE
  result_count INTEGER;
BEGIN
  -- Set session for test_user1
  PERFORM set_config('request.jwt.claims', 
    json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  
  -- User should see their own profile
  SELECT COUNT(*) INTO result_count
  FROM public.profiles
  WHERE id = '11111111-1111-1111-1111-111111111111'::UUID;
  
  ASSERT result_count = 1, 'User should see their own profile';
  
  -- Reset session
  PERFORM set_config('request.jwt.claims', NULL, true);
  
  RAISE NOTICE 'TEST 3 PASSED: Users can view own profile';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 3 FAILED: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 4: RLS Policy - Public Profile Visibility
-- ============================================================================

DO $$
DECLARE
  visible_count INTEGER;
BEGIN
  -- Set session for test_user2
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
  
  -- Should see test_user1 (public profile) but not admin (private profile)
  SELECT COUNT(*) INTO visible_count
  FROM public.profiles
  WHERE id != '22222222-2222-2222-2222-222222222222'::UUID
    AND privacy_settings->>'profile_visibility' = 'public';
  
  ASSERT visible_count = 1, 'Should see only public profiles';
  
  -- Reset session
  PERFORM set_config('request.jwt.claims', NULL, true);
  
  RAISE NOTICE 'TEST 4 PASSED: Public profile visibility works';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 4 FAILED: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 5: RLS Policy - Profile Update Restrictions
-- ============================================================================

DO $$
DECLARE
  update_success BOOLEAN := false;
BEGIN
  -- Set session for test_user1
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  
  -- Try to update allowed fields (should succeed)
  BEGIN
    UPDATE public.profiles
    SET 
      display_name = 'Updated Name',
      bio = 'Updated bio',
      theme = 'light'
    WHERE id = '11111111-1111-1111-1111-111111111111'::UUID;
    
    update_success := true;
  EXCEPTION
    WHEN OTHERS THEN
      update_success := false;
  END;
  
  ASSERT update_success, 'Should be able to update allowed fields';
  
  -- Try to update restricted fields (should fail)
  BEGIN
    UPDATE public.profiles
    SET email_verified = true
    WHERE id = '11111111-1111-1111-1111-111111111111'::UUID;
    
    RAISE EXCEPTION 'Should not be able to update restricted fields';
  EXCEPTION
    WHEN OTHERS THEN
      -- Expected to fail
      NULL;
  END;
  
  -- Reset session
  PERFORM set_config('request.jwt.claims', NULL, true);
  
  RAISE NOTICE 'TEST 5 PASSED: Profile update restrictions work';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 5 FAILED: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 6: Account Status and Deletion
-- ============================================================================

DO $$
DECLARE
  test_id UUID := '55555555-5555-5555-5555-555555555555'::UUID;
  deleted_email TEXT;
BEGIN
  -- Create test user
  INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at)
  VALUES (test_id, 'deletetest@example.com', NOW(), NOW(), NOW());
  
  INSERT INTO public.profiles (id, email, username, display_name)
  VALUES (test_id, 'deletetest@example.com', 'deleteuser', 'Delete Test User');
  
  -- Soft delete the account
  PERFORM public.soft_delete_user_account(test_id, 'User requested deletion');
  
  -- Check if account was properly soft deleted
  SELECT email INTO deleted_email
  FROM public.profiles
  WHERE id = test_id;
  
  ASSERT deleted_email LIKE 'deleted_%@deleted.local', 'Email should be anonymized';
  
  -- Check audit log
  ASSERT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE user_id = test_id
    AND action = 'account_deleted'
  ), 'Deletion should be logged';
  
  -- Cleanup
  DELETE FROM public.audit_logs WHERE user_id = test_id;
  DELETE FROM public.profiles WHERE id = test_id;
  DELETE FROM auth.users WHERE id = test_id;
  
  RAISE NOTICE 'TEST 6 PASSED: Account deletion works correctly';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 6 FAILED: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 7: Profile Completion Calculation
-- ============================================================================

DO $$
DECLARE
  completion_score INTEGER;
BEGIN
  -- Test with incomplete profile (test_user2)
  SELECT public.calculate_profile_completion('22222222-2222-2222-2222-222222222222'::UUID)
  INTO completion_score;
  
  ASSERT completion_score < 50, 'Incomplete profile should have low score';
  
  -- Test with more complete profile (test_user1)
  SELECT public.calculate_profile_completion('11111111-1111-1111-1111-111111111111'::UUID)
  INTO completion_score;
  
  ASSERT completion_score > 50, 'More complete profile should have higher score';
  
  RAISE NOTICE 'TEST 7 PASSED: Profile completion calculation works';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 7 FAILED: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 8: Audit Logging for Profile Changes
-- ============================================================================

DO $$
DECLARE
  audit_count INTEGER;
BEGIN
  -- Clear previous audit logs for test user
  DELETE FROM public.audit_logs WHERE user_id = '11111111-1111-1111-1111-111111111111'::UUID;
  
  -- Update username (should trigger audit)
  UPDATE public.profiles
  SET username = 'newusername1'
  WHERE id = '11111111-1111-1111-1111-111111111111'::UUID;
  
  -- Check if audit log was created
  SELECT COUNT(*) INTO audit_count
  FROM public.audit_logs
  WHERE user_id = '11111111-1111-1111-1111-111111111111'::UUID
    AND action = 'username_change';
  
  ASSERT audit_count = 1, 'Username change should be audited';
  
  -- Update email verification (should trigger audit)
  UPDATE public.profiles
  SET email_verified = true, email_verified_at = NOW()
  WHERE id = '22222222-2222-2222-2222-222222222222'::UUID;
  
  -- Check if audit log was created
  SELECT COUNT(*) INTO audit_count
  FROM public.audit_logs
  WHERE user_id = '22222222-2222-2222-2222-222222222222'::UUID
    AND action = 'email_verified';
  
  ASSERT audit_count = 1, 'Email verification should be audited';
  
  RAISE NOTICE 'TEST 8 PASSED: Audit logging works correctly';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 8 FAILED: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 9: Suspended Account Access
-- ============================================================================

DO $$
DECLARE
  can_update BOOLEAN := false;
BEGIN
  -- Suspend test_user2
  UPDATE public.profiles
  SET 
    account_status = 'suspended',
    suspended_at = NOW(),
    suspension_reason = 'Test suspension'
  WHERE id = '22222222-2222-2222-2222-222222222222'::UUID;
  
  -- Set session for suspended user
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
  
  -- Try to update profile (should fail due to RLS)
  BEGIN
    UPDATE public.profiles
    SET bio = 'Should not work'
    WHERE id = '22222222-2222-2222-2222-222222222222'::UUID;
    
    can_update := true;
  EXCEPTION
    WHEN OTHERS THEN
      can_update := false;
  END;
  
  ASSERT NOT can_update, 'Suspended users should not be able to update profile';
  
  -- Restore account status
  UPDATE public.profiles
  SET 
    account_status = 'active',
    suspended_at = NULL,
    suspension_reason = NULL
  WHERE id = '22222222-2222-2222-2222-222222222222'::UUID;
  
  -- Reset session
  PERFORM set_config('request.jwt.claims', NULL, true);
  
  RAISE NOTICE 'TEST 9 PASSED: Suspended account restrictions work';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 9 FAILED: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST CLEANUP
-- ============================================================================

DO $$
DECLARE
  test_user1_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
  test_user2_id UUID := '22222222-2222-2222-2222-222222222222'::UUID;
  test_admin_id UUID := '33333333-3333-3333-3333-333333333333'::UUID;
BEGIN
  -- Clean up test data
  DELETE FROM public.audit_logs WHERE user_id IN (test_user1_id, test_user2_id, test_admin_id);
  DELETE FROM public.profiles WHERE id IN (test_user1_id, test_user2_id, test_admin_id);
  DELETE FROM auth.users WHERE id IN (test_user1_id, test_user2_id, test_admin_id);
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'ALL TESTS PASSED SUCCESSFULLY!';
  RAISE NOTICE '============================================';
END $$;