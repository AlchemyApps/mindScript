#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function executeSQLViaAPI(projectRef, serviceKey, sql, environment) {
  const url = `https://${projectRef}.supabase.co/rest/v1/rpc/exec_sql`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    return { success: true };
  } catch (error) {
    console.error(`Failed to execute SQL in ${environment}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function applyMigrationDirectly(projectRef, serviceKey, environment) {
  console.log(`\n📦 Applying migrations to ${environment} environment (${projectRef})...`);

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20240101000000_initial_security_setup.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

    // For now, let's try to execute the entire migration as one
    // If that fails, we'll need to split it
    console.log('Executing migration SQL...');
    
    // First, let's test the connection
    const testResult = await executeSQLViaAPI(projectRef, serviceKey, 'SELECT version()', environment);
    
    if (!testResult.success) {
      console.log('Connection test failed, trying alternative approach...');
      
      // Alternative: Use the Supabase Management API
      const mgmtUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
      
      const response = await fetch(mgmtUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          query: migrationSQL
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Management API error: ${error}`);
        return false;
      }

      console.log(`✅ Migration applied via Management API to ${environment}!`);
      return true;
    }

    // If test succeeded, apply the full migration
    const result = await executeSQLViaAPI(projectRef, serviceKey, migrationSQL, environment);
    
    if (result.success) {
      console.log(`✅ Migration applied to ${environment}!`);
      return true;
    } else {
      console.error(`❌ Failed to apply migration to ${environment}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error applying migration to ${environment}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 MindScript Database Migration Tool (API Version)');
  console.log('==================================================\n');

  // Check required environment variables
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_PROD_SERVICE_ROLE_KEY) {
    console.error('❌ Missing service role keys in .env.local');
    console.error('Required: SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PROD_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.error('❌ Missing SUPABASE_ACCESS_TOKEN in .env.local');
    process.exit(1);
  }

  // Extract project refs from URLs
  const devProjectRef = 'byicqjniboevzbhbfxui';
  const prodProjectRef = 'uykxlvsqbfnfhrgcpnvn';

  // Apply to DEV
  const devSuccess = await applyMigrationDirectly(
    devProjectRef,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    'DEV'
  );

  // Apply to PROD
  const prodSuccess = await applyMigrationDirectly(
    prodProjectRef,
    process.env.SUPABASE_PROD_SERVICE_ROLE_KEY,
    'PROD'
  );

  if (devSuccess && prodSuccess) {
    console.log('\n🎉 All migrations applied successfully!');
    process.exit(0);
  } else {
    console.log('\n⚠️ Some migrations may have failed. Please check Supabase dashboard.');
    
    // Provide dashboard links
    console.log('\nCheck your databases at:');
    console.log(`DEV:  https://supabase.com/dashboard/project/${devProjectRef}/editor`);
    console.log(`PROD: https://supabase.com/dashboard/project/${prodProjectRef}/editor`);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error);