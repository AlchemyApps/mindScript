import { View, Text, StyleSheet } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Slider = require('@react-native-community/slider').default;
import { usePlayerStore } from '../stores/playerStore';
import { Colors } from '../lib/constants';

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ProgressBar() {
  const position = usePlayerStore((s) => s.position);
  const duration = usePlayerStore((s) => s.duration);
  const seekTo = usePlayerStore((s) => s.seekTo);

  const remaining = Math.max(duration - position, 0);

  return (
    <View style={styles.container}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration > 0 ? duration : 1}
        value={position}
        onSlidingComplete={(value: number) => seekTo(value)}
        minimumTrackTintColor={Colors.primary}
        maximumTrackTintColor="rgba(108, 99, 255, 0.15)"
        thumbTintColor={Colors.primary}
      />
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{formatTime(position)}</Text>
        <Text style={styles.timeText}>-{formatTime(remaining)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  slider: {
    width: '100%',
    height: 32,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -4,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.muted,
    fontVariant: ['tabular-nums'],
  },
});
