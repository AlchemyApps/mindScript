#!/usr/bin/env node

/**
 * Seed Script for Initial Admin User
 *
 * This script creates the first admin user for the MindScript platform.
 * It should only be run once during initial setup or when no admin exists.
 *
 * Usage:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=securepassword node scripts/seed-admin.js
 *
 * Environment variables:
 *   - ADMIN_EMAIL: Email for the admin account (required)
 *   - ADMIN_PASSWORD: Password for the admin account (required)
 *   - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (from .env)
 *   - SUPABASE_SERVICE_ROLE_KEY: Service role key (from .env)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

// Validate required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Get admin credentials from environment or prompt
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(`❌ Missing admin credentials. Please provide:
    ADMIN_EMAIL=admin@example.com
    ADMIN_PASSWORD=securepassword

  Example:
    ADMIN_EMAIL=admin@mindscript.com ADMIN_PASSWORD=MySecureP@ssw0rd! node scripts/seed-admin.js`);
  process.exit(1);
}

// Validate password strength
if (ADMIN_PASSWORD.length < 8) {
  console.error('❌ Password must be at least 8 characters long');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function checkExistingAdmin() {
  console.log('🔍 Checking for existing admin users...');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role')
    .in('role', ['admin', 'super_admin']);

  if (error) {
    console.error('❌ Error checking for existing admins:', error.message);
    process.exit(1);
  }

  if (data && data.length > 0) {
    console.log('⚠️  Admin users already exist:');
    data.forEach(admin => {
      console.log(`   - ${admin.email} (${admin.role})`);
    });

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('\nDo you want to create another admin? (yes/no): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
          console.log('✅ Exiting without creating new admin.');
          process.exit(0);
        }
        resolve();
      });
    });
  }

  console.log('✅ No existing admin users found.');
}

async function createAdminUser() {
  console.log('🚀 Creating admin user...');

  try {
    // Step 1: Create the auth user
    console.log('  1️⃣  Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: 'System Administrator',
        role: 'super_admin'
      }
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('  ⚠️  Auth user already exists, updating profile...');

        // Get the existing user
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users?.find(u => u.email === ADMIN_EMAIL);

        if (existingUser) {
          // Update the existing profile to admin
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              role: 'super_admin',
              full_name: 'System Administrator',
              updated_at: new Date().toISOString()
            })
            .eq('id', existingUser.id);

          if (updateError) {
            console.error('❌ Error updating profile:', updateError.message);
            process.exit(1);
          }

          console.log('✅ Existing user promoted to super_admin successfully!');
          console.log('\n📧 Admin Email:', ADMIN_EMAIL);
          console.log('🔑 Use the password you provided to log in.');
          return;
        }
      }

      console.error('❌ Error creating auth user:', authError.message);
      process.exit(1);
    }

    console.log('  ✅ Auth user created:', authData.user.id);

    // Step 2: Update the profile with admin role
    console.log('  2️⃣  Updating profile with admin role...');
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'super_admin',
        full_name: 'System Administrator',
        email_verified: true,
        email_verified_at: new Date().toISOString(),
        account_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('❌ Error updating profile:', profileError.message);
      // Try to clean up the auth user
      await supabase.auth.admin.deleteUser(authData.user.id);
      process.exit(1);
    }

    console.log('  ✅ Profile updated with super_admin role');

    // Step 3: Log the admin action
    console.log('  3️⃣  Logging admin creation...');
    const { error: logError } = await supabase
      .from('admin_audit_logs')
      .insert({
        admin_id: authData.user.id,
        action: 'admin_created',
        target_type: 'user',
        target_id: authData.user.id,
        metadata: {
          email: ADMIN_EMAIL,
          created_by: 'seed_script',
          timestamp: new Date().toISOString()
        }
      });

    if (logError) {
      console.warn('  ⚠️  Warning: Could not create audit log:', logError.message);
    } else {
      console.log('  ✅ Audit log created');
    }

    console.log('\n✅ Admin user created successfully!');
    console.log('\n📧 Admin Email:', ADMIN_EMAIL);
    console.log('🔑 Admin Password: [hidden]');
    console.log('🌐 Admin Portal: http://localhost:3002/login');
    console.log('\n⚠️  Important: Please change the password after first login!');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

async function main() {
  console.log('🏗️  MindScript Admin Setup Script');
  console.log('==================================\n');

  await checkExistingAdmin();
  await createAdminUser();

  console.log('\n✅ Setup complete!');
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});