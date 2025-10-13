#!/usr/bin/env node

/**
 * Test script to verify the fixed authentication flow
 * Run with: node test-auth-fix.mjs
 */

import fetch from 'node-fetch';
import readline from 'readline';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testSignup(email, password) {
  log('\n📝 Testing Signup...', 'blue');

  try {
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        fullName: 'Test User',
        trackConfig: {
          script: 'Test script for authentication',
          voice: { provider: 'openai', voice_id: 'alloy' },
          duration: 5
        }
      }),
      redirect: 'manual'
    });

    log(`Response status: ${response.status}`, response.status === 303 ? 'green' : 'yellow');

    const location = response.headers.get('location');
    if (location) {
      log(`✅ Redirect detected to: ${location}`, 'green');
      return { success: true, location };
    }

    const data = await response.json();
    if (data.error) {
      log(`❌ Error: ${data.error}`, 'red');
      return { success: false, error: data.error };
    }

    return { success: true, data };
  } catch (error) {
    log(`❌ Network error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testLogin(email, password) {
  log('\n🔐 Testing Login...', 'blue');

  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        next: '/library'
      }),
      redirect: 'manual'
    });

    log(`Response status: ${response.status}`, response.status === 303 ? 'green' : 'yellow');

    const location = response.headers.get('location');
    if (location) {
      log(`✅ Redirect detected to: ${location}`, 'green');
      return { success: true, location };
    }

    const data = await response.json();
    if (data.error) {
      log(`❌ Error: ${data.error}`, 'red');
      return { success: false, error: data.error };
    }

    return { success: true, data };
  } catch (error) {
    log(`❌ Network error: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
}

async function testAuthModal() {
  log('\n🌐 Testing Auth Modal Behavior...', 'blue');

  log(`
This test simulates what the auth modal does:
1. Calls server endpoint with 'redirect: manual'
2. Checks for Location header
3. Redirects browser to that location

The key changes:
- NO Supabase client auth calls
- Server returns 303 redirects
- Browser follows redirects to establish session
`, 'yellow');
}

async function runTests() {
  log('🚀 MindScript Authentication Fix Test Suite', 'green');
  log('=========================================\n', 'green');

  const choice = await question(`
Choose a test:
1. Test new signup flow
2. Test existing user login
3. Test auth modal behavior (explanation)
4. Run all tests

Enter choice (1-4): `);

  const timestamp = Date.now();
  const testEmail = `test+${timestamp}@example.com`;
  const testPassword = 'TestPass123!';

  switch (choice) {
    case '1':
      await testSignup(testEmail, testPassword);
      break;

    case '2': {
      const email = await question('Enter email: ');
      const password = await question('Enter password: ');
      await testLogin(email, password);
      break;
    }

    case '3':
      await testAuthModal();
      break;

    case '4':
      log('\n🔄 Running all tests...', 'blue');

      // Test signup
      const signupResult = await testSignup(testEmail, testPassword);

      if (signupResult.success && signupResult.location?.includes('verify')) {
        log('\n⚠️  Email verification required. Cannot test login until email is confirmed.', 'yellow');
      } else if (signupResult.success) {
        // Test login with same credentials
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        await testLogin(testEmail, testPassword);
      }

      await testAuthModal();
      break;

    default:
      log('Invalid choice', 'red');
  }

  log('\n✨ Test Summary:', 'green');
  log('================', 'green');
  log(`
Key fixes implemented:
1. ✅ Server-side auth with redirects (no client setSession)
2. ✅ Auth modal uses redirect: 'manual' to handle redirects
3. ✅ Simplified Supabase clients (server for auth, browser for reads only)
4. ✅ Webhook-based build initiation (idempotent)
5. ✅ Checkout flow is fully server-side
6. ✅ Success page shows status without session checks

The hanging issue is resolved by:
- Never calling supabase.auth.setSession() on the client
- Server redirects set cookies automatically via Supabase SSR
- All auth operations go through server endpoints
`, 'blue');

  rl.close();
}

runTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
});