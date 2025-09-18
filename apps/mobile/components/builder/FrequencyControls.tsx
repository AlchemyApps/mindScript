import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface FrequencyControlsProps {
  frequencyType: 'solfeggio' | 'binaural' | 'none';
  frequencyValue: number;
  gain: number;
  onUpdateFrequency: (type: 'solfeggio' | 'binaural' | 'none', value: number, gain: number) => void;
}

const SOLFEGGIO_FREQUENCIES = [
  { value: 174, name: '174 Hz', description: 'Pain relief & stress reduction' },
  { value: 285, name: '285 Hz', description: 'Tissue healing & restoration' },
  { value: 396, name: '396 Hz', description: 'Release fear & guilt' },
  { value: 417, name: '417 Hz', description: 'Facilitate change & undo situations' },
  { value: 528, name: '528 Hz', description: 'DNA repair & miracles' },
  { value: 639, name: '639 Hz', description: 'Harmonize relationships' },
  { value: 741, name: '741 Hz', description: 'Awakening intuition' },
  { value: 852, name: '852 Hz', description: 'Return to spiritual order' },
  { value: 963, name: '963 Hz', description: 'Divine consciousness' },
];

const BINAURAL_BEATS = [
  { value: 0.5, name: 'Delta (0.5-4 Hz)', range: '0.5-4', description: 'Deep sleep, healing' },
  { value: 4, name: 'Theta (4-8 Hz)', range: '4-8', description: 'Meditation, creativity' },
  { value: 10, name: 'Alpha (8-14 Hz)', range: '8-14', description: 'Relaxation, focus' },
  { value: 18, name: 'Beta (14-30 Hz)', range: '14-30', description: 'Alertness, concentration' },
  { value: 40, name: 'Gamma (30-100 Hz)', range: '30-100', description: 'Higher processing' },
];

export default function FrequencyControls({
  frequencyType,
  frequencyValue,
  gain,
  onUpdateFrequency,
}: FrequencyControlsProps) {
  const [showEducation, setShowEducation] = useState(false);
  const [selectedBinauralPreset, setSelectedBinauralPreset] = useState<number | null>(null);

  const handleTypeChange = useCallback((type: 'solfeggio' | 'binaural' | 'none') => {
    let defaultValue = 0;
    if (type === 'solfeggio') {
      defaultValue = 528; // Default to 528 Hz
    } else if (type === 'binaural') {
      defaultValue = 10; // Default to Alpha waves
    }
    onUpdateFrequency(type, defaultValue, gain);
  }, [gain, onUpdateFrequency]);

  const handleFrequencyChange = useCallback((value: number) => {
    onUpdateFrequency(frequencyType, value, gain);
  }, [frequencyType, gain, onUpdateFrequency]);

  const handleGainChange = useCallback((value: number) => {
    onUpdateFrequency(frequencyType, frequencyValue, value);
  }, [frequencyType, frequencyValue, onUpdateFrequency]);

  const getBinauralRange = (value: number) => {
    const preset = BINAURAL_BEATS.find((b) => {
      const [min, max] = b.range.split('-').map(Number);
      return value >= min && value <= max;
    });
    return preset || BINAURAL_BEATS[2]; // Default to Alpha
  };

  const renderFrequencyVisual = () => {
    if (frequencyType === 'none') return null;

    const waveCount = frequencyType === 'solfeggio' ?
      Math.min(10, Math.floor(frequencyValue / 100)) :
      Math.min(5, Math.floor(frequencyValue / 10) + 1);

    return (
      <View style={styles.visualContainer}>
        <View style={styles.waveform}>
          {[...Array(waveCount)].map((_, i) => (
            <Animated.View
              key={i}
              entering={FadeIn.delay(i * 50)}
              style={[
                styles.waveLine,
                {
                  height: 20 + (i % 2) * 20,
                  opacity: 0.3 + (gain * 0.7),
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.frequencyDisplay}>
          {frequencyType === 'solfeggio' ? `${frequencyValue} Hz` : `${frequencyValue.toFixed(1)} Hz`}
        </Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Type Selection */}
      <View style={styles.typeSelection}>
        <TouchableOpacity
          style={[styles.typeCard, frequencyType === 'none' && styles.typeCardActive]}
          onPress={() => handleTypeChange('none')}
        >
          <Ionicons
            name="close-circle-outline"
            size={32}
            color={frequencyType === 'none' ? '#7C3AED' : '#6B7280'}
          />
          <Text style={[styles.typeTitle, frequencyType === 'none' && styles.typeTitleActive]}>
            No Frequency
          </Text>
          <Text style={styles.typeDescription}>Pure audio only</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeCard, frequencyType === 'solfeggio' && styles.typeCardActive]}
          onPress={() => handleTypeChange('solfeggio')}
        >
          <Ionicons
            name="radio-outline"
            size={32}
            color={frequencyType === 'solfeggio' ? '#7C3AED' : '#6B7280'}
          />
          <Text style={[styles.typeTitle, frequencyType === 'solfeggio' && styles.typeTitleActive]}>
            Solfeggio
          </Text>
          <Text style={styles.typeDescription}>Ancient healing tones</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeCard, frequencyType === 'binaural' && styles.typeCardActive]}
          onPress={() => handleTypeChange('binaural')}
        >
          <Ionicons
            name="pulse-outline"
            size={32}
            color={frequencyType === 'binaural' ? '#7C3AED' : '#6B7280'}
          />
          <Text style={[styles.typeTitle, frequencyType === 'binaural' && styles.typeTitleActive]}>
            Binaural
          </Text>
          <Text style={styles.typeDescription}>Brainwave entrainment</Text>
        </TouchableOpacity>
      </View>

      {/* Educational Info Toggle */}
      <TouchableOpacity
        style={styles.educationToggle}
        onPress={() => setShowEducation(!showEducation)}
      >
        <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
        <Text style={styles.educationToggleText}>
          {showEducation ? 'Hide' : 'Learn about'} frequency therapy
        </Text>
        <Ionicons
          name={showEducation ? 'chevron-up' : 'chevron-down'}
          size={20}
          color="#6B7280"
        />
      </TouchableOpacity>

      {showEducation && (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.educationCard}>
          <Text style={styles.educationTitle}>
            {frequencyType === 'solfeggio' ? 'Solfeggio Frequencies' :
             frequencyType === 'binaural' ? 'Binaural Beats' : 'Frequency Therapy'}
          </Text>
          <Text style={styles.educationText}>
            {frequencyType === 'solfeggio' ?
              'Solfeggio frequencies are ancient musical tones believed to have healing properties. Each frequency resonates with different aspects of mind, body, and spirit.' :
             frequencyType === 'binaural' ?
              'Binaural beats create an auditory illusion by playing slightly different frequencies in each ear. Your brain perceives a third tone that can influence brainwave patterns.' :
              'Sound frequencies can influence mental states and potentially promote relaxation, focus, or healing through resonance and entrainment.'}
          </Text>
        </Animated.View>
      )}

      {/* Frequency Visual */}
      {renderFrequencyVisual()}

      {/* Solfeggio Selection */}
      {frequencyType === 'solfeggio' && (
        <Animated.View entering={FadeIn} style={styles.frequencySection}>
          <Text style={styles.sectionTitle}>Select Frequency</Text>
          <View style={styles.solfeggioGrid}>
            {SOLFEGGIO_FREQUENCIES.map((freq) => (
              <TouchableOpacity
                key={freq.value}
                style={[
                  styles.solfeggioCard,
                  frequencyValue === freq.value && styles.solfeggioCardActive,
                ]}
                onPress={() => handleFrequencyChange(freq.value)}
              >
                <Text
                  style={[
                    styles.solfeggioValue,
                    frequencyValue === freq.value && styles.solfeggioValueActive,
                  ]}
                >
                  {freq.name}
                </Text>
                <Text style={styles.solfeggioDescription} numberOfLines={2}>
                  {freq.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Binaural Controls */}
      {frequencyType === 'binaural' && (
        <Animated.View entering={FadeIn} style={styles.frequencySection}>
          <Text style={styles.sectionTitle}>Brainwave Type</Text>
          <View style={styles.binauralPresets}>
            {BINAURAL_BEATS.map((beat) => (
              <TouchableOpacity
                key={beat.value}
                style={[
                  styles.binauralCard,
                  getBinauralRange(frequencyValue).value === beat.value && styles.binauralCardActive,
                ]}
                onPress={() => {
                  handleFrequencyChange(beat.value);
                  setSelectedBinauralPreset(beat.value);
                }}
              >
                <Text
                  style={[
                    styles.binauralName,
                    getBinauralRange(frequencyValue).value === beat.value && styles.binauralNameActive,
                  ]}
                >
                  {beat.name}
                </Text>
                <Text style={styles.binauralDescription}>{beat.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sliderSection}>
            <Text style={styles.sliderLabel}>Fine Tune Frequency</Text>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderValue}>0.5 Hz</Text>
              <Slider
                style={styles.slider}
                value={frequencyValue}
                onValueChange={handleFrequencyChange}
                minimumValue={0.5}
                maximumValue={50}
                step={0.5}
                minimumTrackTintColor="#7C3AED"
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor="#7C3AED"
              />
              <Text style={styles.sliderValue}>50 Hz</Text>
            </View>
            <Text style={styles.currentValue}>{frequencyValue.toFixed(1)} Hz</Text>
          </View>
        </Animated.View>
      )}

      {/* Gain Control */}
      {frequencyType !== 'none' && (
        <Animated.View entering={FadeIn} style={styles.gainSection}>
          <Text style={styles.sectionTitle}>Volume Level</Text>
          <View style={styles.gainLevels}>
            <TouchableOpacity
              style={[styles.gainLevel, gain <= 0.3 && styles.gainLevelActive]}
              onPress={() => handleGainChange(0.3)}
            >
              <Ionicons
                name="volume-low"
                size={24}
                color={gain <= 0.3 ? '#7C3AED' : '#6B7280'}
              />
              <Text style={[styles.gainText, gain <= 0.3 && styles.gainTextActive]}>
                Subtle
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.gainLevel, gain > 0.3 && gain <= 0.6 && styles.gainLevelActive]}
              onPress={() => handleGainChange(0.5)}
            >
              <Ionicons
                name="volume-medium"
                size={24}
                color={gain > 0.3 && gain <= 0.6 ? '#7C3AED' : '#6B7280'}
              />
              <Text style={[styles.gainText, gain > 0.3 && gain <= 0.6 && styles.gainTextActive]}>
                Balanced
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.gainLevel, gain > 0.6 && styles.gainLevelActive]}
              onPress={() => handleGainChange(0.8)}
            >
              <Ionicons
                name="volume-high"
                size={24}
                color={gain > 0.6 ? '#7C3AED' : '#6B7280'}
              />
              <Text style={[styles.gainText, gain > 0.6 && styles.gainTextActive]}>
                Prominent
              </Text>
            </TouchableOpacity>
          </View>

          <Slider
            style={styles.gainSlider}
            value={gain}
            onValueChange={handleGainChange}
            minimumValue={0.1}
            maximumValue={1}
            step={0.1}
            minimumTrackTintColor="#7C3AED"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#7C3AED"
          />
          <Text style={styles.gainValue}>{Math.round(gain * 100)}% Volume</Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
    padding: 20,
  },
  typeSelection: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  typeCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 4,
  },
  typeTitleActive: {
    color: '#7C3AED',
  },
  typeDescription: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  educationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 16,
  },
  educationToggleText: {
    fontSize: 14,
    color: '#6B7280',
  },
  educationCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  educationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  educationText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  visualContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 60,
    marginBottom: 12,
  },
  waveLine: {
    width: 4,
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },
  frequencyDisplay: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#7C3AED',
  },
  frequencySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  solfeggioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  solfeggioCard: {
    width: '31%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  solfeggioCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  solfeggioValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  solfeggioValueActive: {
    color: '#7C3AED',
  },
  solfeggioDescription: {
    fontSize: 10,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 14,
  },
  binauralPresets: {
    gap: 8,
  },
  binauralCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  binauralCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  binauralName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  binauralNameActive: {
    color: '#7C3AED',
  },
  binauralDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  sliderSection: {
    marginTop: 16,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    fontSize: 12,
    color: '#6B7280',
  },
  currentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    textAlign: 'center',
    marginTop: 4,
  },
  gainSection: {
    marginBottom: 24,
  },
  gainLevels: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  gainLevel: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  gainLevelActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  gainText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  gainTextActive: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  gainSlider: {
    height: 40,
  },
  gainValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
    textAlign: 'center',
    marginTop: 4,
  },
});