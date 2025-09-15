import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TrackPlayer, {
  State,
  usePlaybackState,
  useProgress,
  useTrackPlayerEvents,
  Event,
  Track,
} from 'react-native-track-player';
import { audioService } from '../lib/audio-service';

interface AudioPlayerProps {
  track?: Track;
  onClose?: () => void;
}

export function AudioPlayer({ track, onClose }: AudioPlayerProps) {
  const playbackState = usePlaybackState();
  const progress = useProgress();
  const [isLoading, setIsLoading] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);

  const isPlaying = playbackState.state === State.Playing;
  const isBuffering = playbackState.state === State.Buffering ||
                      playbackState.state === State.Loading;

  useTrackPlayerEvents([Event.PlaybackActiveTrackChanged], async (event) => {
    if (event.track) {
      setCurrentTrack(event.track);
    }
  });

  useEffect(() => {
    if (track) {
      loadTrack(track);
    }
  }, [track]);

  const loadTrack = async (trackToLoad: Track) => {
    setIsLoading(true);
    try {
      await audioService.clearQueue();
      await audioService.addTrack(trackToLoad);
      await audioService.play();
      setCurrentTrack(trackToLoad);
    } catch (error) {
      console.error('Failed to load track:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (isPlaying) {
      await audioService.pause();
    } else {
      await audioService.play();
    }
  };

  const handleStop = async () => {
    await audioService.stop();
    await audioService.clearQueue();
    if (onClose) {
      onClose();
    }
  };

  const handleSkipBack = async () => {
    const newPosition = Math.max(0, progress.position - 10);
    await audioService.seekTo(newPosition);
  };

  const handleSkipForward = async () => {
    const newPosition = Math.min(progress.duration, progress.position + 10);
    await audioService.seekTo(newPosition);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentTrack && !track) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {currentTrack?.title || track?.title || 'No track'}
        </Text>
        <TouchableOpacity onPress={handleStop} style={styles.closeButton}>
          <Ionicons name="close" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: progress.duration > 0
                ? `${(progress.position / progress.duration) * 100}%`
                : '0%',
            },
          ]}
        />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity onPress={handleSkipBack} style={styles.controlButton}>
          <Ionicons name="play-back" size={20} color="#374151" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={togglePlayPause}
          style={[styles.controlButton, styles.playButton]}
          disabled={isLoading || isBuffering}
        >
          {isLoading || isBuffering ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color="#fff"
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkipForward} style={styles.controlButton}>
          <Ionicons name="play-forward" size={20} color="#374151" />
        </TouchableOpacity>

        <View style={styles.timeDisplay}>
          <Text style={styles.timeText}>
            {formatTime(progress.position)} / {formatTime(progress.duration)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
    marginRight: 8,
  },
  closeButton: {
    padding: 4,
  },
  progressBar: {
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 1.5,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  controlButton: {
    padding: 8,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeDisplay: {
    flex: 1,
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
  },
});