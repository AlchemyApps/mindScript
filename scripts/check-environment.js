#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const REQUIRED_ENV_VARS = {
  // Supabase DEV
  'NEXT_PUBLIC_SUPABASE_URL': 'Supabase DEV URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': 'Supabase DEV Anon Key',
  'SUPABASE_SERVICE_ROLE_KEY': 'Supabase DEV Service Role Key',
  
  // Supabase PROD
  'SUPABASE_PROD_URL': 'Supabase PROD URL',
  'SUPABASE_PROD_ANON_KEY': 'Supabase PROD Anon Key',
  'SUPABASE_PROD_SERVICE_ROLE_KEY': 'Supabase PROD Service Role Key',
  
  // Stripe
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY': 'Stripe Publishable Key',
  'STRIPE_SECRET_KEY': 'Stripe Secret Key',
  'STRIPE_WEBHOOK_SECRET': 'Stripe Webhook Secret',
  
  // External Services
  'ELEVENLABS_API_KEY': 'ElevenLabs API Key',
  'OPENAI_API_KEY': 'OpenAI API Key',
  'RESEND_API_KEY': 'Resend API Key'
};

const REQUIRED_TABLES = [
  'profiles',
  'scripts',
  'audio_projects',
  'renders',
  'payments',
  'webhook_events',
  'api_keys',
  'audit_logs'
];

const REQUIRED_BUCKETS = [
  'avatars',
  'audio-uploads',
  'audio-renders'
];

const OPTIONAL_BUCKETS = [
  'background-music',
  'thumbnails',
  'published',
  'previews'
];

async function checkEnvVar(name, description) {
  const value = process.env[name];
  if (!value) {
    console.log(chalk.red('❌'), chalk.gray(description), chalk.red('MISSING'));
    return false;
  }
  
  // Mask sensitive values
  const masked = value.substring(0, 10) + '...' + value.substring(value.length - 4);
  console.log(chalk.green('✅'), chalk.gray(description), chalk.dim(masked));
  return true;
}

async function checkSupabaseConnection(url, serviceKey, envName) {
  console.log(chalk.blue(`\n📡 Testing ${envName} Supabase connection...`));
  
  try {
    const supabase = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Test connection
    const { data: versionData, error: versionError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (versionError && versionError.message.includes('relation "public.profiles" does not exist')) {
      console.log(chalk.yellow('⚠️  Tables not found - migrations may not be applied'));
      return { connected: true, tablesExist: false };
    } else if (versionError) {
      console.log(chalk.red('❌ Connection failed:'), versionError.message);
      return { connected: false, tablesExist: false };
    }

    console.log(chalk.green('✅ Connected successfully'));

    // Check tables
    console.log(chalk.blue('\n📊 Checking tables...'));
    let tablesFound = 0;
    
    for (const table of REQUIRED_TABLES) {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (!error) {
        console.log(chalk.green('  ✅'), table);
        tablesFound++;
      } else if (error.message.includes('does not exist')) {
        console.log(chalk.red('  ❌'), table, chalk.dim('(not found)'));
      } else {
        console.log(chalk.yellow('  ⚠️'), table, chalk.dim(`(${error.message})`));
      }
    }

    // Check storage buckets
    console.log(chalk.blue('\n📦 Checking storage buckets...'));
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.log(chalk.yellow('⚠️  Could not list buckets:'), bucketsError.message);
    } else if (buckets) {
      const bucketNames = buckets.map(b => b.name);
      
      for (const bucket of REQUIRED_BUCKETS) {
        if (bucketNames.includes(bucket)) {
          console.log(chalk.green('  ✅'), bucket, chalk.dim('(required)'));
        } else {
          console.log(chalk.red('  ❌'), bucket, chalk.dim('(required, missing)'));
        }
      }
      
      for (const bucket of OPTIONAL_BUCKETS) {
        if (bucketNames.includes(bucket)) {
          console.log(chalk.green('  ✅'), bucket, chalk.dim('(optional)'));
        } else {
          console.log(chalk.yellow('  ⚠️'), bucket, chalk.dim('(optional, not found)'));
        }
      }
    }

    return {
      connected: true,
      tablesExist: tablesFound === REQUIRED_TABLES.length,
      tablesFound,
      totalTables: REQUIRED_TABLES.length
    };
  } catch (error) {
    console.log(chalk.red('❌ Connection error:'), error.message);
    return { connected: false, tablesExist: false };
  }
}

async function checkExternalServices() {
  console.log(chalk.blue('\n🔌 Checking external services...'));
  
  // Check Stripe
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const response = await fetch('https://api.stripe.com/v1/charges?limit=1', {
        headers: {
          'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
        }
      });
      
      if (response.ok) {
        console.log(chalk.green('✅ Stripe API'), chalk.dim('(connected)'));
      } else {
        console.log(chalk.yellow('⚠️  Stripe API'), chalk.dim(`(${response.status})`));
      }
    } catch (error) {
      console.log(chalk.red('❌ Stripe API'), chalk.dim('(connection failed)'));
    }
  }

  // Check OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      });
      
      if (response.ok) {
        console.log(chalk.green('✅ OpenAI API'), chalk.dim('(connected)'));
      } else {
        console.log(chalk.yellow('⚠️  OpenAI API'), chalk.dim(`(${response.status})`));
      }
    } catch (error) {
      console.log(chalk.red('❌ OpenAI API'), chalk.dim('(connection failed)'));
    }
  }

  // Check ElevenLabs
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/user', {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY
        }
      });
      
      if (response.ok) {
        console.log(chalk.green('✅ ElevenLabs API'), chalk.dim('(connected)'));
      } else {
        console.log(chalk.yellow('⚠️  ElevenLabs API'), chalk.dim(`(${response.status})`));
      }
    } catch (error) {
      console.log(chalk.red('❌ ElevenLabs API'), chalk.dim('(connection failed)'));
    }
  }
}

async function main() {
  console.log(chalk.bold.cyan('\n🔍 MindScript Environment Health Check'));
  console.log(chalk.cyan('=' .repeat(50)));

  // Check environment variables
  console.log(chalk.blue('\n🔐 Checking environment variables...'));
  let envVarsOk = true;
  
  for (const [name, description] of Object.entries(REQUIRED_ENV_VARS)) {
    const isOk = await checkEnvVar(name, description);
    if (!isOk) envVarsOk = false;
  }

  if (!envVarsOk) {
    console.log(chalk.yellow('\n⚠️  Some environment variables are missing.'));
    console.log(chalk.yellow('Copy .env.example to .env.local and fill in the values.'));
  }

  // Check Supabase connections
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const devResult = await checkSupabaseConnection(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      'DEV'
    );
    
    if (!devResult.tablesExist && devResult.connected) {
      console.log(chalk.yellow('\n⚠️  DEV database needs migrations applied.'));
      console.log(chalk.yellow('See docs/ENVIRONMENT_SETUP.md for instructions.'));
    }
  }

  if (process.env.SUPABASE_PROD_URL && process.env.SUPABASE_PROD_SERVICE_ROLE_KEY) {
    const prodResult = await checkSupabaseConnection(
      process.env.SUPABASE_PROD_URL,
      process.env.SUPABASE_PROD_SERVICE_ROLE_KEY,
      'PROD'
    );
    
    if (!prodResult.tablesExist && prodResult.connected) {
      console.log(chalk.yellow('\n⚠️  PROD database needs migrations applied.'));
      console.log(chalk.yellow('See docs/ENVIRONMENT_SETUP.md for instructions.'));
    }
  }

  // Check external services
  await checkExternalServices();

  // Summary
  console.log(chalk.cyan('\n' + '='.repeat(50)));
  console.log(chalk.bold.cyan('Summary:'));
  
  if (envVarsOk) {
    console.log(chalk.green('✅ All environment variables configured'));
  } else {
    console.log(chalk.red('❌ Some environment variables missing'));
  }

  console.log(chalk.cyan('\nNext steps:'));
  console.log('1. Apply migrations if needed (see docs/ENVIRONMENT_SETUP.md)');
  console.log('2. Run seed script: npm run seed');
  console.log('3. Start development: npm run dev');
  console.log('4. Check the app at http://localhost:3000');
}

// Run health check
main().catch(console.error);