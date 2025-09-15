import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { audioService, usePlaybackState, useProgress } from '../../lib/audio-service';
import { State } from 'react-native-track-player';

export default function PlayerScreen() {
  const { trackId } = useLocalSearchParams();
  const playbackState = usePlaybackState();
  const progress = useProgress();
  const [currentTrack, setCurrentTrack] = useState<any>(null);

  const isPlaying = playbackState.state === State.Playing;

  const togglePlayPause = async () => {
    if (isPlaying) {
      await audioService.pause();
    } else {
      await audioService.play();
    }
  };

  const handleSkipNext = async () => {
    await audioService.skipToNext();
  };

  const handleSkipPrevious = async () => {
    await audioService.skipToPrevious();
  };

  const handleSeek = async (value: number) => {
    await audioService.seekTo(value);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // TODO: Load track data based on trackId
  useEffect(() => {
    if (trackId) {
      // Load track from Supabase and add to player
    }
  }, [trackId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Now Playing</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.albumArt}>
          {currentTrack?.artwork ? (
            <Image source={{ uri: currentTrack.artwork }} style={styles.artwork} />
          ) : (
            <View style={styles.placeholderArt}>
              <Ionicons name="musical-notes" size={80} color="#9CA3AF" />
            </View>
          )}
        </View>

        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle}>
            {currentTrack?.title || 'No track selected'}
          </Text>
          <Text style={styles.trackArtist}>
            {currentTrack?.artist || 'Select a track from your library'}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <Slider
            style={styles.progressSlider}
            value={progress.position}
            minimumValue={0}
            maximumValue={progress.duration}
            onSlidingComplete={handleSeek}
            minimumTrackTintColor="#7C3AED"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#7C3AED"
          />
          <View style={styles.progressTime}>
            <Text style={styles.timeText}>{formatTime(progress.position)}</Text>
            <Text style={styles.timeText}>{formatTime(progress.duration)}</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity onPress={handleSkipPrevious} style={styles.controlButton}>
            <Ionicons name="play-skip-back" size={32} color="#0F172A" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={togglePlayPause}
            style={[styles.controlButton, styles.playButton]}
          >
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={40}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkipNext} style={styles.controlButton}>
            <Ionicons name="play-skip-forward" size={32} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <View style={styles.additionalControls}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="repeat" size={24} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="shuffle" size={24} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="heart-outline" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-evenly',
  },
  albumArt: {
    alignItems: 'center',
    marginVertical: 30,
  },
  artwork: {
    width: 280,
    height: 280,
    borderRadius: 12,
  },
  placeholderArt: {
    width: 280,
    height: 280,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: {
    alignItems: 'center',
    marginVertical: 20,
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  trackArtist: {
    fontSize: 16,
    color: '#6B7280',
  },
  progressContainer: {
    marginVertical: 20,
  },
  progressSlider: {
    width: '100%',
    height: 40,
  },
  progressTime: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  controlButton: {
    padding: 12,
    marginHorizontal: 20,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  additionalControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
  },
  iconButton: {
    padding: 8,
  },
});