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
import { trackService, LibraryTrack } from '../../services/trackService';
import { downloadService } from '../../services/downloadService';
import TrackCard from '../../components/TrackCard';
import EmptyLibrary from '../../components/EmptyLibrary';
import { Colors, Spacing, Radius, Shadows } from '../../lib/constants';

type FilterMode = 'all' | 'downloaded';

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  const { data: tracks, isLoading, refetch, isRefetching } = useLibraryTracks();
  const { isConnected } = useNetworkStatus();
  const signOut = useAuthStore((s) => s.signOut);
  const setQueue = usePlayerStore((s) => s.setQueue);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const play = usePlayerStore((s) => s.play);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const downloads = useDownloadStore((s) => s.downloads);
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
      // Check for local download first
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

  const renderItem = useCallback(
    ({ item, index }: { item: LibraryTrack; index: number }) => (
      <Animated.View entering={FadeIn.duration(300).delay(index * 50)}>
        <TrackCard
          track={item}
          onPress={() => handlePlayTrack(item)}
          onAddToQueue={queue.length > 0 ? () => handleAddToQueue(item) : undefined}
          isActive={currentTrack?.id === item.id}
        />
      </Animated.View>
    ),
    [handlePlayTrack, handleAddToQueue, currentTrack?.id, queue.length],
  );

  const downloadCount = downloadedIds.length;

  const handleLogout = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  }, [signOut]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
        <TouchableOpacity
          onPress={handleLogout}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="log-out-outline" size={24} color={Colors.muted} />
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
  title: {
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
});
