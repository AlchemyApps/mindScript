# MindScript Mobile App Setup Guide

## Overview
The MindScript mobile application is built with React Native/Expo and provides a native experience for iOS and Android users with offline-first capabilities and audio playback.

## Prerequisites
- Node.js 18+ and npm 9+
- Expo CLI (`npm install -g expo-cli`)
- iOS: Xcode 14+ (for iOS development)
- Android: Android Studio (for Android development)
- Expo Go app on your device (for testing)

## Installation

1. **Install dependencies:**
   ```bash
   cd apps/mobile
   npm install
   ```

2. **Configure environment variables:**
   Create a `.env.local` file:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   EXPO_PUBLIC_API_URL=your_api_url
   ```

3. **Install iOS pods (macOS only):**
   ```bash
   cd ios && pod install
   ```

## Development

### Running the app

**Start the development server:**
```bash
npm start
```

**Run on iOS Simulator:**
```bash
npm run ios
```

**Run on Android Emulator:**
```bash
npm run android
```

**Run on physical device:**
- Install Expo Go from App Store/Play Store
- Scan the QR code shown in terminal

## Architecture

### Core Technologies
- **Expo SDK 51**: Development framework
- **React Native 0.74.3**: UI framework
- **React Native Track Player 4.0**: Audio playback engine
- **Zustand 5.0**: State management
- **React Query 5.0**: Data fetching & caching
- **Expo Secure Store**: Secure token storage
- **AsyncStorage**: General data persistence

### Key Features

#### 1. Authentication
- Supabase Auth integration
- Secure token storage with Expo Secure Store
- Persistent session management
- Auto-refresh tokens

#### 2. Audio Playback
- Background playback support
- Queue management with shuffle/repeat
- Sleep timer with fade-out
- Playback rate control
- Volume adjustment
- Offline caching

#### 3. Offline-First Architecture
- LRU cache with size limits
- Network-aware data fetching
- Audio file caching for offline playback
- Stale-while-revalidate strategy

#### 4. Navigation Structure
```
├── (tabs)/
│   ├── library.tsx    # Track library with search
│   ├── builder.tsx    # Track creation interface
│   └── profile.tsx    # User settings & account
```

### State Management

#### Auth Store (`stores/authStore.ts`)
- User authentication state
- Session management
- Token refresh logic

#### Player Store (`stores/playerStore.ts`)
- Audio playback state
- Queue management
- Sleep timer control
- Playback preferences

### Services

#### Cache Service (`services/cacheService.ts`)
- LRU eviction strategy
- 100MB cache limit
- Audio/image file caching
- Network status monitoring

#### Playback Service (`services/PlaybackService.ts`)
- Background audio capability
- Media session integration
- Remote control handling
- Queue persistence

## Building for Production

### iOS Build
```bash
# Create production build
expo build:ios --release-channel production

# Or use EAS Build
eas build --platform ios --profile production
```

### Android Build
```bash
# Create production build
expo build:android --release-channel production

# Or use EAS Build
eas build --platform android --profile production
```

### Configuration Files

**app.json** key configurations:
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["audio"]
      }
    },
    "android": {
      "permissions": ["android.permission.FOREGROUND_SERVICE"]
    }
  }
}
```

## Testing

### Unit Tests
```bash
npm test
```

### Coverage Report
```bash
npm test -- --coverage
```

### E2E Testing (Detox)
```bash
# Build for testing
detox build --configuration ios.sim.debug

# Run tests
detox test --configuration ios.sim.debug
```

## Performance Optimization

1. **Audio Caching**: Tracks are cached locally after first play
2. **Image Optimization**: Artwork cached and resized appropriately
3. **Lazy Loading**: Screens and heavy components loaded on demand
4. **Memory Management**: Proper cleanup of audio resources
5. **Network Efficiency**: Batch requests and smart prefetching

## Troubleshooting

### Common Issues

**Build fails with "Module not found"**
- Clear cache: `expo start --clear`
- Reinstall: `rm -rf node_modules && npm install`

**Audio playback stops in background**
- Verify background modes in app.json
- Check iOS Info.plist for UIBackgroundModes
- Ensure Android foreground service permission

**Authentication issues**
- Verify Supabase credentials in .env
- Check network connectivity
- Clear AsyncStorage: `AsyncStorage.clear()`

**Performance issues**
- Enable Hermes: `expo.android.jsEngine: "hermes"`
- Profile with React DevTools
- Monitor with Flipper

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Push notifications setup
- [ ] App icons and splash screens
- [ ] Code signing certificates (iOS)
- [ ] Keystore configuration (Android)
- [ ] Privacy policy and terms
- [ ] App Store/Play Store metadata
- [ ] Sentry error tracking configured
- [ ] Analytics integration
- [ ] Production API endpoints

## Resources

- [Expo Documentation](https://docs.expo.dev)
- [React Native Track Player](https://react-native-track-player.js.org)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Supabase React Native Guide](https://supabase.com/docs/guides/with-react-native)