-- Test Suite: Webhook Event Tracking with Idempotency
-- Description: Comprehensive tests for webhook event tracking system
-- Run this after applying the migration to verify functionality

-- ============================================================================
-- TEST SETUP
-- ============================================================================

BEGIN;

-- Create test user and admin for RLS testing
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'test-user@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'test-admin@example.com');

-- Create profiles with appropriate roles
INSERT INTO public.profiles (id, email, role, account_status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'test-user@example.com', 'user', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'test-admin@example.com', 'admin', 'active');

-- ============================================================================
-- TEST 1: Idempotency - Duplicate event_id from same source should fail
-- ============================================================================

DO $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Insert first event
  INSERT INTO public.webhook_events (
    event_id, source, event_type, payload
  ) VALUES (
    'evt_stripe_123', 'stripe', 'checkout.session.completed',
    '{"amount": 9999, "currency": "usd"}'::jsonb
  ) RETURNING id INTO v_event_id;

  -- Try to insert duplicate - should fail
  BEGIN
    INSERT INTO public.webhook_events (
      event_id, source, event_type, payload
    ) VALUES (
      'evt_stripe_123', 'stripe', 'checkout.session.completed',
      '{"amount": 9999, "currency": "usd"}'::jsonb
    );
    RAISE EXCEPTION 'Idempotency test failed: Duplicate event was allowed';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'Test 1 PASSED: Idempotency enforced - duplicate rejected';
  END;
END $$;

-- ============================================================================
-- TEST 2: Same event_id from different source should be allowed
-- ============================================================================

DO $$
BEGIN
  -- Insert event from RevenueCat with same event_id as Stripe
  INSERT INTO public.webhook_events (
    event_id, source, event_type, payload
  ) VALUES (
    'evt_stripe_123', 'revenuecat', 'subscription.renewed',
    '{"product_id": "premium_monthly"}'::jsonb
  );

  RAISE NOTICE 'Test 2 PASSED: Same event_id from different source allowed';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Test 2 FAILED: Could not insert same event_id from different source - %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 3: Processing status transitions
-- ============================================================================

DO $$
DECLARE
  v_event_id UUID;
  v_status webhook_status;
BEGIN
  -- Create a new event
  INSERT INTO public.webhook_events (
    event_id, source, event_type, payload, status
  ) VALUES (
    'evt_test_processing', 'stripe', 'payment_intent.succeeded',
    '{"amount": 5000}'::jsonb, 'pending'
  ) RETURNING id INTO v_event_id;

  -- Update to processing
  UPDATE public.webhook_events
  SET status = 'processing',
      processing_started_at = NOW()
  WHERE id = v_event_id;

  -- Update to completed
  UPDATE public.webhook_events
  SET status = 'completed',
      processed_at = NOW(),
      processing_duration_ms = 150
  WHERE id = v_event_id
  RETURNING status INTO v_status;

  IF v_status = 'completed' THEN
    RAISE NOTICE 'Test 3 PASSED: Status transitions work correctly';
  ELSE
    RAISE EXCEPTION 'Test 3 FAILED: Status not updated correctly';
  END IF;
END $$;

-- ============================================================================
-- TEST 4: Processing logs creation
-- ============================================================================

DO $$
DECLARE
  v_event_id UUID;
  v_log_count INTEGER;
BEGIN
  -- Create event
  INSERT INTO public.webhook_events (
    event_id, source, event_type, payload
  ) VALUES (
    'evt_test_logs', 'stripe', 'invoice.paid',
    '{"invoice_id": "inv_123"}'::jsonb
  ) RETURNING id INTO v_event_id;

  -- Create processing logs
  INSERT INTO public.webhook_processing_logs (
    webhook_event_id, action, action_status, started_at, completed_at,
    entities_affected
  ) VALUES
    (v_event_id, 'create_subscription', 'success', NOW(), NOW() + INTERVAL '100ms',
     '{"subscription_id": "sub_123", "user_id": "user_456"}'::jsonb),
    (v_event_id, 'send_confirmation_email', 'success', NOW(), NOW() + INTERVAL '50ms',
     '{"email": "user@example.com"}'::jsonb);

  -- Verify logs were created
  SELECT COUNT(*) INTO v_log_count
  FROM public.webhook_processing_logs
  WHERE webhook_event_id = v_event_id;

  IF v_log_count = 2 THEN
    RAISE NOTICE 'Test 4 PASSED: Processing logs created successfully';
  ELSE
    RAISE EXCEPTION 'Test 4 FAILED: Expected 2 logs, got %', v_log_count;
  END IF;
END $$;

-- ============================================================================
-- TEST 5: Retry mechanism and DLQ
-- ============================================================================

DO $$
DECLARE
  v_event_id UUID;
  v_in_dlq BOOLEAN;
BEGIN
  -- Create failed event with max retries
  INSERT INTO public.webhook_events (
    event_id, source, event_type, payload, status,
    retry_count, error_message, last_retry_at
  ) VALUES (
    'evt_test_dlq', 'revenuecat', 'subscription.failed',
    '{"reason": "payment_failed"}'::jsonb, 'failed',
    5, 'Payment processor timeout', NOW()
  ) RETURNING id INTO v_event_id;

  -- Move to DLQ
  PERFORM public.move_webhook_to_dlq(v_event_id);

  -- Check if in DLQ
  SELECT EXISTS (
    SELECT 1 FROM public.webhook_dlq
    WHERE webhook_event_id = v_event_id
  ) INTO v_in_dlq;

  IF v_in_dlq THEN
    RAISE NOTICE 'Test 5 PASSED: Failed event moved to DLQ after max retries';
  ELSE
    RAISE EXCEPTION 'Test 5 FAILED: Event not moved to DLQ';
  END IF;
END $$;

-- ============================================================================
-- TEST 6: RLS - Service role access
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Set role to service_role
  SET LOCAL ROLE service_role;

  -- Service role should be able to read all events
  SELECT COUNT(*) INTO v_count FROM public.webhook_events;

  -- Service role should be able to insert
  INSERT INTO public.webhook_events (
    event_id, source, event_type, payload
  ) VALUES (
    'evt_service_test', 'stripe', 'test.event',
    '{}'::jsonb
  );

  -- Service role should be able to update
  UPDATE public.webhook_events
  SET status = 'completed'
  WHERE event_id = 'evt_service_test';

  -- Service role should be able to delete
  DELETE FROM public.webhook_events
  WHERE event_id = 'evt_service_test';

  RESET ROLE;
  RAISE NOTICE 'Test 6 PASSED: Service role has full access';
EXCEPTION
  WHEN OTHERS THEN
    RESET ROLE;
    RAISE EXCEPTION 'Test 6 FAILED: Service role access error - %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 7: RLS - Admin read-only access
-- ============================================================================

DO $$
DECLARE
  v_count INTEGER;
  v_can_read BOOLEAN := false;
  v_can_write BOOLEAN := true;
BEGIN
  -- Set session to admin user
  SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222"}';
  SET LOCAL ROLE authenticated;

  -- Admin should be able to read events
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.webhook_events;
    v_can_read := true;
  EXCEPTION
    WHEN OTHERS THEN
      v_can_read := false;
  END;

  -- Admin should NOT be able to insert
  BEGIN
    INSERT INTO public.webhook_events (
      event_id, source, event_type, payload
    ) VALUES (
      'evt_admin_test', 'stripe', 'test.event',
      '{}'::jsonb
    );
    v_can_write := true;
  EXCEPTION
    WHEN OTHERS THEN
      v_can_write := false;
  END;

  RESET ROLE;
  RESET "request.jwt.claims";

  IF v_can_read AND NOT v_can_write THEN
    RAISE NOTICE 'Test 7 PASSED: Admin has read-only access';
  ELSE
    RAISE EXCEPTION 'Test 7 FAILED: Admin access incorrect - can_read: %, can_write: %',
      v_can_read, v_can_write;
  END IF;
END $$;

-- ============================================================================
-- TEST 8: RLS - Regular user no access
-- ============================================================================

DO $$
DECLARE
  v_can_read BOOLEAN := true;
BEGIN
  -- Set session to regular user
  SET LOCAL "request.jwt.claims" TO '{"sub": "11111111-1111-1111-1111-111111111111"}';
  SET LOCAL ROLE authenticated;

  -- Regular user should NOT be able to read events
  BEGIN
    PERFORM * FROM public.webhook_events LIMIT 1;
    v_can_read := true;
  EXCEPTION
    WHEN OTHERS THEN
      v_can_read := false;
  END;

  RESET ROLE;
  RESET "request.jwt.claims";

  IF NOT v_can_read THEN
    RAISE NOTICE 'Test 8 PASSED: Regular user has no access';
  ELSE
    RAISE EXCEPTION 'Test 8 FAILED: Regular user should not have access';
  END IF;
END $$;

-- ============================================================================
-- TEST 9: Helper function - is_webhook_processed
-- ============================================================================

DO $$
DECLARE
  v_is_processed BOOLEAN;
BEGIN
  -- Check existing event
  v_is_processed := public.is_webhook_processed('evt_stripe_123', 'stripe');
  IF NOT v_is_processed THEN
    RAISE EXCEPTION 'Test 9 FAILED: Should detect processed event';
  END IF;

  -- Check non-existing event
  v_is_processed := public.is_webhook_processed('evt_nonexistent', 'stripe');
  IF v_is_processed THEN
    RAISE EXCEPTION 'Test 9 FAILED: Should not detect non-existent event';
  END IF;

  RAISE NOTICE 'Test 9 PASSED: is_webhook_processed function works correctly';
END $$;

-- ============================================================================
-- TEST 10: Webhook signatures table
-- ============================================================================

DO $$
DECLARE
  v_sig_id UUID;
BEGIN
  -- Insert signature configuration
  INSERT INTO public.webhook_signatures (
    source, signing_secret, endpoint_url, header_name, algorithm
  ) VALUES (
    'stripe', 'whsec_test_secret_encrypted', 'https://api.example.com/webhooks/stripe',
    'Stripe-Signature', 'hmac-sha256'
  ) RETURNING id INTO v_sig_id;

  -- Try to insert duplicate source - should fail
  BEGIN
    INSERT INTO public.webhook_signatures (
      source, signing_secret, endpoint_url, header_name, algorithm
    ) VALUES (
      'stripe', 'another_secret', 'https://api.example.com/webhooks/stripe2',
      'Stripe-Signature', 'hmac-sha256'
    );
    RAISE EXCEPTION 'Test 10 FAILED: Duplicate source allowed in signatures';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE 'Test 10 PASSED: Webhook signatures unique by source';
  END;
END $$;

-- ============================================================================
-- TEST 11: Cleanup function
-- ============================================================================

DO $$
DECLARE
  v_deleted_count INTEGER;
  v_old_event_id UUID;
BEGIN
  -- Create an old event
  INSERT INTO public.webhook_events (
    event_id, source, event_type, payload, status,
    created_at
  ) VALUES (
    'evt_old_test', 'stripe', 'test.cleanup',
    '{}'::jsonb, 'completed',
    NOW() - INTERVAL '100 days'
  ) RETURNING id INTO v_old_event_id;

  -- Run cleanup
  v_deleted_count := public.cleanup_old_webhook_events(90);

  -- Verify old event was deleted
  IF NOT EXISTS (SELECT 1 FROM public.webhook_events WHERE id = v_old_event_id) THEN
    RAISE NOTICE 'Test 11 PASSED: Old events cleaned up successfully';
  ELSE
    RAISE EXCEPTION 'Test 11 FAILED: Old event not cleaned up';
  END IF;
END $$;

-- ============================================================================
-- TEST 12: Indexes performance check
-- ============================================================================

DO $$
DECLARE
  v_index_count INTEGER;
BEGIN
  -- Check that all expected indexes exist
  SELECT COUNT(*) INTO v_index_count
  FROM pg_indexes
  WHERE tablename = 'webhook_events'
    AND schemaname = 'public';

  IF v_index_count >= 6 THEN
    RAISE NOTICE 'Test 12 PASSED: All performance indexes created';
  ELSE
    RAISE EXCEPTION 'Test 12 FAILED: Expected at least 6 indexes, found %', v_index_count;
  END IF;
END $$;

-- ============================================================================
-- TEST 13: Verify updated_at triggers
-- ============================================================================

DO $$
DECLARE
  v_event_id UUID;
  v_original_updated TIMESTAMPTZ;
  v_new_updated TIMESTAMPTZ;
BEGIN
  -- Create event
  INSERT INTO public.webhook_events (
    event_id, source, event_type, payload
  ) VALUES (
    'evt_trigger_test', 'stripe', 'test.trigger',
    '{}'::jsonb
  ) RETURNING id, updated_at INTO v_event_id, v_original_updated;

  -- Wait a moment
  PERFORM pg_sleep(0.1);

  -- Update the event
  UPDATE public.webhook_events
  SET status = 'completed'
  WHERE id = v_event_id
  RETURNING updated_at INTO v_new_updated;

  IF v_new_updated > v_original_updated THEN
    RAISE NOTICE 'Test 13 PASSED: updated_at trigger works';
  ELSE
    RAISE EXCEPTION 'Test 13 FAILED: updated_at not updated';
  END IF;
END $$;

-- ============================================================================
-- TEST 14: Metrics view functionality
-- ============================================================================

DO $$
DECLARE
  v_metric_count INTEGER;
BEGIN
  -- Check metrics view
  SELECT COUNT(*) INTO v_metric_count
  FROM public.webhook_metrics;

  RAISE NOTICE 'Test 14 PASSED: Metrics view accessible with % records', v_metric_count;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Test 14 FAILED: Metrics view error - %', SQLERRM;
END $$;

-- ============================================================================
-- TEST 15: DLQ resolution workflow
-- ============================================================================

DO $$
DECLARE
  v_event_id UUID;
  v_dlq_id UUID;
  v_resolved BOOLEAN;
BEGIN
  -- Create failed event
  INSERT INTO public.webhook_events (
    event_id, source, event_type, payload, status, retry_count
  ) VALUES (
    'evt_dlq_resolution', 'revenuecat', 'test.dlq',
    '{}'::jsonb, 'failed', 5
  ) RETURNING id INTO v_event_id;

  -- Move to DLQ
  PERFORM public.move_webhook_to_dlq(v_event_id);

  -- Set role to admin for resolution
  SET LOCAL "request.jwt.claims" TO '{"sub": "22222222-2222-2222-2222-222222222222"}';
  SET LOCAL ROLE authenticated;

  -- Resolve the DLQ entry
  UPDATE public.webhook_dlq
  SET resolved = true,
      resolved_at = NOW(),
      resolved_by = '22222222-2222-2222-2222-222222222222'::UUID,
      resolution_notes = 'Test resolution'
  WHERE webhook_event_id = v_event_id
  RETURNING resolved INTO v_resolved;

  RESET ROLE;
  RESET "request.jwt.claims";

  IF v_resolved THEN
    RAISE NOTICE 'Test 15 PASSED: DLQ resolution workflow works';
  ELSE
    RAISE EXCEPTION 'Test 15 FAILED: Could not resolve DLQ entry';
  END IF;
END $$;

-- ============================================================================
-- TEST CLEANUP
-- ============================================================================

-- Clean up test data
DELETE FROM public.webhook_dlq WHERE webhook_event_id IN (
  SELECT id FROM public.webhook_events WHERE event_id LIKE 'evt_%test%'
);
DELETE FROM public.webhook_processing_logs WHERE webhook_event_id IN (
  SELECT id FROM public.webhook_events WHERE event_id LIKE 'evt_%test%'
);
DELETE FROM public.webhook_events WHERE event_id LIKE 'evt_%test%' OR event_id LIKE 'evt_stripe_123';
DELETE FROM public.webhook_signatures WHERE source IN ('stripe', 'revenuecat', 'resend');
DELETE FROM public.profiles WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- ============================================================================
-- TEST SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'WEBHOOK EVENT TRACKING TEST SUITE COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'All 15 tests passed successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Verified:';
  RAISE NOTICE '✓ Idempotency enforcement';
  RAISE NOTICE '✓ Status transitions';
  RAISE NOTICE '✓ Processing logs';
  RAISE NOTICE '✓ Retry and DLQ mechanisms';
  RAISE NOTICE '✓ RLS policies (service role, admin, user)';
  RAISE NOTICE '✓ Helper functions';
  RAISE NOTICE '✓ Signature management';
  RAISE NOTICE '✓ Cleanup operations';
  RAISE NOTICE '✓ Performance indexes';
  RAISE NOTICE '✓ Triggers and views';
  RAISE NOTICE '========================================';
END $$;

ROLLBACK;