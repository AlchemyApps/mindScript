import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Colors, Spacing } from '../lib/constants';

interface EmptyLibraryProps {
  isFiltered?: boolean;
}

export default function EmptyLibrary({ isFiltered }: EmptyLibraryProps) {
  const pulse = useSharedValue(0.7);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
    transform: [{ scale: 0.95 + pulse.value * 0.05 }],
  }));

  if (isFiltered) {
    return (
      <View style={styles.container}>
        <Ionicons name="search-outline" size={48} color={Colors.gray300} />
        <Text style={styles.title}>No matches</Text>
        <Text style={styles.subtitle}>
          Try a different search or filter
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, pulseStyle]}>
        <View style={styles.iconOuter}>
          <View style={styles.iconInner}>
            <Ionicons
              name="headset-outline"
              size={40}
              color={Colors.primaryLight}
            />
          </View>
        </View>
      </Animated.View>
      <Text style={styles.title}>No tracks yet</Text>
      <Text style={styles.subtitle}>
        Create your first track at{'\n'}mindscript.com
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  iconOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(108, 99, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.softLavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
