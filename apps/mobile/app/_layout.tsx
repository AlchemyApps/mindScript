import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../stores/authStore';
import { backgroundAudioService } from '../services/backgroundAudio';
import { carPlayService } from '../services/carPlayService';
import { usePlaybackAnalytics } from '../hooks/usePlaybackAnalytics';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function AppBootstrap() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
    backgroundAudioService.initialize().catch(console.error);

    if (Platform.OS === 'ios') {
      carPlayService.initialize().catch(console.error);
    }
  }, [initialize]);

  usePlaybackAnalytics();

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AppBootstrap />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
