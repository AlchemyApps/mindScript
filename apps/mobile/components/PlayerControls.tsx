import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { usePlayerStore } from '../stores/playerStore';
import { Colors, Spacing, Shadows } from '../lib/constants';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function PlayerControls() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const skipToNext = usePlayerStore((s) => s.skipToNext);
  const skipToPrevious = usePlayerStore((s) => s.skipToPrevious);
  const seekTo = usePlayerStore((s) => s.seekTo);

  const playScale = useSharedValue(1);

  const playAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: playScale.value }],
  }));

  const handlePlayPress = async () => {
    playScale.value = withSpring(0.88, { damping: 15, stiffness: 400 });
    setTimeout(() => {
      playScale.value = withSpring(1, { damping: 12, stiffness: 300 });
    }, 100);

    if (isPlaying) {
      await pause();
    } else {
      await play();
    }
  };

  const handleJumpBack = async () => {
    const { position } = usePlayerStore.getState();
    await seekTo(Math.max(position - 10, 0));
  };

  const handleJumpForward = async () => {
    const { position, duration } = usePlayerStore.getState();
    await seekTo(Math.min(position + 10, duration));
  };

  return (
    <View style={styles.container}>
      {/* Jump back 10s */}
      <TouchableOpacity
        onPress={handleJumpBack}
        style={styles.secondaryButton}
        activeOpacity={0.6}
      >
        <Ionicons name="play-back" size={18} color={Colors.gray600} />
        <Text style={styles.jumpLabel}>10</Text>
      </TouchableOpacity>

      {/* Previous */}
      <TouchableOpacity
        onPress={skipToPrevious}
        style={styles.navButton}
        activeOpacity={0.6}
      >
        <Ionicons name="play-skip-back" size={26} color={Colors.text} />
      </TouchableOpacity>

      {/* Play/Pause */}
      <AnimatedTouchable
        onPress={handlePlayPress}
        style={[styles.playButton, playAnimatedStyle]}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={32}
          color="#FFFFFF"
          style={!isPlaying ? { marginLeft: 3 } : undefined}
        />
      </AnimatedTouchable>

      {/* Next */}
      <TouchableOpacity
        onPress={skipToNext}
        style={styles.navButton}
        activeOpacity={0.6}
      >
        <Ionicons name="play-skip-forward" size={26} color={Colors.text} />
      </TouchableOpacity>

      {/* Jump forward 10s */}
      <TouchableOpacity
        onPress={handleJumpForward}
        style={styles.secondaryButton}
        activeOpacity={0.6}
      >
        <Ionicons name="play-forward" size={18} color={Colors.gray600} />
        <Text style={styles.jumpLabel}>10</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  secondaryButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  jumpLabel: {
    position: 'absolute',
    bottom: 2,
    fontSize: 9,
    fontWeight: '700',
    color: Colors.gray600,
  },
  navButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
});
