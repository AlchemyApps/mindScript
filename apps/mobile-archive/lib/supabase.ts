import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
// import type { Database } from '@mindscript/types'; // TODO: Enable when types package is available
type Database = any;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Custom storage adapter that uses SecureStore for sensitive data
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    // Use SecureStore for auth tokens on native platforms
    if (Platform.OS !== 'web' && key.includes('auth-token')) {
      return await SecureStore.getItemAsync(key);
    }
    // Use AsyncStorage for other data
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    // Use SecureStore for auth tokens on native platforms
    if (Platform.OS !== 'web' && key.includes('auth-token')) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
  removeItem: async (key: string) => {
    // Use SecureStore for auth tokens on native platforms
    if (Platform.OS !== 'web' && key.includes('auth-token')) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});