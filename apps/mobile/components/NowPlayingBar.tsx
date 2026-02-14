import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { usePlayerStore } from '../stores/playerStore';
import { Colors, Spacing, Radius } from '../lib/constants';

export function NowPlayingBar() {
  const router = useRouter();
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);

  if (!currentTrack) return null;

  const hasArtwork =
    currentTrack.artwork && typeof currentTrack.artwork === 'string';

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutDown.duration(200)}
      style={styles.wrapper}
    >
      <TouchableOpacity
        style={styles.container}
        onPress={() => router.navigate('/(tabs)/player')}
        activeOpacity={0.9}
      >
        {/* Thumbnail */}
        {hasArtwork ? (
          <Image
            source={{ uri: currentTrack.artwork as string }}
            style={styles.thumbnail}
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons name="musical-notes" size={16} color={Colors.primaryLight} />
          </View>
        )}

        {/* Track info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title || 'Unknown'}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist || 'MindScript'}
          </Text>
        </View>

        {/* Play/Pause */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={(e) => {
            e.stopPropagation();
            isPlaying ? pause() : play();
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={22}
            color={Colors.primary}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.glassBg,
    borderRadius: Radius.lg,
    height: 64,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm + 2,
    ...Platform.select({
      ios: {
        shadowColor: '#6C63FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.08)',
  },
  thumbnail: {
    width: 42,
    height: 42,
    borderRadius: Radius.sm,
  },
  thumbnailPlaceholder: {
    backgroundColor: Colors.softLavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 1,
  },
  artist: {
    fontSize: 12,
    color: Colors.muted,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
