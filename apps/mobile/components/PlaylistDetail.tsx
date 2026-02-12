import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { supabase } from '../lib/supabase';
import { usePlaylistStore, Playlist } from '../stores/playlistStore';
import { Colors, Spacing, Radius, Shadows } from '../lib/constants';

interface TrackMeta {
  id: string;
  title: string;
  cover_image_url: string | null;
  duration_seconds: number | null;
}

interface PlaylistDetailProps {
  playlist: Playlist;
  onBack: () => void;
  onPlay: () => void;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlaylistDetail({
  playlist,
  onBack,
  onPlay,
}: PlaylistDetailProps) {
  const [tracks, setTracks] = useState<TrackMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const deletePlaylist = usePlaylistStore((s) => s.deletePlaylist);
  const removeTrackFromPlaylist = usePlaylistStore((s) => s.removeTrackFromPlaylist);
  const updatePlaylistTitle = usePlaylistStore((s) => s.updatePlaylistTitle);

  const fetchTrackMeta = useCallback(async () => {
    if (playlist.trackIds.length === 0) {
      setTracks([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('tracks')
      .select('id, title, cover_image_url, duration_seconds')
      .in('id', playlist.trackIds);

    if (error) {
      console.error('[PlaylistDetail] fetch tracks error:', error);
      setLoading(false);
      return;
    }

    // Maintain playlist order
    const trackMap = new Map((data ?? []).map((t) => [t.id, t as TrackMeta]));
    const ordered = playlist.trackIds
      .map((id) => trackMap.get(id))
      .filter(Boolean) as TrackMeta[];
    setTracks(ordered);
    setLoading(false);
  }, [playlist.trackIds]);

  useEffect(() => {
    fetchTrackMeta();
  }, [fetchTrackMeta]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Playlist',
      `Are you sure you want to delete "${playlist.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePlaylist(playlist.id);
            onBack();
          },
        },
      ],
    );
  };

  const handleRemoveTrack = (trackId: string, trackTitle: string) => {
    Alert.alert(
      'Remove Track',
      `Remove "${trackTitle}" from this playlist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeTrackFromPlaylist(playlist.id, trackId),
        },
      ],
    );
  };

  const handleRename = () => {
    Alert.prompt(
      'Rename Playlist',
      'Enter a new name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          onPress: (newTitle?: string) => {
            if (newTitle?.trim()) {
              updatePlaylistTitle(playlist.id, newTitle.trim());
            }
          },
        },
      ],
      'plain-text',
      playlist.title,
    );
  };

  const renderItem = ({ item, index }: { item: TrackMeta; index: number }) => (
    <Animated.View entering={FadeIn.duration(200).delay(index * 30)}>
      <View style={styles.trackItem}>
        <Text style={styles.trackIndex}>{index + 1}</Text>
        {item.cover_image_url ? (
          <Image source={{ uri: item.cover_image_url }} style={styles.trackThumb} />
        ) : (
          <View style={[styles.trackThumb, styles.trackThumbPlaceholder]}>
            <Ionicons name="musical-notes" size={14} color={Colors.primaryLight} />
          </View>
        )}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.trackDuration}>
            {formatDuration(item.duration_seconds)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => handleRemoveTrack(item.id, item.title)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle-outline" size={20} color={Colors.gray400} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleRename}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="pencil-outline" size={20} color={Colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Playlist info */}
      <View style={styles.playlistInfo}>
        <View style={styles.playlistIcon}>
          <Ionicons name="musical-notes" size={32} color={Colors.primary} />
        </View>
        <Text style={styles.playlistTitle}>{playlist.title}</Text>
        <Text style={styles.playlistCount}>
          {playlist.trackIds.length} {playlist.trackIds.length === 1 ? 'track' : 'tracks'}
        </Text>
      </View>

      {/* Play all button */}
      {playlist.trackIds.length > 0 && (
        <TouchableOpacity
          style={styles.playAllButton}
          onPress={onPlay}
          activeOpacity={0.7}
        >
          <Ionicons name="play" size={18} color="#FFFFFF" />
          <Text style={styles.playAllText}>Play All</Text>
        </TouchableOpacity>
      )}

      {/* Track list */}
      <FlatList
        data={tracks}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No tracks in this playlist yet
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },

  // Playlist info
  playlistInfo: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  playlistIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.softLavender,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  playlistTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  playlistCount: {
    fontSize: 14,
    color: Colors.muted,
  },

  // Play all
  playAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    marginHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: Radius.full,
    marginBottom: Spacing.md,
  },
  playAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Track list
  list: {
    paddingHorizontal: Spacing.lg,
  },
  separator: {
    height: 2,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: Spacing.sm + 2,
  },
  trackIndex: {
    width: 24,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray400,
    textAlign: 'center',
  },
  trackThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  trackThumbPlaceholder: {
    backgroundColor: Colors.softLavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  trackDuration: {
    fontSize: 12,
    color: Colors.muted,
  },

  // Empty
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.gray400,
  },
});
