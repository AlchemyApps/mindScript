import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TrackData {
  title: string;
  script: string;
  voice: string;
  recordedVoiceUrl?: string;
  backgroundMusic: string | null;
  frequencyType: 'solfeggio' | 'binaural' | 'none';
  frequencyValue: number;
  gain: number;
}

interface TrackPreviewProps {
  trackData: TrackData;
  onEdit: (stepId: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export default function TrackPreview({
  trackData,
  onEdit,
  onSubmit,
  isSubmitting,
}: TrackPreviewProps) {
  const estimateDuration = () => {
    const wordCount = trackData.script.split(/\s+/).filter((word) => word.length > 0).length;
    const minutes = Math.ceil(wordCount / 150); // 150 words per minute average
    return minutes;
  };

  const estimateRenderTime = () => {
    const baseDuration = estimateDuration();
    // Estimate render time based on duration (roughly 10 seconds per minute of audio)
    return Math.ceil(baseDuration * 10);
  };

  const getVoiceName = () => {
    if (trackData.voice === 'recorded') {
      return 'Your Recording';
    }
    // Capitalize first letter
    return trackData.voice.charAt(0).toUpperCase() + trackData.voice.slice(1);
  };

  const getMusicName = () => {
    if (!trackData.backgroundMusic) {
      return 'No background music';
    }
    // Convert ID to readable name
    return trackData.backgroundMusic.replace(/-/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getFrequencyName = () => {
    if (trackData.frequencyType === 'none') {
      return 'No frequency';
    } else if (trackData.frequencyType === 'solfeggio') {
      return `${trackData.frequencyValue} Hz Solfeggio`;
    } else {
      return `${trackData.frequencyValue.toFixed(1)} Hz Binaural`;
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Ionicons name="checkmark-circle" size={48} color="#10B981" />
        <Text style={styles.title}>Ready to Create</Text>
        <Text style={styles.subtitle}>Review your track details before submitting</Text>
      </View>

      {/* Track Title */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Track Title</Text>
          <TouchableOpacity onPress={() => onEdit('script')}>
            <Ionicons name="pencil" size={20} color="#7C3AED" />
          </TouchableOpacity>
        </View>
        <View style={styles.sectionContent}>
          <Text style={styles.contentText}>{trackData.title || 'Untitled Track'}</Text>
        </View>
      </View>

      {/* Script */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Script</Text>
          <TouchableOpacity onPress={() => onEdit('script')}>
            <Ionicons name="pencil" size={20} color="#7C3AED" />
          </TouchableOpacity>
        </View>
        <View style={styles.sectionContent}>
          <Text style={styles.scriptPreview} numberOfLines={4}>
            {trackData.script}
          </Text>
          <View style={styles.scriptStats}>
            <Text style={styles.statItem}>
              <Ionicons name="document-text-outline" size={14} color="#6B7280" />
              {' '}{trackData.script.length} characters
            </Text>
            <Text style={styles.statItem}>
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              {' '}~{estimateDuration()} minutes
            </Text>
          </View>
        </View>
      </View>

      {/* Voice */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Voice</Text>
          <TouchableOpacity onPress={() => onEdit('voice')}>
            <Ionicons name="pencil" size={20} color="#7C3AED" />
          </TouchableOpacity>
        </View>
        <View style={styles.sectionContent}>
          <View style={styles.voiceInfo}>
            <Ionicons
              name={trackData.voice === 'recorded' ? 'mic' : 'volume-high'}
              size={24}
              color="#7C3AED"
            />
            <Text style={styles.contentText}>{getVoiceName()}</Text>
          </View>
        </View>
      </View>

      {/* Background Music */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Background Music</Text>
          <TouchableOpacity onPress={() => onEdit('music')}>
            <Ionicons name="pencil" size={20} color="#7C3AED" />
          </TouchableOpacity>
        </View>
        <View style={styles.sectionContent}>
          <View style={styles.musicInfo}>
            <Ionicons
              name={trackData.backgroundMusic ? 'musical-notes' : 'volume-off'}
              size={24}
              color={trackData.backgroundMusic ? '#7C3AED' : '#6B7280'}
            />
            <Text style={styles.contentText}>{getMusicName()}</Text>
          </View>
        </View>
      </View>

      {/* Frequency */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Frequency</Text>
          <TouchableOpacity onPress={() => onEdit('frequency')}>
            <Ionicons name="pencil" size={20} color="#7C3AED" />
          </TouchableOpacity>
        </View>
        <View style={styles.sectionContent}>
          <View style={styles.frequencyInfo}>
            <Ionicons
              name={trackData.frequencyType !== 'none' ? 'pulse' : 'close-circle-outline'}
              size={24}
              color={trackData.frequencyType !== 'none' ? '#7C3AED' : '#6B7280'}
            />
            <View>
              <Text style={styles.contentText}>{getFrequencyName()}</Text>
              {trackData.frequencyType !== 'none' && (
                <Text style={styles.gainText}>Volume: {Math.round(trackData.gain * 100)}%</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Estimates */}
      <View style={styles.estimatesCard}>
        <Text style={styles.estimatesTitle}>Processing Estimates</Text>
        <View style={styles.estimateRow}>
          <View style={styles.estimateItem}>
            <Ionicons name="time-outline" size={20} color="#6B7280" />
            <Text style={styles.estimateLabel}>Duration</Text>
            <Text style={styles.estimateValue}>~{estimateDuration()} min</Text>
          </View>
          <View style={styles.estimateItem}>
            <Ionicons name="hourglass-outline" size={20} color="#6B7280" />
            <Text style={styles.estimateLabel}>Render Time</Text>
            <Text style={styles.estimateValue}>~{estimateRenderTime()} sec</Text>
          </View>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={onSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.submitText}>Submitting...</Text>
          </>
        ) : (
          <>
            <Ionicons name="cloud-upload" size={24} color="#fff" />
            <Text style={styles.submitText}>Submit for Rendering</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Info Note */}
      <View style={styles.infoNote}>
        <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
        <Text style={styles.infoText}>
          Your track will be processed and added to your library. You'll receive a notification when it's ready.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    gap: 8,
  },
  contentText: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
  scriptPreview: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  scriptStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  statItem: {
    fontSize: 12,
    color: '#6B7280',
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  musicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  frequencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gainText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  estimatesCard: {
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
    padding: 16,
  },
  estimatesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  estimateItem: {
    alignItems: 'center',
    gap: 4,
  },
  estimateLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  estimateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 16,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
});