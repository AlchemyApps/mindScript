import { Platform } from 'react-native';
import { trackService, LibraryTrack } from './trackService';
import { usePlayerStore, QueueItem } from '../stores/playerStore';
import { useAuthStore } from '../stores/authStore';

// CarPlay is iOS-only — guard all imports and usage
let CarPlay: typeof import('react-native-carplay').CarPlay | null = null;
let ListTemplate: typeof import('react-native-carplay').ListTemplate | null =
  null;
let NowPlayingTemplate: typeof import('react-native-carplay').NowPlayingTemplate | null =
  null;

if (Platform.OS === 'ios') {
  try {
    const cp = require('react-native-carplay');
    CarPlay = cp.CarPlay;
    ListTemplate = cp.ListTemplate;
    NowPlayingTemplate = cp.NowPlayingTemplate;
  } catch {
    // react-native-carplay not available — CarPlay disabled
  }
}

class CarPlayServiceImpl {
  private connected = false;
  private cachedTracks: LibraryTrack[] = [];

  async initialize(): Promise<void> {
    if (Platform.OS !== 'ios' || !CarPlay) return;

    CarPlay.registerOnConnect(() => {
      this.connected = true;
      this.presentRootTemplate();
    });

    CarPlay.registerOnDisconnect(() => {
      this.connected = false;
    });
  }

  private async presentRootTemplate(): Promise<void> {
    if (!CarPlay || !ListTemplate) return;

    const libraryTemplate = new ListTemplate({
      title: 'MindScript Library',
      sections: [],
      onItemSelect: async (item: { index: number }) => {
        await this.handleTrackSelect(item.index);
      },
    });

    CarPlay.setRootTemplate(libraryTemplate);

    // Load library items
    await this.refreshLibrary(libraryTemplate);

    // Present now playing if available
    if (NowPlayingTemplate) {
      const nowPlaying = new NowPlayingTemplate({});
      CarPlay.pushTemplate(nowPlaying);
      CarPlay.popTemplate();
    }
  }

  private async refreshLibrary(template: InstanceType<NonNullable<typeof ListTemplate>>): Promise<void> {
    try {
      const user = useAuthStore.getState().user;
      if (!user) return;

      const tracks = await trackService.fetchUserLibrary(user.id);
      this.cachedTracks = tracks;

      template.updateSections([
        {
          header: 'Your Library',
          items: tracks.map((track) => ({
            text: track.title,
            detailText: this.formatDuration(track.duration_seconds),
          })),
        },
      ]);
    } catch (error) {
      console.error('CarPlay: Failed to load library:', error);
    }
  }

  private async handleTrackSelect(index: number): Promise<void> {
    try {
      const track = this.cachedTracks[index];
      if (!track) return;

      const audioUrl = await trackService.getSignedAudioUrl(track.id);
      if (!audioUrl) return;

      const queueItem: QueueItem = {
        id: track.id,
        url: audioUrl,
        title: track.title,
        artist: 'MindScript',
        artwork: track.cover_image_url ?? undefined,
        duration: track.duration_seconds ?? 0,
        mindscriptId: track.id,
      };

      await usePlayerStore.getState().setQueue([queueItem]);
      await usePlayerStore.getState().play();
    } catch (error) {
      console.error('CarPlay: Failed to play track:', error);
    }
  }

  private formatDuration(seconds: number | null): string {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  isConnected(): boolean {
    return this.connected;
  }

  destroy(): void {
    this.connected = false;
  }
}

export const carPlayService = new CarPlayServiceImpl();
