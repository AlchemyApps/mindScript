import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Playlist } from '../stores/playlistStore';
import { Colors, Spacing, Radius, Shadows } from '../lib/constants';

interface PlaylistListProps {
  playlists: Playlist[];
  onPress: (playlist: Playlist) => void;
  onPlay: (playlist: Playlist) => void;
  onCreate: () => void;
}

export default function PlaylistList({
  playlists,
  onPress,
  onPlay,
  onCreate,
}: PlaylistListProps) {
  const renderItem = ({ item, index }: { item: Playlist; index: number }) => (
    <Animated.View entering={FadeIn.duration(300).delay(index * 50)}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => onPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="musical-notes" size={24} color={Colors.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.count}>
            {item.trackIds.length} {item.trackIds.length === 1 ? 'track' : 'tracks'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.playButton}
          onPress={(e) => {
            e.stopPropagation();
            onPlay(item);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <Ionicons name="play" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <FlatList
      data={playlists}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.listContent,
        playlists.length === 0 && styles.listEmpty,
      ]}
      showsVerticalScrollIndicator={false}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <TouchableOpacity
          style={styles.createCard}
          onPress={onCreate}
          activeOpacity={0.7}
        >
          <View style={styles.createIcon}>
            <Ionicons name="add" size={24} color={Colors.primary} />
          </View>
          <Text style={styles.createText}>New Playlist</Text>
        </TouchableOpacity>
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="albums-outline" size={48} color={Colors.gray300} />
          <Text style={styles.emptyTitle}>No playlists yet</Text>
          <Text style={styles.emptySubtitle}>
            Create a playlist to organize your tracks
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: Spacing.lg,
  },
  listEmpty: {
    flex: 1,
  },
  separator: {
    height: 10,
  },

  // Create button
  createCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.softLavender,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.15)',
    borderStyle: 'dashed',
  },
  createIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(108, 99, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Playlist card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.softLavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 3,
  },
  count: {
    fontSize: 13,
    color: Colors.muted,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.gray500,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.gray400,
    marginTop: 4,
  },
});
