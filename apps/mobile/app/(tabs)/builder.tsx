import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
} from 'react-native-reanimated';

// Import step components
import ScriptEditor from '../../components/builder/ScriptEditor';
import VoiceSelector from '../../components/builder/VoiceSelector';
import MusicSelector from '../../components/builder/MusicSelector';
import FrequencyControls from '../../components/builder/FrequencyControls';
import TrackPreview from '../../components/builder/TrackPreview';

// Import hooks and services
import { useBuilder } from '../../hooks/useBuilder';
import { saveDraft, loadDraft, clearDraft } from '../../services/draftService';

const STEPS = [
  { id: 'script', label: 'Script', icon: 'document-text' },
  { id: 'voice', label: 'Voice', icon: 'mic' },
  { id: 'music', label: 'Music', icon: 'musical-notes' },
  { id: 'frequency', label: 'Frequency', icon: 'pulse' },
  { id: 'preview', label: 'Review', icon: 'checkmark-circle' },
];

export default function BuilderScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const {
    trackData,
    updateTrackData,
    submitTrack,
    isSubmitting,
    error,
    validateStep,
  } = useBuilder();

  // Load draft on mount
  useEffect(() => {
    loadDraft().then((draft) => {
      if (draft) {
        updateTrackData(draft);
        Alert.alert(
          'Draft Found',
          'Would you like to continue with your saved draft?',
          [
            { text: 'No', onPress: () => clearDraft() },
            { text: 'Yes', style: 'default' },
          ]
        );
      }
    });
  }, []);

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(trackData);
    }, 2000);

    return () => clearTimeout(timer);
  }, [trackData]);

  const handleNext = useCallback(() => {
    if (validateStep(STEPS[currentStep].id)) {
      if (currentStep < STEPS.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    } else {
      Alert.alert('Validation Error', 'Please complete all required fields');
    }
  }, [currentStep, validateStep]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleSubmit = useCallback(async () => {
    try {
      await submitTrack();
      await clearDraft();
      Alert.alert('Success', 'Your track has been submitted for rendering!', [
        { text: 'OK', onPress: () => router.push('/library') },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to submit track');
    }
  }, [submitTrack, router]);

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'script':
        return (
          <ScriptEditor
            value={trackData.script}
            title={trackData.title}
            onChangeScript={(script) => updateTrackData({ script })}
            onChangeTitle={(title) => updateTrackData({ title })}
          />
        );
      case 'voice':
        return (
          <VoiceSelector
            selectedVoice={trackData.voice}
            recordedVoiceUrl={trackData.recordedVoiceUrl}
            onSelectVoice={(voice) => updateTrackData({ voice })}
            onRecordComplete={(url) =>
              updateTrackData({ recordedVoiceUrl: url, voice: 'recorded' })
            }
          />
        );
      case 'music':
        return (
          <MusicSelector
            selectedMusic={trackData.backgroundMusic}
            onSelectMusic={(music) => updateTrackData({ backgroundMusic: music })}
          />
        );
      case 'frequency':
        return (
          <FrequencyControls
            frequencyType={trackData.frequencyType}
            frequencyValue={trackData.frequencyValue}
            gain={trackData.gain}
            onUpdateFrequency={(type, value, gain) =>
              updateTrackData({ frequencyType: type, frequencyValue: value, gain })
            }
          />
        );
      case 'preview':
        return (
          <TrackPreview
            trackData={trackData}
            onEdit={(stepId) => {
              const stepIndex = STEPS.findIndex((s) => s.id === stepId);
              setCurrentStep(stepIndex);
            }}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.title}>Create Track</Text>
        <TouchableOpacity
          onPress={() => saveDraft(trackData)}
          style={styles.saveButton}
        >
          <Text style={styles.saveText}>Save Draft</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressSteps}>
          {STEPS.map((step, index) => (
            <View key={step.id} style={styles.stepWrapper}>
              <TouchableOpacity
                style={[
                  styles.stepCircle,
                  index === currentStep && styles.stepCircleActive,
                  index < currentStep && styles.stepCircleCompleted,
                ]}
                onPress={() => index <= currentStep && setCurrentStep(index)}
                disabled={index > currentStep}
              >
                <Ionicons
                  name={step.icon as any}
                  size={20}
                  color={
                    index === currentStep
                      ? '#7C3AED'
                      : index < currentStep
                      ? '#10B981'
                      : '#9CA3AF'
                  }
                />
              </TouchableOpacity>
              <Text
                style={[
                  styles.stepLabel,
                  index === currentStep && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
              {index < STEPS.length - 1 && (
                <View
                  style={[
                    styles.progressLine,
                    index < currentStep && styles.progressLineCompleted,
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      </View>

      {/* Step Content */}
      <KeyboardAvoidingView
        style={styles.contentContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <Animated.View
          key={currentStep}
          entering={SlideInRight.duration(300)}
          exiting={SlideOutLeft.duration(300)}
          style={styles.stepContent}
        >
          {renderStepContent()}
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Navigation Buttons */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[styles.navButton, currentStep === 0 && styles.navButtonDisabled]}
          onPress={handlePrevious}
          disabled={currentStep === 0}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.navButtonText}>Previous</Text>
        </TouchableOpacity>

        {currentStep === STEPS.length - 1 ? (
          <TouchableOpacity
            style={[styles.navButton, styles.submitButton]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.navButtonText}>
              {isSubmitting ? 'Submitting...' : 'Submit Track'}
            </Text>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.navButton, styles.nextButton]} onPress={handleNext}>
            <Text style={styles.navButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  saveButton: {
    padding: 4,
  },
  saveText: {
    fontSize: 14,
    color: '#7C3AED',
    fontWeight: '600',
  },
  progressContainer: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  stepCircleActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  stepCircleCompleted: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  stepLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  progressLine: {
    position: 'absolute',
    top: 22,
    left: '50%',
    width: '100%',
    height: 2,
    backgroundColor: '#E5E7EB',
    zIndex: -1,
  },
  progressLineCompleted: {
    backgroundColor: '#10B981',
  },
  contentContainer: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7280',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  nextButton: {
    backgroundColor: '#7C3AED',
  },
  submitButton: {
    backgroundColor: '#10B981',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});