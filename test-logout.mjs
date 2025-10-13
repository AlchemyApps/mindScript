import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

async function testLogout() {
  console.log('Testing logout endpoint...\n');

  try {
    console.log('1. Calling /api/auth/logout...');
    const response = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      console.log('\n✅ Logout endpoint working correctly!');
    } else {
      console.log('\n⚠️ Logout endpoint returned unexpected response');
    }

  } catch (error) {
    console.error('\n❌ Error testing logout:', error.message);
    console.log('\nMake sure the server is running on port 3001:');
    console.log('  cd apps/web && npm run dev');
  }
}

console.log('='.repeat(50));
console.log('LOGOUT ENDPOINT TEST');
console.log('='.repeat(50));
console.log('');

testLogout();