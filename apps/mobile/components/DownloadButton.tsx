import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useDownloadTrack } from '../hooks/useDownloadTrack';
import { Colors } from '../lib/constants';

interface DownloadButtonProps {
  trackId: string;
}

export default function DownloadButton({ trackId }: DownloadButtonProps) {
  const { status, progress, startDownload, removeDownload } =
    useDownloadTrack(trackId);

  const rotation = useSharedValue(0);

  useEffect(() => {
    if (status === 'downloading' || status === 'queued') {
      rotation.value = withRepeat(withTiming(360, { duration: 1200 }), -1, false);
    } else {
      rotation.value = 0;
    }
  }, [status, rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const handlePress = () => {
    if (status === 'idle' || status === 'error') {
      startDownload();
    }
  };

  const handleLongPress = () => {
    if (status === 'downloaded') {
      Alert.alert('Remove Download', 'Delete the offline copy of this track?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: removeDownload },
      ]);
    }
  };

  // Downloaded state
  if (status === 'downloaded') {
    return (
      <TouchableOpacity
        onLongPress={handleLongPress}
        style={styles.button}
        activeOpacity={0.7}
      >
        <View style={styles.downloadedBg}>
          <Ionicons name="checkmark" size={16} color={Colors.accent} />
        </View>
      </TouchableOpacity>
    );
  }

  // Downloading state
  if (status === 'downloading' || status === 'queued') {
    return (
      <View style={styles.button}>
        <Animated.View style={spinStyle}>
          <Ionicons
            name="sync-outline"
            size={20}
            color={Colors.primary}
          />
        </Animated.View>
      </View>
    );
  }

  // Idle / error state
  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.button}
      activeOpacity={0.6}
    >
      <Ionicons
        name="cloud-download-outline"
        size={20}
        color={status === 'error' ? Colors.error : Colors.gray400}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadedBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
