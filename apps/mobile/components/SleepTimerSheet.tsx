import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { usePlayerStore } from '../stores/playerStore';
import { Colors, Spacing, Radius, Shadows } from '../lib/constants';

interface SleepTimerSheetProps {
  onClose: () => void;
}

const TIMER_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '60 min', minutes: 60 },
];

export default function SleepTimerSheet({ onClose }: SleepTimerSheetProps) {
  const setSleepTimer = usePlayerStore((s) => s.setSleepTimer);
  const cancelSleepTimer = usePlayerStore((s) => s.cancelSleepTimer);
  const sleepTimerActive = usePlayerStore((s) => s.sleepTimerActive);
  const sleepTimerEndTime = usePlayerStore((s) => s.sleepTimerEndTime);

  const handleSelect = (minutes: number) => {
    setSleepTimer(minutes);
    onClose();
  };

  const handleCancel = () => {
    cancelSleepTimer();
    onClose();
  };

  const remainingMinutes = sleepTimerEndTime
    ? Math.max(0, Math.ceil((sleepTimerEndTime - Date.now()) / 60000))
    : 0;

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop} />
      <Animated.View
        entering={SlideInDown.duration(300).springify().damping(18)}
        style={styles.sheet}
      >
        <Pressable>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          <Text style={styles.title}>Sleep Timer</Text>

          {sleepTimerActive && (
            <View style={styles.activeBanner}>
              <Ionicons name="moon" size={16} color={Colors.accent} />
              <Text style={styles.activeText}>
                Timer active — {remainingMinutes} min remaining
              </Text>
            </View>
          )}

          <View style={styles.optionsGrid}>
            {TIMER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.minutes}
                style={styles.optionButton}
                onPress={() => handleSelect(option.minutes)}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={20} color={Colors.primary} />
                <Text style={styles.optionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {sleepTimerActive && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel Timer</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    ...Shadows.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray200,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.successLight,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    marginBottom: Spacing.md,
  },
  activeText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray700,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: Spacing.md,
  },
  optionButton: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: Colors.softLavender,
    borderRadius: Radius.md,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.muted,
  },
});
