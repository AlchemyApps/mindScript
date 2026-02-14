import { useCallback } from 'react';
import { useDownloadStore, DownloadState } from '../stores/downloadStore';
import { downloadService } from '../services/downloadService';

export function useDownloadTrack(trackId: string) {
  const download: DownloadState = useDownloadStore((s) => s.getDownload(trackId));

  const startDownload = useCallback(() => {
    downloadService.downloadTrack(trackId);
  }, [trackId]);

  const removeDownload = useCallback(() => {
    downloadService.removeDownload(trackId);
  }, [trackId]);

  return {
    ...download,
    startDownload,
    removeDownload,
  };
}
