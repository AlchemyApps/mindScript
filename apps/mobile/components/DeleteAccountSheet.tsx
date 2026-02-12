import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown, Easing } from 'react-native-reanimated';
import { router } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, Radius, Shadows } from '../lib/constants';

const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://mindscript.studio';

interface DeleteAccountSheetProps {
  onClose: () => void;
}

export default function DeleteAccountSheet({ onClose }: DeleteAccountSheetProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);

  const handleDelete = async () => {
    if (!password.trim()) {
      Alert.alert('Password required', 'Please enter your password to confirm.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${WEB_BASE_URL}/api/profile/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          password,
          confirm: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        Alert.alert('Error', data.error ?? 'Failed to delete account');
        return;
      }

      Alert.alert(
        'Account Scheduled for Deletion',
        'Your account will be deleted in 30 days. You can cancel by logging back in.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await signOut();
              onClose();
              router.replace('/');
            },
          },
        ],
      );
    } catch (err) {
      console.error('[DeleteAccount] error:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
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

            <View style={styles.warningIcon}>
              <Ionicons name="warning" size={32} color={Colors.error} />
            </View>

            <Text style={styles.title}>Delete Account</Text>

            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Your account will be scheduled for deletion. After 30 days, all your data
                will be permanently removed. You can cancel anytime by logging back in.
              </Text>
            </View>

            <Text style={styles.label}>Confirm your password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={Colors.gray400}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.deleteButton, loading && styles.deleteButtonDisabled]}
              onPress={handleDelete}
              disabled={loading || !password.trim()}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.deleteButtonText}>Delete My Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}
              disabled={loading}
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
  warningIcon: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.error,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  warningBox: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  warningText: {
    fontSize: 14,
    color: Colors.gray700,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted,
    marginBottom: Spacing.xs,
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
  deleteButton: {
    backgroundColor: Colors.error,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
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
