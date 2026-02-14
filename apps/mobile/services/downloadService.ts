import { File } from 'expo-file-system';
import { useDownloadStore } from '../stores/downloadStore';
import { cacheService } from './cacheService';
import { trackService } from './trackService';

class DownloadService {
  private activeTrackIds: Set<string> = new Set();

  async downloadTrack(trackId: string): Promise<void> {
    const store = useDownloadStore.getState();

    // Already downloaded or in progress
    const current = store.getDownload(trackId);
    if (
      current.status === 'downloaded' ||
      current.status === 'downloading' ||
      current.status === 'queued'
    ) {
      return;
    }

    store.setQueued(trackId);

    try {
      // Get signed URL
      const audioUrl = await trackService.getSignedAudioUrl(trackId);
      if (!audioUrl) {
        store.setError(trackId, 'Could not get audio URL');
        return;
      }

      store.setDownloading(trackId, 0);
      this.activeTrackIds.add(trackId);

      const destination = cacheService.getFile(trackId);

      // Download using the new File.downloadFileAsync API
      const downloadedFile = await File.downloadFileAsync(
        audioUrl,
        destination,
        { idempotent: true },
      );

      const fileSize = downloadedFile.size;
      store.setDownloaded(trackId, downloadedFile.uri, fileSize);
      cacheService.addToCache(trackId, downloadedFile.uri, fileSize);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Download failed';
      useDownloadStore.getState().setError(trackId, message);
    } finally {
      this.activeTrackIds.delete(trackId);
    }
  }

  async removeDownload(trackId: string): Promise<void> {
    this.activeTrackIds.delete(trackId);
    cacheService.removeFromCache(trackId);
    useDownloadStore.getState().removeDownload(trackId);
  }

  getLocalAudioUri(trackId: string): string | null {
    return useDownloadStore.getState().getLocalUri(trackId);
  }

  isDownloading(trackId: string): boolean {
    return this.activeTrackIds.has(trackId);
  }
}

export const downloadService = new DownloadService();
