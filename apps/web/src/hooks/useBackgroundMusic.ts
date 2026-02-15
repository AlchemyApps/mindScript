import { useState, useEffect, useMemo } from 'react';

export interface BackgroundTrack {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  bpm: number;
  key: string;
  price_cents: number;
  duration_seconds: number;
  attributes: string[];
  previewUrl: string;
  tier: 'standard' | 'premium';
}

export function useBackgroundMusic() {
  const [tracks, setTracks] = useState<BackgroundTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchTracks() {
      try {
        const res = await fetch('/api/music');
        if (!res.ok) throw new Error('Failed to fetch music catalog');
        const data = await res.json();
        if (!cancelled) {
          setTracks(data.tracks || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTracks();
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, BackgroundTrack[]>();
    for (const track of tracks) {
      const category = track.category || 'Other';
      if (!map.has(category)) map.set(category, []);
      map.get(category)!.push(track);
    }
    return map;
  }, [tracks]);

  return { tracks, grouped, loading, error };
}
