import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, Radius, Shadows } from '../../lib/constants';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const { signIn, isLoading, error, clearError, session } = useAuthStore();

  // Navigate to library when session is set (after successful sign-in)
  useEffect(() => {
    if (session) {
      router.replace('/(tabs)/library');
    }
  }, [session]);

  const breatheScale = useSharedValue(1);
  const breatheOpacity = useSharedValue(0.6);

  useEffect(() => {
    breatheScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    breatheOpacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [breatheScale, breatheOpacity]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breatheScale.value }],
    opacity: breatheOpacity.value,
  }));

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) return;
    clearError();
    try {
      await signIn(email.trim(), password);
    } catch {
      // Error handled by store
    }
  };

  return (
    <LinearGradient
      colors={['#EDE9FE', '#E8E4FD', '#F7F8FC']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.gradient}
    >
      <Pressable style={styles.gradient} onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          {/* Breathing orb background decoration */}
          <Animated.View style={[styles.orbOuter, orbStyle]}>
            <View style={styles.orbMiddle}>
              <View style={styles.orbCore} />
            </View>
          </Animated.View>

          {/* Brand section */}
          <Animated.View
            entering={FadeInDown.duration(700).delay(100)}
            style={styles.brandSection}
          >
            <View style={styles.logoMark}>
              <View style={styles.logoDot} />
            </View>
            <Text style={styles.brandName}>MindScript</Text>
            <Text style={styles.tagline}>Your inner voice, amplified</Text>
          </Animated.View>

          {/* Form section */}
          <Animated.View
            entering={FadeInDown.duration(700).delay(300)}
            style={styles.formSection}
          >
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  emailFocused && styles.inputFocused,
                ]}
                placeholder="you@example.com"
                placeholderTextColor={Colors.gray400}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setEmailFocused(true)}
                onBlur={() => setEmailFocused(false)}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={[
                  styles.input,
                  passwordFocused && styles.inputFocused,
                ]}
                placeholder="Enter your password"
                placeholderTextColor={Colors.gray400}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                editable={!isLoading}
                onSubmitEditing={handleSignIn}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.signInButton,
                (!email.trim() || !password.trim()) && styles.signInDisabled,
              ]}
              onPress={handleSignIn}
              disabled={isLoading || !email.trim() || !password.trim()}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.signInText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.duration(700).delay(500)}
            style={styles.footerText}
          >
            Sign in with your mindscript.com account
          </Animated.Text>
        </KeyboardAvoidingView>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg + 8,
  },

  // Breathing orb
  orbOuter: {
    position: 'absolute',
    top: '12%',
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbMiddle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbCore: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(108, 99, 255, 0.14)',
  },

  // Brand
  brandSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  logoDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  brandName: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.8,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 15,
    color: Colors.muted,
    letterSpacing: 0.2,
  },

  // Form
  formSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    ...Shadows.md,
  },
  errorBanner: {
    backgroundColor: Colors.errorLight,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gray600,
    marginBottom: 6,
    marginLeft: 2,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  inputFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: '#FEFEFF',
  },
  signInButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadows.sm,
  },
  signInDisabled: {
    opacity: 0.5,
  },
  signInText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.1,
  },

  // Footer
  footerText: {
    textAlign: 'center',
    marginTop: Spacing.lg,
    fontSize: 13,
    color: Colors.gray400,
  },
});
