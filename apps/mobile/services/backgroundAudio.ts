import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
} from 'react-native-track-player';
import { Platform } from 'react-native';

class BackgroundAudioService {
  private initialized = false;
  private setupPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.setupPromise) return this.setupPromise;

    this.setupPromise = this.setup();
    try {
      await this.setupPromise;
      this.initialized = true;
    } catch (error) {
      this.setupPromise = null;
      throw error;
    }
  }

  private async setup(): Promise<void> {
    try {
      await TrackPlayer.setupPlayer({
        maxCacheSize: 50 * 1024 * 1024,
        waitForBuffer: true,
        autoUpdateMetadata: true,
        ...(Platform.OS === 'ios'
          ? {
              iosCategory: IOSCategory.Playback,
              iosCategoryMode: IOSCategoryMode.SpokenAudio,
              iosCategoryOptions: [
                IOSCategoryOptions.AllowBluetooth,
                IOSCategoryOptions.AllowBluetoothA2DP,
                IOSCategoryOptions.AllowAirPlay,
              ],
            }
          : {}),
      });

      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.ContinuePlayback,
          alwaysPauseOnInterruption: false,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.Stop,
          Capability.JumpForward,
          Capability.JumpBackward,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
        forwardJumpInterval: 10,
        backwardJumpInterval: 10,
        progressUpdateEventInterval: 1,
      });
    } catch (error) {
      console.error('Failed to initialize BackgroundAudioService:', error);
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async destroy(): Promise<void> {
    try {
      await TrackPlayer.reset();
      this.initialized = false;
      this.setupPromise = null;
    } catch (error) {
      console.error('Error destroying BackgroundAudioService:', error);
    }
  }
}

export const backgroundAudioService = new BackgroundAudioService();
