import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LibraryTrack } from '../services/trackService';
import DownloadButton from './DownloadButton';
import { Colors, Spacing, Radius, Shadows } from '../lib/constants';

interface TrackCardProps {
  track: LibraryTrack;
  onPress: () => void;
  onAddToQueue?: () => void;
  isActive?: boolean;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackCard({ track, onPress, onAddToQueue, isActive }: TrackCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.cardActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {track.cover_image_url ? (
          <Image
            source={{ uri: track.cover_image_url }}
            style={styles.thumbnail}
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons
              name="musical-notes"
              size={20}
              color={Colors.primaryLight}
            />
          </View>
        )}
        {isActive && (
          <View style={styles.activeIndicator}>
            <View style={styles.activeDot} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.title, isActive && styles.titleActive]} numberOfLines={1}>
          {track.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.duration}>
            {formatDuration(track.duration_seconds)}
          </Text>
          {track.play_count > 0 && (
            <>
              <View style={styles.dot} />
              <Text style={styles.plays}>
                {track.play_count} {track.play_count === 1 ? 'play' : 'plays'}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Add to queue */}
      {onAddToQueue && (
        <TouchableOpacity
          style={styles.queueButton}
          onPress={(e) => {
            e.stopPropagation();
            onAddToQueue();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.6}
        >
          <Ionicons name="list-outline" size={18} color={Colors.muted} />
        </TouchableOpacity>
      )}

      {/* Download button */}
      <DownloadButton trackId={track.id} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  cardActive: {
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.15)',
  },

  // Thumbnail
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
  },
  thumbnailPlaceholder: {
    backgroundColor: Colors.softLavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },

  // Info
  info: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 3,
  },
  titleActive: {
    color: Colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  duration: {
    fontSize: 12,
    color: Colors.muted,
    fontWeight: '500',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.gray300,
  },
  plays: {
    fontSize: 12,
    color: Colors.gray400,
  },
  queueButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.softLavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
