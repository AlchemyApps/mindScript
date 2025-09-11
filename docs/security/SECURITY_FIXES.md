# MindScript Security Implementation Guide

## Immediate Actions Required (Critical - 24 Hours)

### 1. Rotate All Credentials

```bash
# Generate new secure keys
openssl rand -hex 32  # For SESSION_SECRET, CSRF_SECRET, ENCRYPTION_KEY
openssl rand -hex 64  # For JWT_SIGNING_KEY

# Update in Vercel Dashboard
# Navigate to: Project Settings > Environment Variables
# Add/Update each secret with new values
```

### 2. Implement Authentication Middleware

The middleware has been created at `/apps/web/src/middleware.ts`. To activate:

```bash
# Install required dependencies
cd apps/web
npm install jsonwebtoken iron-session
```

### 3. Apply Database Migrations

```bash
# Run the security migration
npx supabase migration up

# Verify RLS policies are active
npx supabase db inspect
```

### 4. Update Environment Files

Replace `.env` and `.env.local` with `.env.vault` template:

```bash
# Remove exposed files
rm .env .env.local

# Use the secure template
cp .env.vault .env.example

# For local development only
cp .env.vault .env.local
# Then add your actual development values to .env.local
```

## Security Configurations by Component

### Next.js Web Application

#### 1. Secure API Route Handler Template

Create `/apps/web/src/app/api/secure-handler.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { verifyStripeWebhook, createAuditLog } from '@mindscript/auth/security';

// Input validation schema
const RequestSchema = z.object({
  // Define your request structure
});

export async function POST(req: NextRequest) {
  try {
    // 1. Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Initialize Supabase client with user context
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // 3. Verify user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // 4. Parse and validate input
    const body = await req.json();
    const validatedData = RequestSchema.parse(body);

    // 5. Perform business logic with RLS protection
    const { data, error } = await supabase
      .from('your_table')
      .insert({ ...validatedData, user_id: user.id });

    if (error) {
      throw error;
    }

    // 6. Audit log
    await createAuditLog({
      timestamp: new Date(),
      userId: user.id,
      action: 'CREATE',
      resource: 'your_table',
      success: true,
      ip: req.ip,
      userAgent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ data });
  } catch (error) {
    // Safe error handling
    console.error('API Error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

#### 2. Webhook Handler with Signature Verification

Create `/apps/web/src/app/api/webhooks/stripe/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyStripeWebhook } from '@mindscript/auth/security';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // 1. Get raw body and signature
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // 2. Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    if (!verifyStripeWebhook(body, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 3. Parse event
    const event = JSON.parse(body);

    // 4. Check idempotency
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role for webhook processing
      { auth: { persistSession: false } }
    );

    const { data: existing } = await supabase
      .from('webhook_events')
      .select('id')
      .eq('provider', 'stripe')
      .eq('event_id', event.id)
      .single();

    if (existing) {
      return NextResponse.json({ message: 'Event already processed' });
    }

    // 5. Store event for idempotency
    await supabase.from('webhook_events').insert({
      provider: 'stripe',
      event_id: event.id,
      event_type: event.type,
      payload: event,
      signature: signature,
      processed: false,
    });

    // 6. Process event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      // Add more event handlers
    }

    // 7. Mark as processed
    await supabase
      .from('webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('event_id', event.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: any) {
  // Implementation
}

async function handlePaymentSuccess(paymentIntent: any) {
  // Implementation
}
```

### Supabase Edge Functions Security

Create `/supabase/functions/secure-function/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // 1. CORS handling
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    // 2. Verify authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // 4. Verify user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 5. Parse and validate input
    const { data } = await req.json();
    
    // 6. Perform secure operation
    // Your business logic here

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
```

### Package Installation Commands

```bash
# Root level
npm install --save-dev @types/jsonwebtoken

# Web app dependencies
cd apps/web
npm install jsonwebtoken iron-session @supabase/ssr bcryptjs
npm install --save-dev @types/bcryptjs

# Create auth package
cd packages
mkdir auth
cd auth
npm init -y
npm install zod jsonwebtoken bcryptjs
npm install --save-dev @types/node @types/jsonwebtoken @types/bcryptjs
```

### Git Hooks for Security

Create `/.githooks/pre-commit`:

```bash
#!/bin/bash

# Check for exposed secrets
echo "Checking for exposed secrets..."

# Patterns to check
PATTERNS=(
  "sk_live_"
  "sk_test_"
  "whsec_"
  "service_role"
  "SUPABASE_SERVICE_ROLE_KEY"
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
)

for pattern in "${PATTERNS[@]}"; do
  if git diff --cached --name-only | xargs grep -l "$pattern" 2>/dev/null; then
    echo "ERROR: Potential secret detected: $pattern"
    echo "Please remove sensitive data before committing."
    exit 1
  fi
done

echo "No secrets detected."

# Run tests
npm test
```

Make it executable:
```bash
chmod +x .githooks/pre-commit
git config core.hooksPath .githooks
```

## Testing Security Implementation

### 1. RLS Policy Tests

Create `/supabase/tests/rls.test.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { describe, it, expect } from 'vitest';

describe('RLS Policies', () => {
  const anonClient = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  it('should prevent unauthorized access to profiles', async () => {
    const { data, error } = await anonClient
      .from('profiles')
      .select('*');
    
    expect(error).toBeDefined();
    expect(data).toBeNull();
  });

  it('should allow users to read their own profile', async () => {
    // Sign in as test user
    const { data: { user } } = await anonClient.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'testpassword',
    });

    const { data, error } = await anonClient
      .from('profiles')
      .select('*')
      .eq('id', user!.id)
      .single();
    
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });
});
```

### 2. Security Headers Test

Create `/apps/web/src/middleware.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { middleware } from './middleware';
import { NextRequest } from 'next/server';

describe('Security Middleware', () => {
  it('should add security headers', async () => {
    const request = new NextRequest('http://localhost:3000/');
    const response = await middleware(request);
    
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
  });

  it('should rate limit API requests', async () => {
    const request = new NextRequest('http://localhost:3000/api/test');
    
    // Make multiple requests
    for (let i = 0; i < 100; i++) {
      await middleware(request);
    }
    
    // Next request should be rate limited
    const response = await middleware(request);
    expect(response.status).toBe(429);
  });
});
```

## Monitoring & Alerting Setup

### Sentry Configuration

Create `/apps/web/src/lib/monitoring.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

export function initMonitoring() {
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.VERCEL_ENV || 'development',
      tracesSampleRate: 0.1,
      profilesSampleRate: 0.1,
      integrations: [
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      beforeSend(event, hint) {
        // Scrub sensitive data
        if (event.request) {
          delete event.request.cookies;
          delete event.request.headers?.authorization;
        }
        return event;
      },
    });
  }
}

export function captureSecurityEvent(
  eventType: string,
  details: Record<string, any>
) {
  Sentry.captureMessage(`Security Event: ${eventType}`, {
    level: 'warning',
    extra: details,
    tags: {
      security: true,
      event_type: eventType,
    },
  });
}
```

## Deployment Checklist

### Pre-Production Security Checklist

- [ ] All environment variables moved to Vercel Dashboard
- [ ] Service role keys removed from codebase
- [ ] RLS policies applied and tested
- [ ] Security headers middleware active
- [ ] Rate limiting configured
- [ ] Webhook signature verification implemented
- [ ] Input validation on all API routes
- [ ] HTTPS enforced (automatic on Vercel)
- [ ] Audit logging enabled
- [ ] Error monitoring configured (Sentry)
- [ ] Security.txt file accessible at /.well-known/security.txt
- [ ] Git hooks preventing secret commits
- [ ] Dependencies updated to latest secure versions
- [ ] Penetration testing scheduled

### Post-Deployment Verification

```bash
# Test security headers
curl -I https://mindscript.app

# Verify RLS policies
npx supabase db inspect

# Check for exposed endpoints
npm run security:scan

# Verify SSL configuration
nmap --script ssl-enum-ciphers -p 443 mindscript.app
```

## Ongoing Security Maintenance

### Weekly Tasks
- Review audit logs for anomalies
- Check for new dependency vulnerabilities
- Monitor rate limit effectiveness

### Monthly Tasks
- Rotate API keys
- Review and update RLS policies
- Security metrics review

### Quarterly Tasks
- Rotate all credentials
- Penetration testing
- Security training for team

## Support & Resources

- Security Issues: security@mindscript.app
- Documentation: /docs/security/
- Bug Bounty: (Consider HackerOne or Bugcrowd)
- Security Updates: Subscribe to security newsletter

## Conclusion

Following this implementation guide will bring MindScript to a production-ready security posture. The critical items must be completed within 24 hours, with remaining items completed within the first week. Regular security audits and monitoring will ensure ongoing protection.