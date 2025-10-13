// EMERGENCY LOGOUT SCRIPT
// If logout is stuck, paste this in browser console:

(function emergencyLogout() {
  console.log('🚨 Running emergency logout...');

  // 1. Clear all localStorage
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`  Removed localStorage: ${key}`);
    });
  } catch (e) {
    console.error('Failed to clear localStorage:', e);
  }

  // 2. Clear all sessionStorage
  try {
    sessionStorage.clear();
    console.log('  Cleared sessionStorage');
  } catch (e) {
    console.error('Failed to clear sessionStorage:', e);
  }

  // 3. Clear all cookies
  try {
    document.cookie.split(";").forEach(function(c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    console.log('  Cleared cookies');
  } catch (e) {
    console.error('Failed to clear cookies:', e);
  }

  // 4. Call logout endpoint
  fetch('/api/auth/logout', {
    method: 'POST'
  }).then(() => {
    console.log('  Called logout endpoint');
  }).catch(e => {
    console.log('  Logout endpoint failed (non-critical):', e.message);
  });

  // 5. Force redirect to home
  setTimeout(() => {
    console.log('✅ Emergency logout complete - redirecting to home...');
    window.location.href = '/';
  }, 1000);

  console.log('\nIf this doesn\'t work, try:');
  console.log('1. Open incognito/private window');
  console.log('2. Clear browser data manually (Settings > Privacy > Clear browsing data)');
  console.log('3. Try a different browser');
})();