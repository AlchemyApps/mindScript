import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import TrackPlayer, {
  State,
  Capability,
  AppKilledPlaybackBehavior,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
} from 'react-native-track-player';
import { Platform } from 'react-native';
import { backgroundAudioService } from '../backgroundAudioService';

// Mock react-native-track-player
vi.mock('react-native-track-player', () => ({
  default: {
    setupPlayer: vi.fn(),
    updateOptions: vi.fn(),
    getOptions: vi.fn(),
    reset: vi.fn(),
    destroy: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    getVolume: vi.fn(),
    setVolume: vi.fn(),
    getPlaybackState: vi.fn(),
    getActiveTrack: vi.fn(),
    updateNowPlayingMetadata: vi.fn(),
  },
  State: {
    Playing: 'playing',
    Paused: 'paused',
    Stopped: 'stopped',
    Buffering: 'buffering',
    Loading: 'loading',
  },
  Capability: {
    Play: 'play',
    Pause: 'pause',
    SkipToNext: 'skipToNext',
    SkipToPrevious: 'skipToPrevious',
    SeekTo: 'seekTo',
    Stop: 'stop',
    JumpForward: 'jumpForward',
    JumpBackward: 'jumpBackward',
  },
  AppKilledPlaybackBehavior: {
    ContinuePlayback: 'continuePlayback',
    PausePlayback: 'pausePlayback',
    StopPlaybackAndRemoveNotification: 'stopPlaybackAndRemoveNotification',
  },
  IOSCategory: {
    Playback: 'playback',
    PlayAndRecord: 'playAndRecord',
    MultiRoute: 'multiRoute',
  },
  IOSCategoryMode: {
    SpokenAudio: 'spokenAudio',
    Default: 'default',
    VideoChat: 'videoChat',
  },
  IOSCategoryOptions: {
    AllowBluetooth: 'allowBluetooth',
    AllowBluetoothA2DP: 'allowBluetoothA2DP',
    AllowAirPlay: 'allowAirPlay',
    InterruptSpokenAudioAndMixWithOthers: 'interruptSpokenAudioAndMixWithOthers',
  },
}));

// Mock react-native Platform
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: vi.fn((obj) => obj.ios || obj.default),
  },
}));

// Mock the player store
vi.mock('../../stores/playerStore', () => ({
  usePlayerStore: {
    getState: vi.fn(() => ({
      isPlaying: false,
      volume: 1.0,
    })),
  },
}));

describe('BackgroundAudioService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize the service successfully', async () => {
      (TrackPlayer.setupPlayer as Mock).mockResolvedValue(undefined);
      (TrackPlayer.updateOptions as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.initialize();

      expect(TrackPlayer.setupPlayer).toHaveBeenCalledWith({
        maxCacheSize: 50 * 1024 * 1024,
        waitForBuffer: true,
        autoUpdateMetadata: true,
      });

      expect(TrackPlayer.updateOptions).toHaveBeenCalled();
      expect(backgroundAudioService.isInitialized()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      (TrackPlayer.setupPlayer as Mock).mockResolvedValue(undefined);
      (TrackPlayer.updateOptions as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.initialize();
      const setupCallCount = (TrackPlayer.setupPlayer as Mock).mock.calls.length;

      await backgroundAudioService.initialize();

      expect(TrackPlayer.setupPlayer).toHaveBeenCalledTimes(setupCallCount);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Setup failed');
      (TrackPlayer.setupPlayer as Mock).mockRejectedValue(error);

      await expect(backgroundAudioService.initialize()).rejects.toThrow('Setup failed');
      expect(backgroundAudioService.isInitialized()).toBe(false);
    });

    it('should configure iOS-specific settings on iOS', async () => {
      Platform.OS = 'ios';
      (TrackPlayer.setupPlayer as Mock).mockResolvedValue(undefined);
      (TrackPlayer.updateOptions as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.initialize();

      const updateOptionsCall = (TrackPlayer.updateOptions as Mock).mock.calls.find(
        (call) => call[0].iosCategory
      );

      expect(updateOptionsCall).toBeDefined();
      expect(updateOptionsCall[0]).toMatchObject({
        iosCategory: IOSCategory.Playback,
        iosCategoryMode: IOSCategoryMode.SpokenAudio,
        iosCategoryOptions: expect.arrayContaining([
          IOSCategoryOptions.AllowBluetooth,
          IOSCategoryOptions.AllowBluetoothA2DP,
          IOSCategoryOptions.AllowAirPlay,
        ]),
      });
    });

    it('should configure Android-specific settings on Android', async () => {
      Platform.OS = 'android';
      (TrackPlayer.setupPlayer as Mock).mockResolvedValue(undefined);
      (TrackPlayer.updateOptions as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.initialize();

      const updateOptionsCall = (TrackPlayer.updateOptions as Mock).mock.calls.find(
        (call) => call[0].android
      );

      expect(updateOptionsCall).toBeDefined();
      expect(updateOptionsCall[0].android).toMatchObject({
        appKilledPlaybackBehavior: AppKilledPlaybackBehavior.ContinuePlayback,
        alwaysPauseOnInterruption: false,
        notificationStyle: 'compact',
      });
    });
  });

  describe('handleAudioFocus', () => {
    it('should lower volume when losing focus with ducking allowed', async () => {
      (TrackPlayer.getVolume as Mock).mockResolvedValue(1.0);
      (TrackPlayer.setVolume as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.handleAudioFocus(false, true);

      expect(TrackPlayer.setVolume).toHaveBeenCalledWith(0.3);
    });

    it('should pause playback when completely losing focus', async () => {
      (TrackPlayer.getPlaybackState as Mock).mockResolvedValue({ state: State.Playing });
      (TrackPlayer.pause as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.handleAudioFocus(false, false);

      expect(TrackPlayer.pause).toHaveBeenCalled();
    });

    it('should restore volume when regaining focus', async () => {
      (TrackPlayer.setVolume as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.handleAudioFocus(true, false);

      expect(TrackPlayer.setVolume).toHaveBeenCalledWith(1.0);
    });

    it('should not pause when already paused', async () => {
      (TrackPlayer.getPlaybackState as Mock).mockResolvedValue({ state: State.Paused });
      (TrackPlayer.pause as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.handleAudioFocus(false, false);

      expect(TrackPlayer.pause).not.toHaveBeenCalled();
    });
  });

  describe('handleInterruption', () => {
    it('should pause playback when interruption begins', async () => {
      (TrackPlayer.getPlaybackState as Mock).mockResolvedValue({ state: State.Playing });
      (TrackPlayer.pause as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.handleInterruption('begin');

      expect(TrackPlayer.pause).toHaveBeenCalled();
    });

    it('should resume playback when interruption ends if was playing', async () => {
      // First, simulate interruption beginning while playing
      (TrackPlayer.getPlaybackState as Mock).mockResolvedValue({ state: State.Playing });
      (TrackPlayer.pause as Mock).mockResolvedValue(undefined);
      await backgroundAudioService.handleInterruption('begin');

      // Then simulate interruption ending
      (TrackPlayer.play as Mock).mockResolvedValue(undefined);
      await backgroundAudioService.handleInterruption('end');

      expect(TrackPlayer.play).toHaveBeenCalled();
    });

    it('should not resume playback if was not playing before interruption', async () => {
      // Simulate interruption beginning while paused
      (TrackPlayer.getPlaybackState as Mock).mockResolvedValue({ state: State.Paused });
      await backgroundAudioService.handleInterruption('begin');

      // Then simulate interruption ending
      (TrackPlayer.play as Mock).mockResolvedValue(undefined);
      await backgroundAudioService.handleInterruption('end');

      expect(TrackPlayer.play).not.toHaveBeenCalled();
    });
  });

  describe('handleRouteChange', () => {
    it('should pause when headphones disconnected on iOS', async () => {
      Platform.OS = 'ios';
      (TrackPlayer.getPlaybackState as Mock).mockResolvedValue({ state: State.Playing });
      (TrackPlayer.pause as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.handleRouteChange('speaker');

      expect(TrackPlayer.pause).toHaveBeenCalled();
    });

    it('should not pause when headphones disconnected while already paused', async () => {
      Platform.OS = 'ios';
      (TrackPlayer.getPlaybackState as Mock).mockResolvedValue({ state: State.Paused });
      (TrackPlayer.pause as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.handleRouteChange('speaker');

      expect(TrackPlayer.pause).not.toHaveBeenCalled();
    });

    it('should not pause on Android when route changes', async () => {
      Platform.OS = 'android';
      (TrackPlayer.pause as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.handleRouteChange('speaker');

      expect(TrackPlayer.pause).not.toHaveBeenCalled();
    });
  });

  describe('updateNowPlayingMetadata', () => {
    it('should update metadata for current track', async () => {
      const track = {
        id: 'test-track',
        url: 'https://example.com/track.mp3',
        title: 'Test Track',
        artist: 'Test Artist',
        album: 'Test Album',
        artwork: 'https://example.com/artwork.jpg',
        duration: 180,
      };

      (TrackPlayer.getActiveTrack as Mock).mockResolvedValue(track);
      (TrackPlayer.updateNowPlayingMetadata as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.updateNowPlayingMetadata(track);

      expect(TrackPlayer.updateNowPlayingMetadata).toHaveBeenCalledWith({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: track.artwork,
        duration: track.duration,
      });
    });

    it('should not update metadata for different track', async () => {
      const currentTrack = {
        id: 'current-track',
        url: 'https://example.com/current.mp3',
        title: 'Current Track',
      };

      const newTrack = {
        id: 'new-track',
        url: 'https://example.com/new.mp3',
        title: 'New Track',
      };

      (TrackPlayer.getActiveTrack as Mock).mockResolvedValue(currentTrack);
      (TrackPlayer.updateNowPlayingMetadata as Mock).mockResolvedValue(undefined);

      await backgroundAudioService.updateNowPlayingMetadata(newTrack);

      expect(TrackPlayer.updateNowPlayingMetadata).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clean up resources properly', async () => {
      (TrackPlayer.reset as Mock).mockResolvedValue(undefined);
      (TrackPlayer.destroy as Mock).mockResolvedValue(undefined);

      // Initialize first
      (TrackPlayer.setupPlayer as Mock).mockResolvedValue(undefined);
      (TrackPlayer.updateOptions as Mock).mockResolvedValue(undefined);
      await backgroundAudioService.initialize();

      await backgroundAudioService.destroy();

      expect(TrackPlayer.reset).toHaveBeenCalled();
      expect(TrackPlayer.destroy).toHaveBeenCalled();
      expect(backgroundAudioService.isInitialized()).toBe(false);
    });

    it('should handle errors during cleanup', async () => {
      const error = new Error('Cleanup failed');
      (TrackPlayer.reset as Mock).mockRejectedValue(error);

      await expect(backgroundAudioService.destroy()).resolves.not.toThrow();
    });
  });

  describe('getCapabilities', () => {
    it('should return configured capabilities', async () => {
      const capabilities = [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ];

      (TrackPlayer.getOptions as Mock).mockResolvedValue({ capabilities });

      const result = await backgroundAudioService.getCapabilities();

      expect(result).toEqual(capabilities);
    });

    it('should return empty array if no capabilities configured', async () => {
      (TrackPlayer.getOptions as Mock).mockResolvedValue({});

      const result = await backgroundAudioService.getCapabilities();

      expect(result).toEqual([]);
    });
  });
});