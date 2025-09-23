import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export interface TestUser {
  id: string;
  email: string;
  password: string;
  profile?: {
    display_name: string;
    bio?: string;
  };
}

export interface TestTrack {
  id: string;
  title: string;
  description: string;
  script: string;
  user_id: string;
  status: 'draft' | 'published';
  price_cents?: number;
  audio_url?: string;
}

export interface TestMarketplaceListing {
  id: string;
  track_id: string;
  seller_id: string;
  price_cents: number;
  status: 'active' | 'pending' | 'suspended';
}

export class TestDataSeeder {
  // Create test user with profile
  async createTestUser(userData: Partial<TestUser> = {}): Promise<TestUser> {
    const timestamp = Date.now();
    const defaultData = {
      email: `test.user.${timestamp}@example.com`,
      password: 'TestPassword123!',
      profile: {
        display_name: `Test User ${timestamp}`,
        bio: 'Test user for E2E testing',
      },
    };

    const user = { ...defaultData, ...userData };

    // Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    if (authError) throw authError;

    // Update profile
    if (user.profile) {
      await supabase
        .from('profiles')
        .update({
          display_name: user.profile.display_name,
          bio: user.profile.bio,
        })
        .eq('id', authUser.user.id);
    }

    return {
      id: authUser.user.id,
      email: user.email,
      password: user.password,
      profile: user.profile,
    };
  }

  // Create test track
  async createTestTrack(userId: string, trackData: Partial<TestTrack> = {}): Promise<TestTrack> {
    const timestamp = Date.now();
    const defaultData = {
      title: `Test Track ${timestamp}`,
      description: 'A test meditation track',
      script: 'Welcome to this test meditation. Take a deep breath and relax.',
      status: 'published' as const,
      price_cents: 299,
      voice_config: {
        provider: 'openai',
        voice_id: 'alloy',
      },
      output_config: {
        format: 'mp3',
        quality: 'medium',
      },
      is_public: true,
      tags: ['test', 'meditation'],
    };

    const track = { ...defaultData, ...trackData, user_id: userId };

    const { data, error } = await supabase
      .from('tracks')
      .insert(track)
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  // Create marketplace listing
  async createMarketplaceListing(
    trackId: string,
    sellerId: string,
    price: number = 299
  ): Promise<TestMarketplaceListing> {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .insert({
        track_id: trackId,
        seller_id: sellerId,
        price_cents: price,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  // Create completed audio job
  async createCompletedAudioJob(trackId: string, userId: string) {
    const audioUrl = `https://storage.test/audio/${trackId}/rendered.mp3`;

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('audio_job_queue')
      .insert({
        track_id: trackId,
        user_id: userId,
        status: 'completed',
        progress: 100,
        stage: 'Complete',
        job_data: {
          script: 'Test script',
          voice: { provider: 'openai', voice_id: 'alloy' },
          output: { format: 'mp3', quality: 'medium' },
        },
        result: {
          url: audioUrl,
          duration: 180,
          size: 2048000,
          format: 'mp3',
        },
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Update track with audio URL
    await supabase
      .from('tracks')
      .update({
        audio_url: audioUrl,
        duration: 180,
        status: 'published',
      })
      .eq('id', trackId);

    return job;
  }

  // Grant track access (simulate purchase)
  async grantTrackAccess(userId: string, trackId: string) {
    const { data, error } = await supabase
      .from('track_access')
      .insert({
        user_id: userId,
        track_id: trackId,
        access_type: 'purchased',
        granted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  // Create seller account
  async createSellerAccount(userId: string) {
    const { data, error } = await supabase
      .from('seller_accounts')
      .insert({
        profile_id: userId,
        status: 'active',
        onboarding_complete: true,
        accepted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  // Clean up test data
  async cleanup(userId?: string) {
    if (userId) {
      // Delete user's tracks
      await supabase.from('tracks').delete().eq('user_id', userId);

      // Delete user's marketplace listings
      await supabase.from('marketplace_listings').delete().eq('seller_id', userId);

      // Delete user's track access
      await supabase.from('track_access').delete().eq('user_id', userId);

      // Delete user's audio jobs
      await supabase.from('audio_job_queue').delete().eq('user_id', userId);

      // Delete seller account
      await supabase.from('seller_accounts').delete().eq('profile_id', userId);

      // Delete user
      await supabase.auth.admin.deleteUser(userId);
    }
  }

  // Seed complete marketplace scenario
  async seedMarketplaceScenario() {
    // Create seller
    const seller = await this.createTestUser({
      email: 'test.seller@example.com',
      profile: {
        display_name: 'Test Seller',
        bio: 'I create amazing meditation tracks',
      },
    });

    await this.createSellerAccount(seller.id);

    // Create tracks for sale
    const track1 = await this.createTestTrack(seller.id, {
      title: 'Morning Meditation',
      description: 'Start your day with peace',
      price_cents: 499,
    });

    const track2 = await this.createTestTrack(seller.id, {
      title: 'Sleep Soundly',
      description: 'Drift off to peaceful sleep',
      price_cents: 699,
    });

    // Create completed audio jobs
    await this.createCompletedAudioJob(track1.id, seller.id);
    await this.createCompletedAudioJob(track2.id, seller.id);

    // Create marketplace listings
    await this.createMarketplaceListing(track1.id, seller.id, 499);
    await this.createMarketplaceListing(track2.id, seller.id, 699);

    // Create buyer
    const buyer = await this.createTestUser({
      email: 'test.buyer@example.com',
      profile: {
        display_name: 'Test Buyer',
      },
    });

    return {
      seller,
      buyer,
      tracks: [track1, track2],
    };
  }

  // Seed library scenario
  async seedLibraryScenario() {
    const user = await this.createTestUser({
      email: 'test.library.user@example.com',
      profile: {
        display_name: 'Library User',
      },
    });

    // Create owned tracks
    const ownedTrack1 = await this.createTestTrack(user.id, {
      title: 'My First Track',
      status: 'published',
    });

    const ownedTrack2 = await this.createTestTrack(user.id, {
      title: 'Work in Progress',
      status: 'draft',
    });

    await this.createCompletedAudioJob(ownedTrack1.id, user.id);

    // Create another user's track for purchase simulation
    const otherUser = await this.createTestUser();
    const purchasedTrack = await this.createTestTrack(otherUser.id, {
      title: 'Purchased Meditation',
      status: 'published',
    });

    await this.createCompletedAudioJob(purchasedTrack.id, otherUser.id);
    await this.grantTrackAccess(user.id, purchasedTrack.id);

    return {
      user,
      ownedTracks: [ownedTrack1, ownedTrack2],
      purchasedTracks: [purchasedTrack],
    };
  }
}

// Export singleton instance
export const testDataSeeder = new TestDataSeeder();