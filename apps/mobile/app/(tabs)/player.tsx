import { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { usePlayerStore } from '../../stores/playerStore';
import PlayerControls from '../../components/PlayerControls';
import ProgressBar from '../../components/ProgressBar';
import SleepTimerSheet from '../../components/SleepTimerSheet';
import QueueSheet from '../../components/QueueSheet';
import { Colors, Spacing, Radius, Gradients, Shadows } from '../../lib/constants';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const [showSleepTimer, setShowSleepTimer] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const sleepTimerActive = usePlayerStore((s) => s.sleepTimerActive);

  // Breathing animation for placeholder artwork
  const breathe = useSharedValue(1);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1.04, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [breathe]);

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  const hasArtwork =
    currentTrack?.artwork && typeof currentTrack.artwork === 'string';

  if (!currentTrack) {
    return (
      <LinearGradient
        colors={[...Gradients.calmPurple.colors]}
        start={Gradients.calmPurple.start}
        end={Gradients.calmPurple.end}
        style={[styles.container, { paddingTop: insets.top }]}
      >
        <View style={styles.emptyContainer}>
          <Ionicons
            name="musical-notes-outline"
            size={64}
            color={Colors.gray300}
          />
          <Text style={styles.emptyTitle}>Nothing playing</Text>
          <Text style={styles.emptySubtitle}>
            Choose a track from your library
          </Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[...Gradients.playerDefault.colors]}
      start={Gradients.playerDefault.start}
      end={Gradients.playerDefault.end}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Artwork */}
        <Animated.View
          entering={FadeIn.duration(500)}
          style={styles.artworkContainer}
        >
          {hasArtwork ? (
            <Image
              source={{ uri: currentTrack.artwork as string }}
              style={styles.artwork}
            />
          ) : (
            <Animated.View style={[styles.artworkPlaceholder, breatheStyle]}>
              <View style={styles.artworkPlaceholderInner}>
                <Ionicons
                  name="musical-notes"
                  size={48}
                  color={Colors.primaryLight}
                />
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Track info */}
        <View style={styles.infoSection}>
          <Text style={styles.trackTitle} numberOfLines={2}>
            {currentTrack.title || 'Unknown Track'}
          </Text>
          <Text style={styles.trackArtist}>
            {currentTrack.artist || 'MindScript'}
          </Text>
        </View>

        {/* Progress */}
        <View style={styles.progressSection}>
          <ProgressBar />
        </View>

        {/* Controls */}
        <PlayerControls />

        {/* Speed selector */}
        <View style={styles.speedSection}>
          <Text style={styles.speedLabel}>Speed</Text>
          <View style={styles.speedRow}>
            {SPEED_OPTIONS.map((speed) => (
              <TouchableOpacity
                key={speed}
                style={[
                  styles.speedChip,
                  playbackRate === speed && styles.speedChipActive,
                ]}
                onPress={() => setPlaybackRate(speed)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.speedChipText,
                    playbackRate === speed && styles.speedChipTextActive,
                  ]}
                >
                  {speed}x
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowSleepTimer(true)}
            activeOpacity={0.7}
          >
            <Ionicons
              name="moon-outline"
              size={22}
              color={sleepTimerActive ? Colors.accent : Colors.gray600}
            />
            <Text
              style={[
                styles.actionLabel,
                sleepTimerActive && { color: Colors.accent },
              ]}
            >
              Sleep Timer
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShowQueue(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="list-outline" size={22} color={Colors.gray600} />
            <Text style={styles.actionLabel}>Queue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sheets */}
      {showSleepTimer && (
        <SleepTimerSheet onClose={() => setShowSleepTimer(false)} />
      )}
      {showQueue && <QueueSheet onClose={() => setShowQueue(false)} />}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.gray500,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.gray400,
    marginTop: 6,
  },

  // Artwork
  artworkContainer: {
    width: 220,
    height: 220,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.lg,
  },
  artwork: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.xl,
  },
  artworkPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkPlaceholderInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Track info
  infoSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  trackArtist: {
    fontSize: 15,
    color: Colors.muted,
  },

  // Progress
  progressSection: {
    width: '100%',
    marginBottom: Spacing.sm,
  },

  // Speed
  speedSection: {
    width: '100%',
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  speedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  speedRow: {
    flexDirection: 'row',
    gap: 8,
  },
  speedChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  speedChipActive: {
    backgroundColor: Colors.primary,
  },
  speedChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray600,
  },
  speedChipTextActive: {
    color: '#FFFFFF',
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: Spacing.md,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 11,
    color: Colors.gray600,
    fontWeight: '500',
  },
});
