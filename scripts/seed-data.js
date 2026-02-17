#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Affirmation templates for realistic data
const AFFIRMATION_TEMPLATES = [
  "I am worthy of {positive_quality} and {achievement}",
  "Every day I grow more {positive_trait} and {positive_trait}",
  "I attract {good_thing} into my life with ease",
  "I am grateful for my {blessing} and {blessing}",
  "I choose to focus on {positive_focus} today",
  "My {aspect} is filled with {positive_quality}",
  "I release {negative_thing} and embrace {positive_thing}",
  "I am confident in my ability to {achievement}",
  "I deserve {good_thing} and {good_thing}",
  "I am becoming the {ideal_self} I want to be"
];

const POSITIVE_QUALITIES = ['love', 'success', 'happiness', 'peace', 'abundance', 'joy', 'prosperity', 'health', 'wisdom', 'strength'];
const POSITIVE_TRAITS = ['confident', 'capable', 'resilient', 'creative', 'focused', 'determined', 'compassionate', 'mindful', 'grateful', 'powerful'];
const GOOD_THINGS = ['opportunities', 'positive relationships', 'financial abundance', 'perfect health', 'creative solutions', 'inner peace'];
const BLESSINGS = ['health', 'family', 'abilities', 'experiences', 'growth', 'journey', 'potential', 'unique gifts'];
const POSITIVE_FOCUS = ['gratitude', 'solutions', 'growth', 'possibilities', 'love', 'progress', 'learning'];
const ASPECTS = ['life', 'mind', 'heart', 'journey', 'future', 'present moment'];
const NEGATIVE_THINGS = ['fear', 'doubt', 'worry', 'anxiety', 'limiting beliefs', 'negative thoughts'];
const POSITIVE_THINGS = ['confidence', 'trust', 'peace', 'calm', 'empowering beliefs', 'positive energy'];
const ACHIEVEMENTS = ['achieve my goals', 'overcome challenges', 'create success', 'manifest my dreams', 'reach my potential'];
const IDEAL_SELF = ['best version of myself', 'successful person', 'confident leader', 'peaceful soul', 'abundant being'];

function generateAffirmation() {
  const template = faker.helpers.arrayElement(AFFIRMATION_TEMPLATES);
  return template
    .replace(/{positive_quality}/g, () => faker.helpers.arrayElement(POSITIVE_QUALITIES))
    .replace(/{positive_trait}/g, () => faker.helpers.arrayElement(POSITIVE_TRAITS))
    .replace(/{good_thing}/g, () => faker.helpers.arrayElement(GOOD_THINGS))
    .replace(/{blessing}/g, () => faker.helpers.arrayElement(BLESSINGS))
    .replace(/{positive_focus}/g, () => faker.helpers.arrayElement(POSITIVE_FOCUS))
    .replace(/{aspect}/g, () => faker.helpers.arrayElement(ASPECTS))
    .replace(/{negative_thing}/g, () => faker.helpers.arrayElement(NEGATIVE_THINGS))
    .replace(/{positive_thing}/g, () => faker.helpers.arrayElement(POSITIVE_THINGS))
    .replace(/{achievement}/g, () => faker.helpers.arrayElement(ACHIEVEMENTS))
    .replace(/{ideal_self}/g, () => faker.helpers.arrayElement(IDEAL_SELF));
}

function generateScript() {
  const affirmations = Array.from({ length: faker.number.int({ min: 3, max: 7 }) }, generateAffirmation);
  return affirmations.join('. ') + '.';
}

async function seedDatabase(supabase, isDev = true) {
  console.log(`\n🌱 Seeding ${isDev ? 'DEV' : 'PROD'} database...`);

  try {
    // Create test users
    const testUsers = [];
    const userEmails = [
      'test@mindscript.app',
      'premium@mindscript.app',
      'basic@mindscript.app'
    ];

    for (const email of userEmails) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: 'TestPassword123!',
        email_confirm: true
      });

      if (authError) {
        console.log(`⚠️  User ${email} might already exist: ${authError.message}`);
        // Try to get existing user
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existingUser = users?.find(u => u.email === email);
        if (existingUser) {
          testUsers.push(existingUser);
        }
      } else if (authData?.user) {
        testUsers.push(authData.user);
      }
    }

    // Create profiles for users
    for (let i = 0; i < testUsers.length; i++) {
      const user = testUsers[i];
      const tier = i === 0 ? 'free' : i === 1 ? 'premium' : 'basic';
      
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          username: user.email.split('@')[0],
          full_name: faker.person.fullName(),
          subscription_tier: tier,
          is_premium: tier !== 'free',
          credits_remaining: tier === 'free' ? 5 : tier === 'basic' ? 50 : 999,
          subscription_expires_at: tier !== 'free' 
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() 
            : null,
          settings: {
            theme: 'light',
            notifications: true,
            autoplay: false
          }
        });

      if (profileError) {
        console.log(`⚠️  Profile error for ${user.email}: ${profileError.message}`);
      } else {
        console.log(`✅ Created profile for ${user.email} (${tier})`);
      }

      // Create scripts for each user
      const scriptCount = tier === 'free' ? 2 : tier === 'basic' ? 5 : 10;
      
      for (let j = 0; j < scriptCount; j++) {
        const isPublic = faker.datatype.boolean(0.3); // 30% chance of being public
        const isTemplate = isPublic && faker.datatype.boolean(0.5); // 50% of public are templates
        
        const { data: scriptData, error: scriptError } = await supabase
          .from('scripts')
          .insert({
            owner_id: user.id,
            title: faker.helpers.arrayElement([
              'Morning Motivation',
              'Evening Gratitude',
              'Success Mindset',
              'Confidence Booster',
              'Stress Relief',
              'Sleep Affirmations',
              'Wealth Manifestation',
              'Health & Wellness',
              'Self Love Journey',
              'Focus & Productivity'
            ]) + (isTemplate ? ' Template' : ''),
            content: generateScript(),
            tags: faker.helpers.arrayElements(
              ['motivation', 'gratitude', 'success', 'confidence', 'health', 'wealth', 'love', 'peace', 'focus', 'sleep'],
              { min: 2, max: 4 }
            ),
            is_template: isTemplate,
            is_public: isPublic,
            view_count: isPublic ? faker.number.int({ min: 0, max: 1000 }) : 0
          })
          .select()
          .single();

        if (scriptError) {
          console.log(`⚠️  Script error: ${scriptError.message}`);
        } else if (scriptData) {
          // Create audio project for some scripts
          if (faker.datatype.boolean(0.6)) { // 60% chance
            const { error: projectError } = await supabase
              .from('audio_projects')
              .insert({
                owner_id: user.id,
                script_id: scriptData.id,
                title: scriptData.title + ' Audio',
                voice_ref: faker.helpers.arrayElement(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']),
                duration_min: faker.helpers.arrayElement([5, 10, 15]),
                pause_sec: faker.number.int({ min: 2, max: 10 }),
                loop_mode: faker.helpers.arrayElement(['repeat', 'interval']),
                interval_sec: faker.number.int({ min: 30, max: 120 }),
                layers_json: {
                  background_music: faker.helpers.arrayElement(['calm', 'nature', 'ambient', 'meditation', null]),
                  binaural_frequency: faker.helpers.arrayElement([null, 528, 432, 639, 741]),
                  volume_music: 0.3,
                  volume_voice: 0.8
                }
              });

            if (projectError) {
              console.log(`⚠️  Audio project error: ${projectError.message}`);
            }
          }
        }
      }
    }

    // Create some public templates from system
    const systemTemplates = [
      {
        title: 'Daily Gratitude Practice',
        content: 'I am grateful for this new day. I appreciate all the blessings in my life. I choose to focus on abundance. I am thankful for my health and wellbeing. Every day brings new opportunities for growth.',
        tags: ['gratitude', 'daily', 'mindfulness']
      },
      {
        title: 'Confidence Builder',
        content: 'I am confident and capable. I trust in my abilities. I handle challenges with grace and strength. I believe in myself completely. My confidence grows stronger every day.',
        tags: ['confidence', 'self-esteem', 'empowerment']
      },
      {
        title: 'Abundance Mindset',
        content: 'I am a magnet for abundance. Prosperity flows to me easily. I deserve success and wealth. Money comes to me from expected and unexpected sources. I am grateful for my abundant life.',
        tags: ['abundance', 'wealth', 'prosperity', 'manifestation']
      }
    ];

    // Use the first user as system user for templates
    if (testUsers.length > 0) {
      for (const template of systemTemplates) {
        const { error } = await supabase
          .from('scripts')
          .insert({
            owner_id: testUsers[0].id,
            ...template,
            is_template: true,
            is_public: true,
            view_count: faker.number.int({ min: 500, max: 5000 })
          });

        if (error) {
          console.log(`⚠️  Template error: ${error.message}`);
        } else {
          console.log(`✅ Created template: ${template.title}`);
        }
      }
    }

    console.log('\n✅ Seeding completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 MindScript Database Seeder');
  console.log('=============================\n');

  // Check environment
  const args = process.argv.slice(2);
  const targetEnv = args[0] || 'dev';
  
  if (!['dev', 'prod', 'both'].includes(targetEnv)) {
    console.error('❌ Invalid environment. Use: dev, prod, or both');
    process.exit(1);
  }

  // Only seed DEV by default for safety
  if (targetEnv === 'prod' || targetEnv === 'both') {
    console.log('⚠️  WARNING: Seeding production database!');
    console.log('This should only be done for initial setup.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Seed DEV
  if (targetEnv === 'dev' || targetEnv === 'both') {
    const supabaseDev = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://byicqjniboevzbhbfxui.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    await seedDatabase(supabaseDev, true);
  }

  // Seed PROD (be very careful!)
  if (targetEnv === 'prod' || targetEnv === 'both') {
    const supabaseProd = createClient(
      process.env.SUPABASE_PROD_URL || 'https://tjuvcfiefebtanqlfalk.supabase.co',
      process.env.SUPABASE_PROD_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    await seedDatabase(supabaseProd, false);
  }

  console.log('\n🎉 All done!');
  console.log('\nTest accounts created:');
  console.log('- test@mindscript.app (free tier)');
  console.log('- basic@mindscript.app (basic tier)');
  console.log('- premium@mindscript.app (premium tier)');
  console.log('Password for all: TestPassword123!');
}

// Run seeder
main().catch(console.error);