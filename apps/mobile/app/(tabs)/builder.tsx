import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function BuilderScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [script, setScript] = useState('');
  const [voice, setVoice] = useState('alloy');
  const [backgroundMusic, setBackgroundMusic] = useState('none');

  const voices = [
    { id: 'alloy', name: 'Alloy', gender: 'neutral' },
    { id: 'echo', name: 'Echo', gender: 'male' },
    { id: 'fable', name: 'Fable', gender: 'neutral' },
    { id: 'onyx', name: 'Onyx', gender: 'male' },
    { id: 'nova', name: 'Nova', gender: 'female' },
    { id: 'shimmer', name: 'Shimmer', gender: 'female' },
  ];

  const handleCreate = () => {
    if (!title || !script) {
      Alert.alert('Error', 'Please provide a title and script');
      return;
    }

    // TODO: Implement track creation
    Alert.alert('Success', 'Track creation will be implemented');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.title}>Create Track</Text>
        <TouchableOpacity onPress={handleCreate}>
          <Text style={styles.createText}>Create</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter track title"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Script</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter your meditation script..."
            placeholderTextColor="#9CA3AF"
            value={script}
            onChangeText={setScript}
            multiline
            numberOfLines={10}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Voice</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.voiceOptions}>
              {voices.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={[
                    styles.voiceCard,
                    voice === v.id && styles.voiceCardActive,
                  ]}
                  onPress={() => setVoice(v.id)}
                >
                  <Ionicons
                    name={v.gender === 'male' ? 'man' : v.gender === 'female' ? 'woman' : 'person'}
                    size={24}
                    color={voice === v.id ? '#7C3AED' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.voiceName,
                      voice === v.id && styles.voiceNameActive,
                    ]}
                  >
                    {v.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Background Music</Text>
          <View style={styles.musicOptions}>
            <TouchableOpacity
              style={[
                styles.musicCard,
                backgroundMusic === 'none' && styles.musicCardActive,
              ]}
              onPress={() => setBackgroundMusic('none')}
            >
              <Text style={styles.musicText}>None</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.musicCard,
                backgroundMusic === 'calm' && styles.musicCardActive,
              ]}
              onPress={() => setBackgroundMusic('calm')}
            >
              <Text style={styles.musicText}>Calm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.musicCard,
                backgroundMusic === 'nature' && styles.musicCardActive,
              ]}
              onPress={() => setBackgroundMusic('nature')}
            >
              <Text style={styles.musicText}>Nature</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  createText: {
    fontSize: 16,
    color: '#7C3AED',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  textArea: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  voiceOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  voiceCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  voiceCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  voiceName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  voiceNameActive: {
    color: '#7C3AED',
    fontWeight: '600',
  },
  musicOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  musicCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  musicCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  musicText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
});