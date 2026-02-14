import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLibraryTracks } from '../../hooks/useLibraryTracks';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { usePlayerStore, QueueItem } from '../../stores/playerStore';
import { useAuthStore } from '../../stores/authStore';
import { useDownloadStore } from '../../stores/downloadStore';
import { usePlaylistStore, Playlist } from '../../stores/playlistStore';
import { trackService, LibraryTrack } from '../../services/trackService';
import { downloadService } from '../../services/downloadService';
import TrackCard from '../../components/TrackCard';
import EmptyLibrary from '../../components/EmptyLibrary';
import PlaylistList from '../../components/PlaylistList';
import PlaylistDetail from '../../components/PlaylistDetail';
import CreatePlaylistSheet from '../../components/CreatePlaylistSheet';
import AddToPlaylistSheet from '../../components/AddToPlaylistSheet';
import { Colors, Spacing, Radius, Shadows } from '../../lib/constants';

type FilterMode = 'all' | 'downloaded';
type LibraryTab = 'tracks' | 'playlists';

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [activeTab, setActiveTab] = useState<LibraryTab>('tracks');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [addToPlaylistTrack, setAddToPlaylistTrack] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const { data: tracks, isLoading, refetch, isRefetching } = useLibraryTracks();
  const { isConnected } = useNetworkStatus();
  const userId = useAuthStore((s) => s.user?.id);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const play = usePlayerStore((s) => s.play);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const downloads = useDownloadStore((s) => s.downloads);
  const playlists = usePlaylistStore((s) => s.playlists);
  const createPlaylist = usePlaylistStore((s) => s.createPlaylist);
  const playPlaylist = usePlaylistStore((s) => s.playPlaylist);

  const downloadedIds = useMemo(
    () =>
      Object.entries(downloads)
        .filter(([, dl]) => dl.status === 'downloaded')
        .map(([id]) => id),
    [downloads],
  );

  const filteredTracks = useMemo(() => {
    let result = tracks ?? [];

    if (filter === 'downloaded') {
      result = result.filter((t) => downloadedIds.includes(t.id));
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [tracks, filter, search, downloadedIds]);

  const handlePlayTrack = useCallback(
    async (track: LibraryTrack) => {
      const localUri = downloadService.getLocalAudioUri(track.id);
      let audioUrl = localUri;

      if (!audioUrl) {
        audioUrl = await trackService.getSignedAudioUrl(track.id);
      }
      if (!audioUrl) {
        Alert.alert(
          'Audio unavailable',
          'This track\'s audio file is not available yet. It may still be rendering.',
        );
        return;
      }

      const queueItem: QueueItem = {
        id: track.id,
        url: audioUrl,
        title: track.title,
        artist: 'MindScript',
        artwork: track.cover_image_url ?? undefined,
        duration: track.duration_seconds ?? 0,
        mindscriptId: track.id,
        isDownloaded: !!localUri,
        localPath: localUri ?? undefined,
      };

      await setQueue([queueItem]);
      await play();
      router.navigate('/(tabs)/player');
    },
    [setQueue, play],
  );

  const handleAddToQueue = useCallback(
    async (track: LibraryTrack) => {
      const localUri = downloadService.getLocalAudioUri(track.id);
      let audioUrl = localUri;

      if (!audioUrl) {
        audioUrl = await trackService.getSignedAudioUrl(track.id);
      }
      if (!audioUrl) {
        Alert.alert('Audio unavailable', 'This track cannot be added to the queue.');
        return;
      }

      const queueItem: QueueItem = {
        id: track.id,
        url: audioUrl,
        title: track.title,
        artist: 'MindScript',
        artwork: track.cover_image_url ?? undefined,
        duration: track.duration_seconds ?? 0,
        mindscriptId: track.id,
        isDownloaded: !!localUri,
        localPath: localUri ?? undefined,
      };

      await addToQueue(queueItem);
      Alert.alert('Added to Queue', `"${track.title}" added to queue.`);
    },
    [addToQueue],
  );

  const handleLongPressTrack = useCallback((track: LibraryTrack) => {
    setAddToPlaylistTrack({ id: track.id, title: track.title });
  }, []);

  const handleCreatePlaylist = useCallback(
    async (title: string) => {
      if (!userId) return;
      await createPlaylist(title, userId);
    },
    [createPlaylist, userId],
  );

  const handlePlayPlaylist = useCallback(
    async (playlist: Playlist) => {
      await playPlaylist(playlist.id);
      router.navigate('/(tabs)/player');
    },
    [playPlaylist],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: LibraryTrack; index: number }) => (
      <Animated.View entering={FadeIn.duration(300).delay(index * 50)}>
        <TrackCard
          track={item}
          onPress={() => handlePlayTrack(item)}
          onAddToQueue={queue.length > 0 ? () => handleAddToQueue(item) : undefined}
          onLongPress={() => handleLongPressTrack(item)}
          isActive={currentTrack?.id === item.id}
        />
      </Animated.View>
    ),
    [handlePlayTrack, handleAddToQueue, handleLongPressTrack, currentTrack?.id, queue.length],
  );

  const downloadCount = downloadedIds.length;

  // If viewing a specific playlist detail
  if (selectedPlaylist) {
    // Re-read from store so it updates on mutations
    const current = playlists.find((p) => p.id === selectedPlaylist.id);
    if (!current) {
      setSelectedPlaylist(null);
      return null;
    }
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <PlaylistDetail
          playlist={current}
          onBack={() => setSelectedPlaylist(null)}
          onPlay={() => handlePlayPlaylist(current)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Library</Text>
        <TouchableOpacity
          onPress={() => router.push('/settings')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={24} color={Colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Offline banner */}
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={16} color={Colors.warning} />
          <Text style={styles.offlineText}>
            You&apos;re offline. Downloaded tracks are still available.
          </Text>
        </View>
      )}

      {/* Tab toggle: Tracks / Playlists */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'tracks' && styles.tabChipActive]}
          onPress={() => setActiveTab('tracks')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabChipText,
              activeTab === 'tracks' && styles.tabChipTextActive,
            ]}
          >
            Tracks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'playlists' && styles.tabChipActive]}
          onPress={() => setActiveTab('playlists')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabChipText,
              activeTab === 'playlists' && styles.tabChipTextActive,
            ]}
          >
            Playlists
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'tracks' ? (
        <>
          {/* Search bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={Colors.gray400} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search your tracks..."
                placeholderTextColor={Colors.gray400}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={Colors.gray400} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filter toggles */}
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
              onPress={() => setFilter('all')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'all' && styles.filterChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterChip,
                filter === 'downloaded' && styles.filterChipActive,
              ]}
              onPress={() => setFilter('downloaded')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="arrow-down-circle"
                size={14}
                color={filter === 'downloaded' ? '#FFFFFF' : Colors.muted}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.filterChipText,
                  filter === 'downloaded' && styles.filterChipTextActive,
                ]}
              >
                Downloaded{downloadCount > 0 ? ` (${downloadCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Track list */}
          <FlatList
            data={filteredTracks}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              filteredTracks.length === 0 && styles.listEmpty,
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
            ListEmptyComponent={
              isLoading ? null : (
                <EmptyLibrary
                  isFiltered={filter === 'downloaded' || search.length > 0}
                />
              )
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </>
      ) : (
        <View style={styles.playlistContainer}>
          <PlaylistList
            playlists={playlists}
            onPress={(playlist) => setSelectedPlaylist(playlist)}
            onPlay={handlePlayPlaylist}
            onCreate={() => setShowCreatePlaylist(true)}
          />
        </View>
      )}

      {/* Sheets */}
      {showCreatePlaylist && (
        <CreatePlaylistSheet
          onClose={() => setShowCreatePlaylist(false)}
          onCreate={handleCreatePlaylist}
        />
      )}
      {addToPlaylistTrack && (
        <AddToPlaylistSheet
          trackId={addToPlaylistTrack.id}
          trackTitle={addToPlaylistTrack.title}
          onClose={() => setAddToPlaylistTrack(null)}
        />
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
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },

  // Offline
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warningLight,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.sm,
    gap: 8,
  },
  offlineText: {
    fontSize: 12,
    color: Colors.gray700,
    flex: 1,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  tabChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  tabChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.muted,
  },
  tabChipTextActive: {
    color: '#FFFFFF',
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    gap: 8,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },

  // Filters
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.muted,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  listEmpty: {
    flex: 1,
  },
  separator: {
    height: 10,
  },

  // Playlist container
  playlistContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
});
