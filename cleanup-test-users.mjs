import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, 'apps/web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

console.log('Connecting to Supabase...');
console.log('URL:', supabaseUrl);

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanupTestUsers() {
  try {
    console.log('\n🧹 Starting test user cleanup...\n');

    // List of test email patterns to clean up
    const testEmailPatterns = [
      '%test%',
      '%demo%',
      '%example.com%',
      '%temp%',
      '%mindscript-test%'
    ];

    // Get all test users
    console.log('Finding test users...');
    const { data: testUsers, error: listError } = await supabase
      .from('profiles')
      .select('id, email, display_name, created_at')
      .or(testEmailPatterns.map(p => `email.ilike.${p}`).join(','));

    if (listError) {
      console.error('Error listing test users:', listError);
      return;
    }

    if (!testUsers || testUsers.length === 0) {
      console.log('No test users found.');
      return;
    }

    console.log(`Found ${testUsers.length} test users:`);
    testUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.display_name || 'No name'}) - Created: ${new Date(user.created_at).toLocaleDateString()}`);
    });

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will permanently delete these users and all their data!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\nProceeding with cleanup...\n');

    // Delete each test user
    for (const user of testUsers) {
      console.log(`Deleting user: ${user.email}...`);

      try {
        // Delete user's tracks
        const { error: tracksError } = await supabase
          .from('tracks')
          .delete()
          .eq('user_id', user.id);

        if (tracksError) {
          console.error(`  Error deleting tracks:`, tracksError.message);
        }

        // Delete user's purchases
        const { error: purchasesError } = await supabase
          .from('purchases')
          .delete()
          .eq('user_id', user.id);

        if (purchasesError) {
          console.error(`  Error deleting purchases:`, purchasesError.message);
        }

        // Delete user's track_access
        const { error: accessError } = await supabase
          .from('track_access')
          .delete()
          .eq('user_id', user.id);

        if (accessError) {
          console.error(`  Error deleting track access:`, accessError.message);
        }

        // Delete from auth.users (this will cascade to profiles)
        const { error: authError } = await supabase.auth.admin.deleteUser(user.id);

        if (authError) {
          console.error(`  Error deleting auth user:`, authError.message);
        } else {
          console.log(`  ✅ Successfully deleted ${user.email}`);
        }
      } catch (err) {
        console.error(`  Failed to delete ${user.email}:`, err);
      }
    }

    console.log('\n✅ Cleanup complete!\n');

    // Show remaining users count
    const { count } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true });

    console.log(`Total remaining users: ${count}`);

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

// Add function to clear browser storage
function showBrowserCleanupInstructions() {
  console.log('\n📝 Browser Cleanup Instructions:\n');
  console.log('To clear browser storage and sessions:');
  console.log('1. Open Chrome DevTools (F12)');
  console.log('2. Go to Application tab');
  console.log('3. Clear Storage section:');
  console.log('   - Click "Clear site data" button');
  console.log('   OR manually clear:');
  console.log('   - Local Storage');
  console.log('   - Session Storage');
  console.log('   - Cookies');
  console.log('   - IndexedDB');
  console.log('\nAlternatively, use Incognito/Private mode for testing.\n');
}

// Run cleanup
cleanupTestUsers().then(() => {
  showBrowserCleanupInstructions();
});