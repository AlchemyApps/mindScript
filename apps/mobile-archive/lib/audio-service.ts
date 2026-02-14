import TrackPlayer, {
  Event,
  PlaybackState,
  State,
  Track,
  usePlaybackState,
  useProgress,
  useTrackPlayerEvents,
  Capability,
} from 'react-native-track-player';

export interface MindScriptTrack extends Track {
  id: string;
  url: string;
  title: string;
  artist: string;
  artwork?: string;
  duration?: number;
}

class AudioService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await TrackPlayer.setupPlayer();
      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
          Capability.SeekTo,
          Capability.Stop,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
        notificationCapabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize audio service:', error);
      throw error;
    }
  }

  async addTrack(track: MindScriptTrack): Promise<void> {
    await this.ensureInitialized();
    await TrackPlayer.add(track);
  }

  async addTracks(tracks: MindScriptTrack[]): Promise<void> {
    await this.ensureInitialized();
    await TrackPlayer.add(tracks);
  }

  async play(): Promise<void> {
    await this.ensureInitialized();
    await TrackPlayer.play();
  }

  async pause(): Promise<void> {
    await TrackPlayer.pause();
  }

  async stop(): Promise<void> {
    await TrackPlayer.stop();
  }

  async skipToNext(): Promise<void> {
    await TrackPlayer.skipToNext();
  }

  async skipToPrevious(): Promise<void> {
    await TrackPlayer.skipToPrevious();
  }

  async seekTo(position: number): Promise<void> {
    await TrackPlayer.seekTo(position);
  }

  async clearQueue(): Promise<void> {
    await TrackPlayer.reset();
  }

  async getCurrentTrack(): Promise<number | null> {
    const index = await TrackPlayer.getActiveTrackIndex();
    return index !== undefined ? index : null;
  }

  async getQueue(): Promise<Track[]> {
    return await TrackPlayer.getQueue();
  }

  async getPlaybackState(): Promise<PlaybackState> {
    return await TrackPlayer.getPlaybackState();
  }

  async isPlaying(): Promise<boolean> {
    const state = await this.getPlaybackState();
    return state.state === State.Playing;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

export const audioService = new AudioService();

// Export hooks for use in components
export { usePlaybackState, useProgress, useTrackPlayerEvents };