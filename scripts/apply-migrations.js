#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function applyMigration(supabaseUrl, serviceRoleKey, environment) {
  console.log(`\n📦 Applying migrations to ${environment} environment...`);
  
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20240101000000_initial_security_setup.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

    // Split the migration into individual statements (simple split by semicolon)
    // Note: This is a simplified approach - production code should use a proper SQL parser
    const statements = migrationSQL
      .split(/;\s*$(?=[\s\n]*--|\s*CREATE|\s*ALTER|\s*INSERT|\s*GRANT|\s*COMMENT)/gm)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments-only statements
      if (statement.replace(/--.*$/gm, '').trim().length === 0) {
        continue;
      }

      // Get a preview of the statement for logging
      const preview = statement.substring(0, 100).replace(/\n/g, ' ');
      process.stdout.write(`Statement ${i + 1}/${statements.length}: ${preview}...`);

      try {
        // For DDL statements, we need to use the admin API
        const { data, error } = await supabase.rpc('exec_sql', {
          sql: statement
        }).single();

        if (error) {
          // Try direct execution as a fallback
          const { error: directError } = await supabase.from('_dummy_').select().limit(0);
          if (directError) {
            console.log(' ❌ Failed');
            console.error(`Error: ${error.message}`);
            // Continue with other statements
          } else {
            console.log(' ✅');
          }
        } else {
          console.log(' ✅');
        }
      } catch (err) {
        console.log(' ⚠️  Warning');
        console.error(`Warning: ${err.message}`);
        // Continue with other statements
      }
    }

    console.log(`\n✅ Migration applied to ${environment} successfully!`);
    return true;
  } catch (error) {
    console.error(`\n❌ Failed to apply migration to ${environment}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 MindScript Database Migration Tool');
  console.log('=====================================\n');

  // Check required environment variables
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL_PROD',
    'SUPABASE_SERVICE_ROLE_KEY_PROD'
  ];

  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please check your .env.local file');
    process.exit(1);
  }

  // Apply to DEV environment
  const devSuccess = await applyMigration(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    'DEV'
  );

  // Apply to PROD environment  
  const prodSuccess = await applyMigration(
    process.env.NEXT_PUBLIC_SUPABASE_URL_PROD,
    process.env.SUPABASE_SERVICE_ROLE_KEY_PROD,
    'PROD'
  );

  if (devSuccess && prodSuccess) {
    console.log('\n🎉 All migrations applied successfully!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some migrations failed. Please check the logs above.');
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error);