import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Colors, Gradients } from '../lib/constants';

export default function IndexScreen() {
  const { session, isLoading, isInitialized } = useAuthStore();

  const breathe = useSharedValue(0.85);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [breathe]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: breathe.value,
    transform: [{ scale: breathe.value }],
  }));

  if (!isInitialized || isLoading) {
    return (
      <LinearGradient
        colors={[...Gradients.calmPurple.colors]}
        start={Gradients.calmPurple.start}
        end={Gradients.calmPurple.end}
        style={styles.container}
      >
        <Animated.View style={[styles.logoContainer, pulseStyle]}>
          <View style={styles.logoOrb}>
            <View style={styles.logoInner} />
          </View>
        </Animated.View>
        <ActivityIndicator
          size="small"
          color={Colors.primary}
          style={styles.loader}
        />
      </LinearGradient>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)/library" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOrb: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
  },
  loader: {
    marginTop: 32,
  },
});
