#!/usr/bin/env node

/**
 * Test script to verify TTS integration with OpenAI and ElevenLabs
 * Run with: node packages/audio-engine/test-tts.js
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

// Import the providers from the bundled output
const { OpenAIProvider, ElevenLabsProvider } = require('./dist/index.js');

async function testOpenAI() {
  console.log('\n🎯 Testing OpenAI TTS...');
  
  const provider = new OpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY
  });

  const result = await provider.synthesize({
    text: "Hello from MindScript! This is a test of the OpenAI text to speech system.",
    voice: "alloy",
    model: "tts-1",
    format: "mp3"
  });

  if (result.isOk) {
    console.log('✅ OpenAI TTS successful!');
    if (result.value && result.value.audio) {
      console.log('   Audio size:', result.value.audio.length, 'bytes');
      console.log('   Duration:', result.value.duration || 'N/A', 'seconds');
      
      // Save to file for testing
      const outputPath = path.join(__dirname, 'test-openai.mp3');
      fs.writeFileSync(outputPath, result.value.audio);
      console.log('   Saved to:', outputPath);
    } else {
      console.log('   No audio data received');
    }
  } else {
    console.error('❌ OpenAI TTS failed:', result.error.message);
  }
}

async function testElevenLabs() {
  console.log('\n🎯 Testing ElevenLabs TTS...');
  
  const provider = new ElevenLabsProvider({
    apiKey: process.env.ELEVENLABS_API_KEY
  });

  // Using a default voice ID - you can change this to any voice available on your account
  const result = await provider.synthesize({
    text: "Hello from MindScript! This is a test of the ElevenLabs text to speech system.",
    voice: "21m00Tcm4TlvDq8ikWAM", // Rachel voice (default)
    model: "eleven_monolingual_v1"
  });

  if (result.isOk) {
    console.log('✅ ElevenLabs TTS successful!');
    if (result.value.audio) {
      console.log('   Audio size:', result.value.audio.length, 'bytes');
      console.log('   Duration:', result.value.duration || 'N/A', 'seconds');
    
      // Save to file for testing
      const outputPath = path.join(__dirname, 'test-elevenlabs.mp3');
      fs.writeFileSync(outputPath, result.value.audio);
      console.log('   Saved to:', outputPath);
    } else {
      console.log('   No audio data received');
    }
  } else {
    console.error('❌ ElevenLabs TTS failed:', result.error.message);
  }
}

async function main() {
  console.log('🚀 MindScript TTS Integration Test');
  console.log('=====================================');
  
  // Check if API keys are configured
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your-openai-api-key')) {
    console.warn('⚠️  OpenAI API key not configured in .env.local');
  } else {
    await testOpenAI();
  }

  if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY.includes('your-elevenlabs-api-key')) {
    console.warn('⚠️  ElevenLabs API key not configured in .env.local');
  } else {
    await testElevenLabs();
  }

  console.log('\n✨ Test complete!');
}

// Run the test
main().catch(console.error);