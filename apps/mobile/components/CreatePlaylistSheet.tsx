import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeIn, SlideInDown, Easing } from 'react-native-reanimated';
import { Colors, Spacing, Radius, Shadows } from '../lib/constants';

interface CreatePlaylistSheetProps {
  onClose: () => void;
  onCreate: (title: string) => void;
}

export default function CreatePlaylistSheet({
  onClose,
  onCreate,
}: CreatePlaylistSheetProps) {
  const [title, setTitle] = useState('');

  const handleCreate = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    onClose();
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <Animated.View
          entering={SlideInDown.duration(350).easing(Easing.out(Easing.cubic))}
          style={styles.sheet}
        >
          <Pressable>
            <View style={styles.handleContainer}>
              <View style={styles.handle} />
            </View>

            <Text style={styles.title}>New Playlist</Text>

            <TextInput
              style={styles.input}
              placeholder="Playlist name"
              placeholderTextColor={Colors.gray400}
              value={title}
              onChangeText={setTitle}
              autoFocus
              maxLength={255}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            <TouchableOpacity
              style={[styles.createButton, !title.trim() && styles.createButtonDisabled]}
              onPress={handleCreate}
              disabled={!title.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    ...Shadows.lg,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gray200,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  input: {
    backgroundColor: Colors.gray50,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.gray200,
    marginBottom: Spacing.md,
  },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.muted,
  },
});
