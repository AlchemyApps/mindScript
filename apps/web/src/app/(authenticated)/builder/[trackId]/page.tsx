'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@mindscript/auth/hooks';
import { Card, CardContent, CardHeader, Button, Spinner, Badge } from '@mindscript/ui';
import { ArrowLeftIcon, PlayIcon, DownloadIcon } from 'lucide-react';
import { formatDuration } from '@mindscript/schemas';

export default function EditTrackPage() {
  const router = useRouter();
  const params = useParams();
  const trackId = params.trackId as string;
  const { user, loading: authLoading } = useAuth();
  const [track, setTrack] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth/login?redirect=/builder/${trackId}`);
    }
  }, [user, authLoading, router, trackId]);

  // Fetch track data
  useEffect(() => {
    if (!user || !trackId) return;

    const fetchTrack = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/library/tracks?ownership=owned&status=all`);

        if (!response.ok) {
          throw new Error('Failed to fetch track');
        }

        const data = await response.json();
        const foundTrack = data.tracks.find((t: any) => t.id === trackId);

        if (!foundTrack) {
          throw new Error('Track not found');
        }

        if (foundTrack.user_id !== user.id) {
          throw new Error('You do not have permission to edit this track');
        }

        setTrack(foundTrack);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrack();
  }, [user, trackId]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner className="h-12 w-12 mx-auto mb-4" />
          <p className="text-gray-500">Loading track...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/library')}
          className="mb-6"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Library
        </Button>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!track) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'success';
      case 'rendering':
        return 'warning';
      case 'failed':
        return 'destructive';
      case 'draft':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/tracks/${track.id}/stream`);
      if (!response.ok) {
        throw new Error('Download failed');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title.replace(/[^a-z0-9\s\-_]/gi, '')}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Button
        variant="ghost"
        onClick={() => router.push('/library')}
        className="mb-6"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-2" />
        Back to Library
      </Button>

      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{track.title}</h1>
                {track.description && (
                  <p className="text-muted-foreground">{track.description}</p>
                )}
              </div>
              <Badge variant={getStatusColor(track.status) as any}>
                {track.status}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Track Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{formatDuration(track.duration)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{new Date(track.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Voice Config */}
            {track.voice_config && (
              <div>
                <h3 className="font-semibold mb-2">Voice Configuration</h3>
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm">
                    <span className="font-medium">Provider:</span> {track.voice_config.provider}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Voice:</span> {track.voice_config.voice_id}
                  </p>
                </div>
              </div>
            )}

            {/* Music Config */}
            {track.music_config && (
              <div>
                <h3 className="font-semibold mb-2">Background Music</h3>
                <div className="bg-muted p-4 rounded-md">
                  <p className="text-sm">
                    <span className="font-medium">Track:</span> {track.music_config.name || 'Background music'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Volume:</span> {track.music_config.volume_db} dB
                  </p>
                </div>
              </div>
            )}

            {/* Script */}
            <div>
              <h3 className="font-semibold mb-2">Script</h3>
              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm whitespace-pre-wrap">{track.script}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              {track.audio_url && (
                <Button onClick={handleDownload} variant="secondary">
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
              <Button
                onClick={() => router.push('/builder')}
                variant="default"
              >
                Create New Track
              </Button>
            </div>

            {/* Edit Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> Full track editing is coming soon. For now, you can view your track details and create a new track with similar settings.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
