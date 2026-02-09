import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PanGestureHandler,
  GestureHandlerRootView,
  State as GestureState,
} from 'react-native-gesture-handler';
import TrackPlayer, {
  usePlaybackState,
  useProgress,
  useTrackPlayerEvents,
  Event,
  State,
  Track,
} from 'react-native-track-player';
import { usePlayerStore } from '../stores/playerStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLLAPSED_HEIGHT = 64;
const EXPANDED_HEIGHT = SCREEN_HEIGHT;

interface NowPlayingBarProps {
  onExpand?: () => void;
  onCollapse?: () => void;
}

export function NowPlayingBar({ onExpand, onCollapse }: NowPlayingBarProps) {
  const insets = useSafeAreaInsets();
  const playbackState = usePlaybackState();
  const progress = useProgress();
  const playerStore = usePlayerStore();

  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [translateY] = useState(new Animated.Value(0));
  const [opacity] = useState(new Animated.Value(1));
  const [expandedOpacity] = useState(new Animated.Value(0));

  const isPlaying = playbackState.state === State.Playing;
  const isLoading = playbackState.state === State.Buffering || playbackState.state === State.Loading;

  // Listen for track changes
  useTrackPlayerEvents([Event.PlaybackActiveTrackChanged], async (event) => {
    if (event.track !== undefined && event.track !== null) {
      const track = await TrackPlayer.getActiveTrack();
      setCurrentTrack(track);
    }
  });

  // Load current track on mount
  useEffect(() => {
    loadCurrentTrack();
  }, []);

  const loadCurrentTrack = async () => {
    const track = await TrackPlayer.getActiveTrack();
    setCurrentTrack(track);
  };

  // Handle expand/collapse
  const expand = useCallback(() => {
    setIsExpanded(true);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT),
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(expandedOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onExpand?.();
    });
  }, [translateY, opacity, expandedOpacity, onExpand]);

  const collapse = useCallback(() => {
    setIsExpanded(false);
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(expandedOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onCollapse?.();
    });
  }, [translateY, opacity, expandedOpacity, onCollapse]);

  // Gesture handler for swipe up/down
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === GestureState.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;

      if (!isExpanded) {
        // Swipe up to expand
        if (translationY < -50 || velocityY < -500) {
          expand();
        } else {
          // Spring back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      } else {
        // Swipe down to collapse
        if (translationY > 50 || velocityY > 500) {
          collapse();
        } else {
          // Spring back
          Animated.spring(translateY, {
            toValue: -(EXPANDED_HEIGHT - COLLAPSED_HEIGHT),
            useNativeDriver: true,
          }).start();
        }
      }
    }
  };

  // Playback controls
  const togglePlayPause = async () => {
    if (isPlaying) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  };

  const skipToNext = async () => {
    await TrackPlayer.skipToNext();
  };

  const skipToPrevious = async () => {
    await TrackPlayer.skipToPrevious();
  };

  const seekTo = async (position: number) => {
    await TrackPlayer.seekTo(position);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.gestureContainer}>
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.container,
            {
              height: isExpanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT,
              transform: [{ translateY }],
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {/* Collapsed View */}
          <Animated.View style={[styles.collapsedView, { opacity }]}>
            <TouchableOpacity
              style={styles.collapsedContent}
              onPress={expand}
              activeOpacity={0.9}
            >
              {/* Track Info */}
              <View style={styles.trackInfo}>
                {currentTrack.artwork && (
                  <Image
                    source={{ uri: currentTrack.artwork as string }}
                    style={styles.smallArtwork}
                  />
                )}
                <View style={styles.trackText}>
                  <Text style={styles.trackTitle} numberOfLines={1}>
                    {currentTrack.title}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {currentTrack.artist}
                  </Text>
                </View>
              </View>

              {/* Mini Controls */}
              <View style={styles.miniControls}>
                <TouchableOpacity
                  onPress={togglePlayPause}
                  style={styles.miniControlButton}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#7C3AED" />
                  ) : (
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={24}
                      color="#7C3AED"
                    />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={skipToNext} style={styles.miniControlButton}>
                  <Ionicons name="play-forward" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {/* Progress Bar */}
            <View style={styles.miniProgressBar}>
              <View
                style={[
                  styles.miniProgressFill,
                  {
                    width: progress.duration > 0
                      ? `${(progress.position / progress.duration) * 100}%`
                      : '0%',
                  },
                ]}
              />
            </View>
          </Animated.View>

          {/* Expanded View */}
          <Animated.View
            style={[
              styles.expandedView,
              { opacity: expandedOpacity, paddingTop: insets.top + 20 },
            ]}
            pointerEvents={isExpanded ? 'auto' : 'none'}
          >
            {/* Header with collapse button */}
            <View style={styles.expandedHeader}>
              <TouchableOpacity onPress={collapse} style={styles.collapseButton}>
                <Ionicons name="chevron-down" size={28} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.expandedTitle}>Now Playing</Text>
              <View style={styles.expandedHeaderRight}>
                <TouchableOpacity style={styles.headerButton}>
                  <Ionicons name="list" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Large Artwork */}
            <View style={styles.artworkContainer}>
              {currentTrack.artwork ? (
                <Image
                  source={{ uri: currentTrack.artwork as string }}
                  style={styles.largeArtwork}
                />
              ) : (
                <View style={[styles.largeArtwork, styles.placeholderArtwork]}>
                  <Ionicons name="musical-notes" size={64} color="#9CA3AF" />
                </View>
              )}
            </View>

            {/* Track Information */}
            <View style={styles.expandedTrackInfo}>
              <Text style={styles.expandedTrackTitle} numberOfLines={2}>
                {currentTrack.title}
              </Text>
              <Text style={styles.expandedTrackArtist} numberOfLines={1}>
                {currentTrack.artist}
              </Text>
              {currentTrack.album && (
                <Text style={styles.expandedTrackAlbum} numberOfLines={1}>
                  {currentTrack.album}
                </Text>
              )}
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
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
              <View style={styles.timeContainer}>
                <Text style={styles.timeText}>{formatTime(progress.position)}</Text>
                <Text style={styles.timeText}>{formatTime(progress.duration)}</Text>
              </View>
            </View>

            {/* Main Controls */}
            <View style={styles.mainControls}>
              <TouchableOpacity style={styles.controlButton}>
                <Ionicons name="shuffle" size={24} color="#6B7280" />
              </TouchableOpacity>

              <TouchableOpacity onPress={skipToPrevious} style={styles.controlButton}>
                <Ionicons name="play-skip-back" size={32} color="#374151" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={togglePlayPause}
                style={[styles.controlButton, styles.playButton]}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="large" color="#fff" />
                ) : (
                  <Ionicons
                    name={isPlaying ? 'pause' : 'play'}
                    size={36}
                    color="#fff"
                  />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={skipToNext} style={styles.controlButton}>
                <Ionicons name="play-skip-forward" size={32} color="#374151" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlButton}>
                <Ionicons name="repeat" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Additional Controls */}
            <View style={styles.additionalControls}>
              <TouchableOpacity style={styles.additionalButton}>
                <Ionicons name="heart-outline" size={24} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.additionalButton}>
                <Ionicons name="share-outline" size={24} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.additionalButton}>
                <Ionicons name="download-outline" size={24} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.additionalButton}>
                <Ionicons name="moon-outline" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  collapsedView: {
    height: COLLAPSED_HEIGHT,
    flexDirection: 'column',
  },
  collapsedContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  trackInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  smallArtwork: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  trackText: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  trackArtist: {
    fontSize: 12,
    color: '#6B7280',
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniControlButton: {
    padding: 8,
  },
  miniProgressBar: {
    height: 2,
    backgroundColor: '#E5E7EB',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
  },
  expandedView: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  collapseButton: {
    padding: 8,
    marginLeft: -8,
  },
  expandedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  expandedHeaderRight: {
    width: 40,
  },
  headerButton: {
    padding: 8,
  },
  artworkContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  largeArtwork: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  placeholderArtwork: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedTrackInfo: {
    alignItems: 'center',
    marginBottom: 30,
  },
  expandedTrackTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  expandedTrackArtist: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 4,
  },
  expandedTrackAlbum: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  progressContainer: {
    marginBottom: 30,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 40,
  },
  controlButton: {
    padding: 12,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
  },
  additionalControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  additionalButton: {
    padding: 12,
  },
});