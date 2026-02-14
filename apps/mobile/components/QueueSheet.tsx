import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown, Easing } from 'react-native-reanimated';
import { usePlayerStore, QueueItem } from '../stores/playerStore';
import { Colors, Spacing, Radius, Shadows } from '../lib/constants';

interface QueueSheetProps {
  onClose: () => void;
}

export default function QueueSheet({ onClose }: QueueSheetProps) {
  const queue = usePlayerStore((s) => s.queue);
  const currentTrackIndex = usePlayerStore((s) => s.currentTrackIndex);
  const skipTo = usePlayerStore((s) => s.skipTo);
  const play = usePlayerStore((s) => s.play);

  const handleSelectTrack = async (index: number) => {
    await skipTo(index);
    await play();
  };

  const renderItem = ({ item, index }: { item: QueueItem; index: number }) => {
    const isCurrent = index === currentTrackIndex;
    const hasArtwork = item.artwork && typeof item.artwork === 'string';

    return (
      <TouchableOpacity
        style={[styles.queueItem, isCurrent && styles.queueItemActive]}
        onPress={() => handleSelectTrack(index)}
        activeOpacity={0.7}
      >
        <View style={styles.indexContainer}>
          {isCurrent ? (
            <View style={styles.playingIndicator}>
              <View style={styles.playingDot} />
            </View>
          ) : (
            <Text style={styles.indexText}>{index + 1}</Text>
          )}
        </View>

        {hasArtwork ? (
          <Image
            source={{ uri: item.artwork as string }}
            style={styles.queueThumb}
          />
        ) : (
          <View style={[styles.queueThumb, styles.queueThumbPlaceholder]}>
            <Ionicons name="musical-notes" size={14} color={Colors.primaryLight} />
          </View>
        )}

        <View style={styles.queueInfo}>
          <Text
            style={[styles.queueTitle, isCurrent && styles.queueTitleActive]}
            numberOfLines={1}
          >
            {item.title || 'Unknown'}
          </Text>
          <Text style={styles.queueArtist} numberOfLines={1}>
            {item.artist || 'MindScript'}
          </Text>
        </View>

        <Ionicons name="reorder-three" size={20} color={Colors.gray300} />
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
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          <View style={styles.sheetHeader}>
            <Text style={styles.title}>Queue</Text>
            <Text style={styles.trackCount}>
              {queue.length} {queue.length === 1 ? 'track' : 'tracks'}
            </Text>
          </View>

          <FlatList
            data={queue}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            style={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Queue is empty</Text>
              </View>
            }
          />

          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeText}>Close</Text>
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
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  trackCount: {
    fontSize: 13,
    color: Colors.muted,
  },
  list: {
    maxHeight: 400,
  },
  separator: {
    height: 2,
  },

  // Queue item
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
    gap: Spacing.sm + 2,
  },
  queueItemActive: {
    backgroundColor: 'rgba(108, 99, 255, 0.06)',
  },
  indexContainer: {
    width: 24,
    alignItems: 'center',
  },
  indexText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.gray400,
  },
  playingIndicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  queueThumb: {
    width: 38,
    height: 38,
    borderRadius: 6,
  },
  queueThumbPlaceholder: {
    backgroundColor: Colors.softLavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueInfo: {
    flex: 1,
  },
  queueTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 1,
  },
  queueTitleActive: {
    color: Colors.primary,
  },
  queueArtist: {
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

  // Close
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
