import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown, Easing } from 'react-native-reanimated';
import { usePlaylistStore, Playlist } from '../stores/playlistStore';
import { useAuthStore } from '../stores/authStore';
import CreatePlaylistSheet from './CreatePlaylistSheet';
import { Colors, Spacing, Radius, Shadows } from '../lib/constants';

interface AddToPlaylistSheetProps {
  trackId: string;
  trackTitle: string;
  onClose: () => void;
}

export default function AddToPlaylistSheet({
  trackId,
  trackTitle,
  onClose,
}: AddToPlaylistSheetProps) {
  const [showCreate, setShowCreate] = useState(false);
  const playlists = usePlaylistStore((s) => s.playlists);
  const addTrackToPlaylist = usePlaylistStore((s) => s.addTrackToPlaylist);
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist);
  const userId = useAuthStore((s) => s.user?.id);

  const handleAdd = async (playlist: Playlist) => {
    if (!userId) return;
    await addTrackToPlaylist(playlist.id, trackId, userId);
    onClose();
  };

  const handleCreateAndAdd = async (title: string) => {
    if (!userId) return;
    const playlist = await createPlaylist(title, userId);
    await addTrackToPlaylist(playlist.id, trackId, userId);
    onClose();
  };

  if (showCreate) {
    return (
      <CreatePlaylistSheet
        onClose={() => setShowCreate(false)}
        onCreate={handleCreateAndAdd}
      />
    );
  }

  const renderItem = ({ item }: { item: Playlist }) => {
    const alreadyAdded = item.trackIds.includes(trackId);
    return (
      <TouchableOpacity
        style={[styles.playlistItem, alreadyAdded && styles.playlistItemDisabled]}
        onPress={() => !alreadyAdded && handleAdd(item)}
        disabled={alreadyAdded}
        activeOpacity={0.7}
      >
        <View style={styles.playlistIcon}>
          <Ionicons name="musical-notes" size={18} color={Colors.primary} />
        </View>
        <View style={styles.playlistInfo}>
          <Text style={styles.playlistTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.playlistCount}>
            {item.trackIds.length} {item.trackIds.length === 1 ? 'track' : 'tracks'}
          </Text>
        </View>
        {alreadyAdded && (
          <Ionicons name="checkmark-circle" size={20} color={Colors.accent} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Animated.View entering={FadeIn.duration(200)} style={styles.backdrop} />
      <Animated.View
        entering={SlideInDown.duration(350).easing(Easing.out(Easing.cubic))}
        style={styles.sheet}
      >
        <Pressable>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          <Text style={styles.title}>Add to Playlist</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {trackTitle}
          </Text>

          <TouchableOpacity
            style={styles.newPlaylistButton}
            onPress={() => setShowCreate(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
            <Text style={styles.newPlaylistText}>New Playlist</Text>
          </TouchableOpacity>

          <FlatList
            data={playlists}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No playlists yet</Text>
              </View>
            }
          />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Animated.View>
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
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '70%',
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
  },
  subtitle: {
    fontSize: 14,
    color: Colors.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  newPlaylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.softLavender,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  newPlaylistText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  list: {
    maxHeight: 300,
  },
  separator: {
    height: 2,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
    gap: Spacing.sm + 2,
  },
  playlistItemDisabled: {
    opacity: 0.5,
  },
  playlistIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: Colors.softLavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistInfo: {
    flex: 1,
  },
  playlistTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  playlistCount: {
    fontSize: 12,
    color: Colors.muted,
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.gray400,
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: Spacing.sm,
  },
  closeText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.muted,
  },
});
