import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
  RepeatMode,
  State,
  Track,
} from 'react-native-track-player';
import { Platform } from 'react-native';
import { usePlayerStore } from '../stores/playerStore';

export interface BackgroundAudioConfig {
  capabilities?: Capability[];
  compactCapabilities?: Capability[];
  notificationCapabilities?: Capability[];
  progressUpdateEventInterval?: number;
  iosCategoryOptions?: IOSCategoryOptions[];
}

class BackgroundAudioService {
  private initialized = false;
  private setupPromise: Promise<void> | null = null;

  /**
   * Initialize the background audio service with enhanced capabilities
   */
  async initialize(config?: BackgroundAudioConfig): Promise<void> {
    if (this.initialized) {
      console.log('BackgroundAudioService already initialized');
      return;
    }

    if (this.setupPromise) {
      // Return existing setup promise if initialization is in progress
      return this.setupPromise;
    }

    this.setupPromise = this.performInitialization(config);

    try {
      await this.setupPromise;
      this.initialized = true;
    } catch (error) {
      this.setupPromise = null;
      throw error;
    }
  }

  private async performInitialization(config?: BackgroundAudioConfig): Promise<void> {
    try {
      // Setup the player
      await TrackPlayer.setupPlayer({
        maxCacheSize: 50 * 1024 * 1024, // 50 MB cache
        waitForBuffer: true,
        autoUpdateMetadata: true,
      });

      // Configure background behavior
      await this.configureBackgroundBehavior();

      // Setup capabilities for lock screen and notification controls
      await this.setupCapabilities(config);

      // Setup audio session for iOS
      if (Platform.OS === 'ios') {
        await this.setupIOSAudioSession();
      }

      // Setup Android-specific configurations
      if (Platform.OS === 'android') {
        await this.setupAndroidAudioService();
      }

      console.log('BackgroundAudioService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BackgroundAudioService:', error);
      throw error;
    }
  }

  /**
   * Configure how the app behaves when killed
   */
  private async configureBackgroundBehavior(): Promise<void> {
    await TrackPlayer.updateOptions({
      android: {
        // Continue playback when app is killed
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        // Use foreground service for better reliability
        alwaysPauseOnInterruption: false,
        // Notification style
        notificationStyle: 'compact',
      },
      // Progress update interval (for progress bar)
      progressUpdateEventInterval: 1,
      // Stop with app termination on iOS (Apple requirement)
      stopWithApp: Platform.OS === 'ios',
      // Allow background audio
      playThroughEarpieceAndroid: false,
    });
  }

  /**
   * Setup player capabilities for lock screen and notification controls
   */
  private async setupCapabilities(config?: BackgroundAudioConfig): Promise<void> {
    const defaultCapabilities = [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
      Capability.Stop,
      Capability.JumpForward,
      Capability.JumpBackward,
    ];

    const defaultCompactCapabilities = [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
    ];

    const defaultNotificationCapabilities = [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
      Capability.JumpForward,
      Capability.JumpBackward,
    ];

    await TrackPlayer.updateOptions({
      capabilities: config?.capabilities || defaultCapabilities,
      compactCapabilities: config?.compactCapabilities || defaultCompactCapabilities,
      notificationCapabilities: config?.notificationCapabilities || defaultNotificationCapabilities,
      progressUpdateEventInterval: config?.progressUpdateEventInterval || 1,
      jumpInterval: 10, // Jump 10 seconds forward/backward
    });
  }

  /**
   * iOS-specific audio session configuration
   */
  private async setupIOSAudioSession(): Promise<void> {
    await TrackPlayer.updateOptions({
      iosCategory: IOSCategory.Playback,
      iosCategoryMode: IOSCategoryMode.SpokenAudio,
      iosCategoryOptions: [
        IOSCategoryOptions.AllowBluetooth,
        IOSCategoryOptions.AllowBluetoothA2DP,
        IOSCategoryOptions.AllowAirPlay,
        IOSCategoryOptions.InterruptSpokenAudioAndMixWithOthers,
      ],
    });
  }

  /**
   * Android-specific audio service configuration
   */
  private async setupAndroidAudioService(): Promise<void> {
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        alwaysPauseOnInterruption: false,
        notificationStyle: 'compact',
      },
    });
  }

  /**
   * Handle audio focus changes (for Android primarily)
   */
  async handleAudioFocus(hasFocus: boolean, canDuck: boolean): Promise<void> {
    if (!hasFocus) {
      if (canDuck) {
        // Lower volume when another app needs audio
        const currentVolume = await TrackPlayer.getVolume();
        await TrackPlayer.setVolume(currentVolume * 0.3);
      } else {
        // Pause when we completely lose audio focus
        const state = await TrackPlayer.getPlaybackState();
        if (state.state === State.Playing) {
          await TrackPlayer.pause();
        }
      }
    } else {
      // Restore volume when we regain focus
      await TrackPlayer.setVolume(1.0);

      // Optionally resume playback if we were playing before
      const store = usePlayerStore.getState();
      if (store.isPlaying) {
        await TrackPlayer.play();
      }
    }
  }

  /**
   * Handle interruptions (phone calls, alarms, etc.)
   */
  async handleInterruption(type: 'begin' | 'end'): Promise<void> {
    if (type === 'begin') {
      const state = await TrackPlayer.getPlaybackState();

      // Store the current playing state
      const wasPlaying = state.state === State.Playing;

      if (wasPlaying) {
        await TrackPlayer.pause();
        // Store that we should resume after interruption
        await this.storeInterruptionState(true);
      }
    } else {
      // Check if we should resume
      const shouldResume = await this.getInterruptionState();

      if (shouldResume) {
        await TrackPlayer.play();
        await this.clearInterruptionState();
      }
    }
  }

  /**
   * Store interruption state for resumption
   */
  private async storeInterruptionState(wasPlaying: boolean): Promise<void> {
    // This would integrate with AsyncStorage or your state management
    // For now, using a simple in-memory flag
    (global as any).__wasPlayingBeforeInterruption = wasPlaying;
  }

  /**
   * Get interruption state
   */
  private async getInterruptionState(): Promise<boolean> {
    return (global as any).__wasPlayingBeforeInterruption || false;
  }

  /**
   * Clear interruption state
   */
  private async clearInterruptionState(): Promise<void> {
    (global as any).__wasPlayingBeforeInterruption = false;
  }

  /**
   * Handle headphone/bluetooth connection changes
   */
  async handleRouteChange(outputDevice: string): Promise<void> {
    console.log('Audio route changed to:', outputDevice);

    // You can implement specific behavior based on the output device
    // For example, pause when headphones are disconnected
    if (outputDevice === 'speaker' && Platform.OS === 'ios') {
      // Headphones were likely disconnected
      const state = await TrackPlayer.getPlaybackState();
      if (state.state === State.Playing) {
        await TrackPlayer.pause();
      }
    }
  }

  /**
   * Setup metadata for the current track
   */
  async updateNowPlayingMetadata(track: Track): Promise<void> {
    // Track Player automatically updates metadata when tracks are added
    // But we can force an update if needed
    const currentTrack = await TrackPlayer.getActiveTrack();

    if (currentTrack && currentTrack.id === track.id) {
      await TrackPlayer.updateNowPlayingMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: track.artwork,
        duration: track.duration,
      });
    }
  }

  /**
   * Handle remote control events (headphone buttons, car controls, etc.)
   */
  setupRemoteControlHandlers(): void {
    // These are handled in PlaybackService.ts through event listeners
    // This method is here for reference and potential future enhancements
    console.log('Remote control handlers setup in PlaybackService');
  }

  /**
   * Clean up resources when the service is no longer needed
   */
  async destroy(): Promise<void> {
    try {
      await TrackPlayer.reset();
      await TrackPlayer.destroy();
      this.initialized = false;
      this.setupPromise = null;
    } catch (error) {
      console.error('Error destroying BackgroundAudioService:', error);
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get service capabilities
   */
  async getCapabilities(): Promise<Capability[]> {
    const options = await TrackPlayer.getOptions();
    return options.capabilities || [];
  }
}

export const backgroundAudioService = new BackgroundAudioService();