#!/usr/bin/env node

/**
 * Test script to verify authentication flow is working correctly
 * Tests redirect loop fixes and auth timeout handling
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

const tests = [
  {
    name: 'Test 1: Builder page should not cause infinite redirects',
    url: `${BASE_URL}/builder`,
    expectedStatus: [200, 307, 302], // Either loads or redirects to login
    description: 'Builder page should either load or redirect to login ONCE'
  },
  {
    name: 'Test 2: Dashboard page should not cause infinite redirects',
    url: `${BASE_URL}/dashboard`,
    expectedStatus: [200, 307, 302],
    description: 'Dashboard should either load or redirect to login ONCE'
  },
  {
    name: 'Test 3: Library page should handle auth correctly',
    url: `${BASE_URL}/library`,
    expectedStatus: [200],
    description: 'Library is public and should always load'
  },
  {
    name: 'Test 4: Test auth page should load correctly',
    url: `${BASE_URL}/test-auth`,
    expectedStatus: [200],
    description: 'Test auth page should load and show auth status'
  },
  {
    name: 'Test 5: API pricing check should work',
    url: `${BASE_URL}/api/pricing/check-eligibility`,
    expectedStatus: [200],
    description: 'Pricing API should return pricing info'
  },
  {
    name: 'Test 6: Deprecated audio submit should return 410',
    url: `${BASE_URL}/api/audio/submit`,
    method: 'POST',
    expectedStatus: [410],
    description: 'Old audio submit endpoint should be deprecated'
  }
];

async function runTest(test) {
  console.log(`\n🧪 ${test.name}`);
  console.log(`   ${test.description}`);

  try {
    const options = {
      method: test.method || 'GET',
      redirect: 'manual', // Don't follow redirects automatically
      headers: {
        'User-Agent': 'MindScript-Test-Script',
      }
    };

    if (test.method === 'POST') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify({});
    }

    const response = await fetch(test.url, options);
    const status = response.status;

    if (test.expectedStatus.includes(status)) {
      console.log(`   ✅ PASSED: Got expected status ${status}`);

      // Check for redirect loops
      if (status === 307 || status === 302) {
        const location = response.headers.get('location');
        console.log(`   ↪️  Redirects to: ${location}`);

        // Follow one redirect to ensure it doesn't loop back
        if (location && !location.includes('stripe.com')) {
          const fullUrl = location.startsWith('http') ? location : `${BASE_URL}${location}`;
          const secondResponse = await fetch(fullUrl, { ...options, redirect: 'manual' });
          const secondLocation = secondResponse.headers.get('location');

          if (secondLocation && secondLocation.includes(test.url.replace(BASE_URL, ''))) {
            console.log(`   ❌ REDIRECT LOOP DETECTED: ${test.url} → ${location} → ${secondLocation}`);
            return false;
          }
        }
      }

      return true;
    } else {
      console.log(`   ❌ FAILED: Expected ${test.expectedStatus.join(' or ')}, got ${status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting MindScript Authentication Flow Tests\n');
  console.log(`Testing against: ${BASE_URL}`);
  console.log('═'.repeat(60));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await runTest(test);
    if (result) {
      passed++;
    } else {
      failed++;
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Test Results Summary:');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📈 Success Rate: ${Math.round((passed / tests.length) * 100)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Authentication flow is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Review the output above for details.');
  }

  process.exit(failed === 0 ? 0 : 1);
}

// Check if server is running
fetch(BASE_URL)
  .then(() => runAllTests())
  .catch(() => {
    console.error(`❌ Could not connect to ${BASE_URL}`);
    console.error('   Please ensure the development server is running: npm run dev');
    process.exit(1);
  });