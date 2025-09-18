import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

interface ScriptEditorProps {
  value: string;
  title: string;
  onChangeScript: (script: string) => void;
  onChangeTitle: (title: string) => void;
}

const SUGGESTED_PROMPTS = [
  {
    title: 'Morning Meditation',
    script:
      'Welcome to your morning meditation. Take a deep breath and begin your day with intention and peace...',
  },
  {
    title: 'Sleep Story',
    script:
      'As you settle into bed, let your mind drift to a peaceful place where worries fade away...',
  },
  {
    title: 'Focus Session',
    script:
      'Clear your mind and prepare to enter a state of deep focus. Let distractions fall away...',
  },
  {
    title: 'Stress Relief',
    script:
      'Release the tension from your body, starting from your head and moving down to your toes...',
  },
];

const MAX_CHARACTERS = 5000;
const WORDS_PER_MINUTE = 150; // Average speaking rate

export default function ScriptEditor({
  value,
  title,
  onChangeScript,
  onChangeTitle,
}: ScriptEditorProps) {
  const [showPrompts, setShowPrompts] = useState(false);
  const characterCount = value.length;
  const progress = useSharedValue(characterCount / MAX_CHARACTERS);

  // Calculate estimated duration
  const estimatedDuration = useMemo(() => {
    const wordCount = value.split(/\s+/).filter((word) => word.length > 0).length;
    const minutes = Math.ceil(wordCount / WORDS_PER_MINUTE);
    return minutes;
  }, [value]);

  const handlePromptSelect = useCallback(
    (prompt: { title: string; script: string }) => {
      onChangeTitle(prompt.title);
      onChangeScript(prompt.script);
      setShowPrompts(false);
    },
    [onChangeScript, onChangeTitle]
  );

  const handleScriptChange = useCallback(
    (text: string) => {
      if (text.length <= MAX_CHARACTERS) {
        onChangeScript(text);
        progress.value = withSpring(text.length / MAX_CHARACTERS);
      }
    },
    [onChangeScript, progress]
  );

  const progressBarStyle = useAnimatedStyle(() => {
    return {
      width: `${progress.value * 100}%`,
    };
  });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Input */}
        <View style={styles.section}>
          <Text style={styles.label}>Track Title</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Enter a title for your track"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={onChangeTitle}
            maxLength={100}
          />
        </View>

        {/* Script Input */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Script</Text>
            <TouchableOpacity
              style={styles.promptButton}
              onPress={() => setShowPrompts(!showPrompts)}
            >
              <Ionicons name="bulb-outline" size={16} color="#7C3AED" />
              <Text style={styles.promptButtonText}>Suggestions</Text>
            </TouchableOpacity>
          </View>

          {showPrompts && (
            <Animated.View entering={FadeIn} style={styles.promptsContainer}>
              {SUGGESTED_PROMPTS.map((prompt, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.promptCard}
                  onPress={() => handlePromptSelect(prompt)}
                >
                  <Text style={styles.promptTitle}>{prompt.title}</Text>
                  <Text style={styles.promptPreview} numberOfLines={2}>
                    {prompt.script}
                  </Text>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          <TextInput
            style={styles.scriptInput}
            placeholder="Write your meditation script here..."
            placeholderTextColor="#9CA3AF"
            value={value}
            onChangeText={handleScriptChange}
            multiline
            numberOfLines={12}
            textAlignVertical="top"
          />

          {/* Character Counter and Progress Bar */}
          <View style={styles.counterContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View style={[styles.progressBar, progressBarStyle]} />
            </View>
            <View style={styles.statsRow}>
              <Text
                style={[
                  styles.counterText,
                  characterCount > MAX_CHARACTERS * 0.9 && styles.counterWarning,
                ]}
              >
                {characterCount} / {MAX_CHARACTERS} characters
              </Text>
              <Text style={styles.durationText}>~{estimatedDuration} min</Text>
            </View>
          </View>
        </View>

        {/* Tips Section */}
        <View style={styles.tipsSection}>
          <View style={styles.tipHeader}>
            <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
            <Text style={styles.tipTitle}>Writing Tips</Text>
          </View>
          <View style={styles.tipsList}>
            <Text style={styles.tipItem}>• Use a calm, conversational tone</Text>
            <Text style={styles.tipItem}>• Include pauses for breathing</Text>
            <Text style={styles.tipItem}>• Keep sentences clear and simple</Text>
            <Text style={styles.tipItem}>• Guide listeners with gentle directions</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  titleInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#0F172A',
    marginTop: 8,
  },
  promptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#EDE9FE',
    borderRadius: 6,
  },
  promptButtonText: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '600',
  },
  promptsContainer: {
    marginBottom: 12,
    gap: 8,
  },
  promptCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  promptTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  promptPreview: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  scriptInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#0F172A',
    minHeight: 250,
    textAlignVertical: 'top',
    lineHeight: 24,
  },
  counterContainer: {
    marginTop: 12,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  counterText: {
    fontSize: 12,
    color: '#6B7280',
  },
  counterWarning: {
    color: '#EF4444',
    fontWeight: '600',
  },
  durationText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  tipsSection: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  tipsList: {
    gap: 6,
  },
  tipItem: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
  },
});