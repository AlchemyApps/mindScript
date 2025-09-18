import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { audioService } from '../lib/audio-service';
import { backgroundAudioService } from '../services/backgroundAudioService';
import { carPlayService } from '../services/carPlayService';
import { Platform } from 'react-native';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize audio services
    if (Platform.OS !== 'web') {
      const initializeAudioServices = async () => {
        try {
          // Initialize background audio service first
          await backgroundAudioService.initialize();

          // Then initialize the main audio service
          await audioService.initialize();

          // Initialize CarPlay/Android Auto service
          await carPlayService.initialize();

          console.log('All audio services initialized successfully');
        } catch (error) {
          console.error('Failed to initialize audio services:', error);
        }
      };

      initializeAudioServices();
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();

      // Cleanup audio services
      if (Platform.OS !== 'web') {
        backgroundAudioService.destroy().catch(console.error);
        carPlayService.destroy();
      }
    };
  }, []);

  if (isLoading) {
    // TODO: Add loading screen
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
            presentation: 'modal'
          }}
        />
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false
          }}
        />
        <Stack.Screen
          name="index"
          options={{
            headerShown: false
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}