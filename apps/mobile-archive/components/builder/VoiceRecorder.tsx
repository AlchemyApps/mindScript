import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import * as FileSystem from 'expo-file-system';

interface VoiceRecorderProps {
  onRecordComplete: (uri: string) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onRecordComplete, onCancel }: VoiceRecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const recordingAnimation = useSharedValue(0);
  const audioLevelAnimation = useSharedValue(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    requestPermissions();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (recording) {
      recordingAnimation.value = withRepeat(
        withTiming(1, { duration: 1000 }),
        -1,
        true
      );
    } else {
      recordingAnimation.value = withTiming(0, { duration: 300 });
    }
  }, [recording]);

  useEffect(() => {
    audioLevelAnimation.value = withSpring(audioLevel, {
      damping: 10,
      stiffness: 100,
    });
  }, [audioLevel]);

  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        setPermissionGranted(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } else {
        Alert.alert(
          'Permission Required',
          'Audio recording permission is required to use this feature.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Failed to get permissions', error);
    }
  };

  const startRecording = async () => {
    if (!permissionGranted) {
      await requestPermissions();
      return;
    }

    try {
      // Stop any playing sound
      if (sound && isPlaying) {
        await sound.stopAsync();
        setIsPlaying(false);
      }

      // Configure audio
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        {
          android: {
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
          },
          ios: {
            extension: '.m4a',
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 2,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
          web: {},
        },
        (status) => {
          if (status.isRecording && status.metering !== undefined) {
            // Normalize audio level to 0-1 range
            const normalizedLevel = Math.max(0, Math.min(1, (status.metering + 60) / 60));
            setAudioLevel(normalizedLevel);
          }
        },
        100 // Update interval in milliseconds
      );

      setRecording(recording);
      setDuration(0);

      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsLoading(true);

      // Clear timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecordedUri(uri);
      setAudioLevel(0);

      // Get file info
      if (uri) {
        const info = await FileSystem.getInfoAsync(uri);
        console.log('Recording saved:', info);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to stop recording', error);
      Alert.alert('Error', 'Failed to stop recording');
      setIsLoading(false);
    }
  };

  const playRecording = async () => {
    if (!recordedUri) return;

    try {
      if (sound && isPlaying) {
        await sound.stopAsync();
        setIsPlaying(false);
      } else {
        // Create or reuse sound object
        let soundObject = sound;
        if (!soundObject) {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: recordedUri },
            { shouldPlay: true }
          );
          soundObject = newSound;
          setSound(soundObject);
        } else {
          await soundObject.replayAsync();
        }

        setIsPlaying(true);

        // Set up playback status listener
        soundObject.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsPlaying(false);
          }
        });
      }
    } catch (error) {
      console.error('Failed to play recording', error);
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  const deleteRecording = async () => {
    if (recordedUri) {
      try {
        await FileSystem.deleteAsync(recordedUri, { idempotent: true });
        setRecordedUri(null);
        setDuration(0);
      } catch (error) {
        console.error('Failed to delete recording', error);
      }
    }
  };

  const handleUseRecording = () => {
    if (recordedUri) {
      onRecordComplete(recordedUri);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const recordButtonStyle = useAnimatedStyle(() => {
    const scale = interpolate(recordingAnimation.value, [0, 1], [1, 1.1]);
    return {
      transform: [{ scale }],
    };
  });

  const waveformStyle = useAnimatedStyle(() => {
    return {
      height: interpolate(audioLevelAnimation.value, [0, 1], [4, 60]),
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Record Your Voice</Text>
        <Text style={styles.subtitle}>
          {recording
            ? 'Recording in progress...'
            : recordedUri
            ? 'Review your recording'
            : 'Tap the microphone to start'}
        </Text>
      </View>

      {/* Waveform Visualization */}
      <View style={styles.waveformContainer}>
        <View style={styles.waveformBars}>
          {[...Array(20)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.waveformBar,
                recording && waveformStyle,
                {
                  opacity: recording ? 1 : 0.3,
                  height: recording ? undefined : 4,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Duration Display */}
      <Text style={styles.duration}>{formatDuration(duration)}</Text>

      {/* Controls */}
      <View style={styles.controls}>
        {!recording && !recordedUri && (
          <TouchableOpacity onPress={startRecording} disabled={isLoading}>
            <Animated.View style={[styles.recordButton, recordButtonStyle]}>
              <Ionicons name="mic" size={40} color="#fff" />
            </Animated.View>
          </TouchableOpacity>
        )}

        {recording && (
          <TouchableOpacity onPress={stopRecording} disabled={isLoading}>
            <View style={styles.stopButton}>
              <Ionicons name="stop" size={30} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {recordedUri && !recording && (
          <View style={styles.playbackControls}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={playRecording}
              disabled={isLoading}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={24}
                color="#7C3AED"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={deleteRecording}
              disabled={isLoading}
            >
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.rerecordButton}
              onPress={async () => {
                await deleteRecording();
                startRecording();
              }}
              disabled={isLoading}
            >
              <Ionicons name="refresh" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {recordedUri && !recording && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.useButton} onPress={handleUseRecording}>
            <Text style={styles.useText}>Use Recording</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  waveformContainer: {
    height: 80,
    width: '100%',
    marginBottom: 30,
    justifyContent: 'center',
  },
  waveformBars: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: '100%',
  },
  waveformBar: {
    width: 4,
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },
  duration: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 40,
  },
  controls: {
    alignItems: 'center',
    marginBottom: 40,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playbackControls: {
    flexDirection: 'row',
    gap: 20,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rerecordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  useButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    alignItems: 'center',
  },
  useText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});