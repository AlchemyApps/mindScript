import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useAuthStore } from '../stores/authStore';
import DeleteAccountSheet from '../components/DeleteAccountSheet';
import { Colors, Spacing, Radius, Shadows } from '../lib/constants';

const WEB_BASE_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://mindscript.studio';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode?.toString() ??
    '1';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          signOut();
          router.replace('/');
        },
      },
    ]);
  };

  const openLink = (path: string) => {
    Linking.openURL(`${WEB_BASE_URL}${path}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Account section */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Ionicons name="mail-outline" size={20} color={Colors.muted} />
            <Text style={styles.rowText}>{user?.email ?? 'Not signed in'}</Text>
          </View>

          <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color={Colors.muted} />
            <Text style={styles.rowText}>Sign Out</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowDeleteAccount(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
            <Text style={[styles.rowText, { color: Colors.error }]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
          </TouchableOpacity>
        </View>

        {/* Legal section */}
        <Text style={styles.sectionLabel}>Legal</Text>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => openLink('/privacy')}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={Colors.muted} />
            <Text style={styles.rowText}>Privacy Policy</Text>
            <Ionicons name="open-outline" size={16} color={Colors.gray300} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={() => openLink('/terms/listener')}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={20} color={Colors.muted} />
            <Text style={styles.rowText}>Terms of Service</Text>
            <Ionicons name="open-outline" size={16} color={Colors.gray300} />
          </TouchableOpacity>
        </View>

        {/* About section */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.section}>
          <View style={styles.row}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.muted} />
            <Text style={styles.rowText}>Version</Text>
            <Text style={styles.rowValue}>
              {appVersion} ({buildNumber})
            </Text>
          </View>

          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL('mailto:support@mindscript.studio')}
            activeOpacity={0.7}
          >
            <Ionicons name="help-circle-outline" size={20} color={Colors.muted} />
            <Text style={styles.rowText}>Support</Text>
            <Ionicons name="open-outline" size={16} color={Colors.gray300} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {showDeleteAccount && (
        <DeleteAccountSheet onClose={() => setShowDeleteAccount(false)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: 4,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.gray100,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  rowValue: {
    fontSize: 14,
    color: Colors.muted,
  },
});
