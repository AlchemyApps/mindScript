import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TrackCardProps {
  id: string;
  title: string;
  description?: string;
  duration: number;
  thumbnailUrl?: string;
  isPublished?: boolean;
  onPress: () => void;
  onOptionsPress?: () => void;
}

export function TrackCard({
  title,
  description,
  duration,
  thumbnailUrl,
  isPublished = false,
  onPress,
  onOptionsPress,
}: TrackCardProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.thumbnailContainer}>
        {thumbnailUrl ? (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
        ) : (
          <View style={styles.placeholderThumbnail}>
            <Ionicons name="musical-notes" size={24} color="#9CA3AF" />
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {onOptionsPress && (
            <TouchableOpacity onPress={onOptionsPress} style={styles.optionsButton}>
              <Ionicons name="ellipsis-vertical" size={18} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}

        <View style={styles.footer}>
          <View style={styles.metadata}>
            <Ionicons name="time-outline" size={14} color="#9CA3AF" />
            <Text style={styles.duration}>{formatDuration(duration)}</Text>
          </View>

          {isPublished && (
            <View style={styles.badge}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" />
              <Text style={styles.badgeText}>Published</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnailContainer: {
    marginRight: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  placeholderThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  optionsButton: {
    padding: 4,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  duration: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
});