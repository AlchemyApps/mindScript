import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import TrackPlayer, { Event, RepeatMode } from 'react-native-track-player';
import { PlaybackService } from '../PlaybackService';
import { usePlayerStore } from '../../stores/playerStore';

// Mock react-native-track-player
vi.mock('react-native-track-player', () => ({
  default: {
    addEventListener: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    reset: vi.fn(),
    skipToNext: vi.fn(),
    skipToPrevious: vi.fn(),
    seekTo: vi.fn(),
    setVolume: vi.fn(),
    skip: vi.fn(),
    getQueue: vi.fn(),
    getPosition: vi.fn(),
    getDuration: vi.fn(),
    updateMetadataForTrack: vi.fn(),
    registerPlaybackService: vi.fn(),
  },
  Event: {
    RemotePlay: 'remote-play',
    RemotePause: 'remote-pause',
    RemoteStop: 'remote-stop',
    RemoteNext: 'remote-next',
    RemotePrevious: 'remote-previous',
    RemoteSeek: 'remote-seek',
    RemoteDuck: 'remote-duck',
    PlaybackQueueEnded: 'playback-queue-ended',
    PlaybackError: 'playback-error',
    PlaybackMetadataReceived: 'playback-metadata-received',
    PlaybackState: 'playback-state',
    PlaybackActiveTrackChanged: 'playback-active-track-changed',
    RemoteJumpForward: 'remote-jump-forward',
    RemoteJumpBackward: 'remote-jump-backward',
  },
  RepeatMode: {
    Off: 0,
    Track: 1,
    Queue: 2,
  },
}));

// Mock the player store
const mockPlayerStore = {
  play: vi.fn(),
  pause: vi.fn(),
  clearQueue: vi.fn(),
  skipToNext: vi.fn(),
  skipToPrevious: vi.fn(),
  seekTo: vi.fn(),
  syncWithTrackPlayer: vi.fn(),
  volume: 1.0,
  repeatMode: RepeatMode.Off,
  currentTrackIndex: 0,
};

vi.mock('../../stores/playerStore', () => ({
  usePlayerStore: {
    getState: () => mockPlayerStore,
  },
}));

describe('PlaybackService', () => {
  let eventListeners: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    eventListeners = new Map();

    // Mock addEventListener to capture event handlers
    (TrackPlayer.addEventListener as Mock).mockImplementation((event, handler) => {
      eventListeners.set(event, handler);
      return { remove: vi.fn() };
    });

    // Reset mock store
    Object.assign(mockPlayerStore, {
      volume: 1.0,
      repeatMode: RepeatMode.Off,
      currentTrackIndex: 0,
    });
  });

  const triggerEvent = async (event: string, data: any = {}) => {
    await PlaybackService();
    const handler = eventListeners.get(event);
    if (handler) {
      await handler(data);
    }
  };

  describe('Remote Control Events', () => {
    it('should handle remote play event', async () => {
      (TrackPlayer.play as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemotePlay);

      expect(TrackPlayer.play).toHaveBeenCalled();
      expect(mockPlayerStore.play).toHaveBeenCalled();
    });

    it('should handle remote pause event', async () => {
      (TrackPlayer.pause as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemotePause);

      expect(TrackPlayer.pause).toHaveBeenCalled();
      expect(mockPlayerStore.pause).toHaveBeenCalled();
    });

    it('should handle remote stop event', async () => {
      (TrackPlayer.stop as Mock).mockResolvedValue(undefined);
      (TrackPlayer.reset as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemoteStop);

      expect(TrackPlayer.stop).toHaveBeenCalled();
      expect(TrackPlayer.reset).toHaveBeenCalled();
      expect(mockPlayerStore.clearQueue).toHaveBeenCalled();
    });

    it('should handle remote next event', async () => {
      (TrackPlayer.skipToNext as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemoteNext);

      expect(TrackPlayer.skipToNext).toHaveBeenCalled();
      expect(mockPlayerStore.skipToNext).toHaveBeenCalled();
    });

    it('should handle remote previous event', async () => {
      (TrackPlayer.skipToPrevious as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemotePrevious);

      expect(TrackPlayer.skipToPrevious).toHaveBeenCalled();
      expect(mockPlayerStore.skipToPrevious).toHaveBeenCalled();
    });

    it('should handle remote seek event', async () => {
      const position = 30;
      (TrackPlayer.seekTo as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemoteSeek, { position });

      expect(TrackPlayer.seekTo).toHaveBeenCalledWith(position);
      expect(mockPlayerStore.seekTo).toHaveBeenCalledWith(position);
    });
  });

  describe('Audio Ducking', () => {
    it('should pause when ducked with pause flag', async () => {
      (TrackPlayer.pause as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemoteDuck, { paused: true });

      expect(TrackPlayer.pause).toHaveBeenCalled();
    });

    it('should stop when ducked permanently', async () => {
      (TrackPlayer.stop as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemoteDuck, { permanent: true });

      expect(TrackPlayer.stop).toHaveBeenCalled();
    });

    it('should reduce volume temporarily when ducked', async () => {
      vi.useFakeTimers();
      (TrackPlayer.setVolume as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemoteDuck, { paused: false, permanent: false });

      expect(TrackPlayer.setVolume).toHaveBeenCalledWith(0.5);

      // Fast forward time
      vi.advanceTimersByTime(2000);

      expect(TrackPlayer.setVolume).toHaveBeenCalledWith(1.0);

      vi.useRealTimers();
    });
  });

  describe('Playback Queue Events', () => {
    it('should restart queue when repeat mode is Queue', async () => {
      mockPlayerStore.repeatMode = RepeatMode.Queue;
      (TrackPlayer.skip as Mock).mockResolvedValue(undefined);
      (TrackPlayer.play as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.PlaybackQueueEnded);

      expect(TrackPlayer.skip).toHaveBeenCalledWith(0);
      expect(TrackPlayer.play).toHaveBeenCalled();
    });

    it('should pause when queue ends and repeat is off', async () => {
      mockPlayerStore.repeatMode = RepeatMode.Off;

      await triggerEvent(Event.PlaybackQueueEnded);

      expect(mockPlayerStore.pause).toHaveBeenCalled();
      expect(TrackPlayer.skip).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should skip to next track on playback error if available', async () => {
      const mockQueue = [
        { id: '1', title: 'Track 1' },
        { id: '2', title: 'Track 2' },
      ];
      mockPlayerStore.currentTrackIndex = 0;

      (TrackPlayer.getQueue as Mock).mockResolvedValue(mockQueue);
      (TrackPlayer.skipToNext as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.PlaybackError, { error: 'Network error' });

      expect(TrackPlayer.skipToNext).toHaveBeenCalled();
    });

    it('should stop playback on error when no next track', async () => {
      const mockQueue = [{ id: '1', title: 'Track 1' }];
      mockPlayerStore.currentTrackIndex = 0;

      (TrackPlayer.getQueue as Mock).mockResolvedValue(mockQueue);
      (TrackPlayer.stop as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.PlaybackError, { error: 'Network error' });

      expect(TrackPlayer.stop).toHaveBeenCalled();
      expect(mockPlayerStore.pause).toHaveBeenCalled();
    });
  });

  describe('Metadata Updates', () => {
    it('should update track metadata when received', async () => {
      mockPlayerStore.currentTrackIndex = 0;
      const metadata = {
        title: 'New Title',
        artist: 'New Artist',
        artwork: 'https://example.com/new-artwork.jpg',
      };

      (TrackPlayer.updateMetadataForTrack as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.PlaybackMetadataReceived, { metadata });

      expect(TrackPlayer.updateMetadataForTrack).toHaveBeenCalledWith(0, {
        title: metadata.title,
        artist: metadata.artist,
        artwork: metadata.artwork,
      });
    });

    it('should not update metadata if no current track', async () => {
      mockPlayerStore.currentTrackIndex = null;
      const metadata = {
        title: 'New Title',
      };

      await triggerEvent(Event.PlaybackMetadataReceived, { metadata });

      expect(TrackPlayer.updateMetadataForTrack).not.toHaveBeenCalled();
    });
  });

  describe('Jump Controls', () => {
    it('should handle jump forward event', async () => {
      const interval = 15;
      const currentPosition = 30;
      const duration = 180;

      (TrackPlayer.getPosition as Mock).mockResolvedValue(currentPosition);
      (TrackPlayer.getDuration as Mock).mockResolvedValue(duration);
      (TrackPlayer.seekTo as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemoteJumpForward, { interval });

      expect(TrackPlayer.seekTo).toHaveBeenCalledWith(currentPosition + interval);
    });

    it('should not seek beyond duration on jump forward', async () => {
      const interval = 30;
      const currentPosition = 160;
      const duration = 180;

      (TrackPlayer.getPosition as Mock).mockResolvedValue(currentPosition);
      (TrackPlayer.getDuration as Mock).mockResolvedValue(duration);
      (TrackPlayer.seekTo as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemoteJumpForward, { interval });

      expect(TrackPlayer.seekTo).toHaveBeenCalledWith(duration);
    });

    it('should handle jump backward event', async () => {
      const interval = 15;
      const currentPosition = 30;

      (TrackPlayer.getPosition as Mock).mockResolvedValue(currentPosition);
      (TrackPlayer.seekTo as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemoteJumpBackward, { interval });

      expect(TrackPlayer.seekTo).toHaveBeenCalledWith(currentPosition - interval);
    });

    it('should not seek below zero on jump backward', async () => {
      const interval = 30;
      const currentPosition = 10;

      (TrackPlayer.getPosition as Mock).mockResolvedValue(currentPosition);
      (TrackPlayer.seekTo as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemoteJumpBackward, { interval });

      expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
    });

    it('should use default interval if not provided', async () => {
      const currentPosition = 50;
      const duration = 180;

      (TrackPlayer.getPosition as Mock).mockResolvedValue(currentPosition);
      (TrackPlayer.getDuration as Mock).mockResolvedValue(duration);
      (TrackPlayer.seekTo as Mock).mockResolvedValue(undefined);

      await triggerEvent(Event.RemoteJumpForward, {});

      expect(TrackPlayer.seekTo).toHaveBeenCalledWith(currentPosition + 10); // Default is 10
    });
  });

  describe('State Synchronization', () => {
    it('should sync with track player on state change', async () => {
      await triggerEvent(Event.PlaybackState, { state: 'playing' });

      expect(mockPlayerStore.syncWithTrackPlayer).toHaveBeenCalled();
    });

    it('should sync when active track changes', async () => {
      const mockQueue = [
        { id: '1', title: 'Track 1' },
        { id: '2', title: 'Track 2' },
      ];

      (TrackPlayer.getQueue as Mock).mockResolvedValue(mockQueue);

      await triggerEvent(Event.PlaybackActiveTrackChanged, { track: 0 });

      expect(mockPlayerStore.syncWithTrackPlayer).toHaveBeenCalled();
    });

    it('should handle track change with invalid index', async () => {
      const mockQueue = [{ id: '1', title: 'Track 1' }];

      (TrackPlayer.getQueue as Mock).mockResolvedValue(mockQueue);

      await triggerEvent(Event.PlaybackActiveTrackChanged, { track: -1 });

      expect(mockPlayerStore.syncWithTrackPlayer).not.toHaveBeenCalled();
    });
  });
});