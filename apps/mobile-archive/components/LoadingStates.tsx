import React from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Full screen loading indicator
export function FullScreenLoader({ message }: { message?: string }) {
  return (
    <View style={styles.fullScreenContainer}>
      <ActivityIndicator size="large" color="#7C3AED" />
      {message && <Text style={styles.loadingMessage}>{message}</Text>}
    </View>
  );
}

// Skeleton loader for list items
export function TrackSkeleton() {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.trackSkeleton, animatedStyle]}>
      <View style={styles.skeletonThumbnail} />
      <View style={styles.skeletonContent}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonDescription} />
        <View style={styles.skeletonMeta} />
      </View>
    </Animated.View>
  );
}

// List skeleton loader
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, index) => (
        <TrackSkeleton key={index} />
      ))}
    </View>
  );
}

// Player skeleton loader
export function PlayerSkeleton() {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.playerSkeleton, animatedStyle]}>
      <View style={styles.playerSkeletonArt} />
      <View style={styles.playerSkeletonInfo}>
        <View style={styles.playerSkeletonTitle} />
        <View style={styles.playerSkeletonArtist} />
      </View>
      <View style={styles.playerSkeletonProgress} />
      <View style={styles.playerSkeletonControls}>
        <View style={styles.playerSkeletonButton} />
        <View style={[styles.playerSkeletonButton, styles.playerSkeletonPlayButton]} />
        <View style={styles.playerSkeletonButton} />
      </View>
    </Animated.View>
  );
}

// Content placeholder
export function ContentPlaceholder({ lines = 3 }: { lines?: number }) {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.contentPlaceholder, animatedStyle]}>
      {Array.from({ length: lines }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.placeholderLine,
            index === lines - 1 && styles.placeholderLineShort,
          ]}
        />
      ))}
    </Animated.View>
  );
}

// Inline loading indicator
export function InlineLoader({ size = 'small' }: { size?: 'small' | 'large' }) {
  return (
    <View style={styles.inlineContainer}>
      <ActivityIndicator
        size={size}
        color="#7C3AED"
      />
    </View>
  );
}

// Pull to refresh indicator
export function RefreshIndicator() {
  return (
    <View style={styles.refreshContainer}>
      <ActivityIndicator size="small" color="#7C3AED" />
      <Text style={styles.refreshText}>Updating...</Text>
    </View>
  );
}

// Download progress indicator
export function DownloadProgress({ progress }: { progress: number }) {
  return (
    <View style={styles.downloadContainer}>
      <View style={styles.downloadBar}>
        <View
          style={[
            styles.downloadProgress,
            { width: `${Math.min(100, Math.max(0, progress * 100))}%` },
          ]}
        />
      </View>
      <Text style={styles.downloadText}>
        {Math.round(progress * 100)}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F8FC',
  },
  loadingMessage: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  listContainer: {
    padding: 20,
  },
  trackSkeleton: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  skeletonThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  skeletonContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  skeletonTitle: {
    height: 18,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    width: '70%',
    marginBottom: 8,
  },
  skeletonDescription: {
    height: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    width: '90%',
    marginBottom: 8,
  },
  skeletonMeta: {
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    width: '30%',
  },
  playerSkeleton: {
    padding: 20,
    alignItems: 'center',
  },
  playerSkeletonArt: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    marginBottom: 30,
  },
  playerSkeletonInfo: {
    alignItems: 'center',
    marginBottom: 30,
  },
  playerSkeletonTitle: {
    height: 24,
    width: 200,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
  },
  playerSkeletonArtist: {
    height: 18,
    width: 150,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  playerSkeletonProgress: {
    height: 4,
    width: '100%',
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 30,
  },
  playerSkeletonControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  playerSkeletonButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  playerSkeletonPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  contentPlaceholder: {
    padding: 16,
  },
  placeholderLine: {
    height: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
    width: '100%',
  },
  placeholderLineShort: {
    width: '60%',
  },
  inlineContainer: {
    padding: 16,
    alignItems: 'center',
  },
  refreshContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  refreshText: {
    fontSize: 14,
    color: '#6B7280',
  },
  downloadContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 12,
  },
  downloadBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  downloadProgress: {
    height: '100%',
    backgroundColor: '#7C3AED',
  },
  downloadText: {
    fontSize: 12,
    color: '#6B7280',
    minWidth: 40,
    textAlign: 'right',
  },
});