import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import VoiceRecorder from './VoiceRecorder';

interface VoiceSelectorProps {
  selectedVoice: string;
  recordedVoiceUrl?: string;
  onSelectVoice: (voice: string) => void;
  onRecordComplete: (url: string) => void;
}

const TTS_VOICES = [
  { id: 'alloy', name: 'Alloy', gender: 'neutral', accent: 'American', premium: false },
  { id: 'echo', name: 'Echo', gender: 'male', accent: 'American', premium: false },
  { id: 'fable', name: 'Fable', gender: 'neutral', accent: 'British', premium: false },
  { id: 'onyx', name: 'Onyx', gender: 'male', accent: 'American', premium: false },
  { id: 'nova', name: 'Nova', gender: 'female', accent: 'American', premium: false },
  { id: 'shimmer', name: 'Shimmer', gender: 'female', accent: 'American', premium: false },
  { id: 'rachel', name: 'Rachel', gender: 'female', accent: 'American', premium: true },
  { id: 'drew', name: 'Drew', gender: 'male', accent: 'British', premium: true },
  { id: 'clyde', name: 'Clyde', gender: 'male', accent: 'American', premium: true },
  { id: 'paul', name: 'Paul', gender: 'male', accent: 'American', premium: true },
  { id: 'domi', name: 'Domi', gender: 'female', accent: 'American', premium: true },
  { id: 'dave', name: 'Dave', gender: 'male', accent: 'British', premium: true },
];

const SAMPLE_TEXT = "Welcome to MindScript. Take a deep breath and let's begin your journey to peace and relaxation.";

export default function VoiceSelector({
  selectedVoice,
  recordedVoiceUrl,
  onSelectVoice,
  onRecordComplete,
}: VoiceSelectorProps) {
  const [voiceType, setVoiceType] = useState<'tts' | 'recorded'>(
    recordedVoiceUrl ? 'recorded' : 'tts'
  );
  const [showRecorder, setShowRecorder] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  const filteredVoices = TTS_VOICES.filter((voice) => {
    const matchesSearch = voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         voice.accent.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = !filterGender || voice.gender === filterGender;
    return matchesSearch && matchesGender;
  });

  const handleVoiceSelect = useCallback((voiceId: string) => {
    onSelectVoice(voiceId);
    setVoiceType('tts');
  }, [onSelectVoice]);

  const handlePlayVoice = useCallback((voiceId: string) => {
    // In a real implementation, this would call TTS API to play sample
    setPlayingVoice(voiceId);
    setTimeout(() => setPlayingVoice(null), 2000);
  }, []);

  const handleRecordComplete = useCallback((url: string) => {
    onRecordComplete(url);
    setShowRecorder(false);
    setVoiceType('recorded');
  }, [onRecordComplete]);

  const getGenderIcon = (gender: string) => {
    switch (gender) {
      case 'male':
        return 'man';
      case 'female':
        return 'woman';
      default:
        return 'person';
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Voice Type Toggle */}
      <View style={styles.typeToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, voiceType === 'tts' && styles.toggleButtonActive]}
          onPress={() => setVoiceType('tts')}
        >
          <Ionicons
            name="volume-high"
            size={20}
            color={voiceType === 'tts' ? '#7C3AED' : '#6B7280'}
          />
          <Text style={[styles.toggleText, voiceType === 'tts' && styles.toggleTextActive]}>
            Text-to-Speech
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toggleButton, voiceType === 'recorded' && styles.toggleButtonActive]}
          onPress={() => setVoiceType('recorded')}
        >
          <Ionicons
            name="mic"
            size={20}
            color={voiceType === 'recorded' ? '#7C3AED' : '#6B7280'}
          />
          <Text style={[styles.toggleText, voiceType === 'recorded' && styles.toggleTextActive]}>
            Your Voice
          </Text>
        </TouchableOpacity>
      </View>

      {voiceType === 'tts' ? (
        <>
          {/* Search and Filters */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search voices..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Gender Filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, !filterGender && styles.filterChipActive]}
              onPress={() => setFilterGender(null)}
            >
              <Text style={[styles.filterText, !filterGender && styles.filterTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterGender === 'male' && styles.filterChipActive]}
              onPress={() => setFilterGender('male')}
            >
              <Text style={[styles.filterText, filterGender === 'male' && styles.filterTextActive]}>
                Male
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterGender === 'female' && styles.filterChipActive]}
              onPress={() => setFilterGender('female')}
            >
              <Text style={[styles.filterText, filterGender === 'female' && styles.filterTextActive]}>
                Female
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, filterGender === 'neutral' && styles.filterChipActive]}
              onPress={() => setFilterGender('neutral')}
            >
              <Text style={[styles.filterText, filterGender === 'neutral' && styles.filterTextActive]}>
                Neutral
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Voice Grid */}
          <View style={styles.voiceGrid}>
            {filteredVoices.map((voice) => (
              <TouchableOpacity
                key={voice.id}
                style={[
                  styles.voiceCard,
                  selectedVoice === voice.id && styles.voiceCardActive,
                ]}
                onPress={() => handleVoiceSelect(voice.id)}
              >
                {voice.premium && (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="star" size={12} color="#FBBF24" />
                  </View>
                )}

                <View style={styles.voiceAvatar}>
                  <Ionicons
                    name={getGenderIcon(voice.gender) as any}
                    size={32}
                    color={selectedVoice === voice.id ? '#7C3AED' : '#6B7280'}
                  />
                </View>

                <Text
                  style={[styles.voiceName, selectedVoice === voice.id && styles.voiceNameActive]}
                >
                  {voice.name}
                </Text>

                <Text style={styles.voiceAccent}>{voice.accent}</Text>

                <TouchableOpacity
                  style={styles.playButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handlePlayVoice(voice.id);
                  }}
                >
                  <Ionicons
                    name={playingVoice === voice.id ? 'pause-circle' : 'play-circle'}
                    size={24}
                    color="#7C3AED"
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.recordSection}>
          {recordedVoiceUrl ? (
            <View style={styles.recordedCard}>
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              <Text style={styles.recordedTitle}>Voice Recorded</Text>
              <Text style={styles.recordedSubtitle}>
                Your voice has been successfully recorded
              </Text>
              <TouchableOpacity
                style={styles.rerecordButton}
                onPress={() => setShowRecorder(true)}
              >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.rerecordText}>Record Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.recordPrompt}>
              <Ionicons name="mic-circle" size={64} color="#7C3AED" />
              <Text style={styles.recordTitle}>Record Your Voice</Text>
              <Text style={styles.recordSubtitle}>
                Create a personalized meditation with your own voice
              </Text>
              <TouchableOpacity
                style={styles.startRecordButton}
                onPress={() => setShowRecorder(true)}
              >
                <Text style={styles.startRecordText}>Start Recording</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Recording Modal */}
      <Modal
        visible={showRecorder}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRecorder(false)}
      >
        <View style={styles.modalContainer}>
          <VoiceRecorder
            onRecordComplete={handleRecordComplete}
            onCancel={() => setShowRecorder(false)}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
    padding: 20,
  },
  typeToggle: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 4,
    marginBottom: 20,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 6,
  },
  toggleButtonActive: {
    backgroundColor: '#EDE9FE',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#7C3AED',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#0F172A',
  },
  filterRow: {
    marginBottom: 20,
    maxHeight: 40,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  filterText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#7C3AED',
  },
  voiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  voiceCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    position: 'relative',
  },
  voiceCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  premiumBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FEF3C7',
    padding: 4,
    borderRadius: 12,
  },
  voiceAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  voiceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  voiceNameActive: {
    color: '#7C3AED',
  },
  voiceAccent: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  playButton: {
    marginTop: 8,
  },
  recordSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  recordPrompt: {
    alignItems: 'center',
  },
  recordTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
  },
  recordSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  startRecordButton: {
    backgroundColor: '#7C3AED',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  startRecordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  recordedCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
  },
  recordedTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
    marginTop: 16,
    marginBottom: 8,
  },
  recordedSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  rerecordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  rerecordText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
});