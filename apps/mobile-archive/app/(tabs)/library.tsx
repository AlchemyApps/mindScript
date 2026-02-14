import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  SafeAreaView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

interface Track {
  id: string;
  title: string;
  description: string;
  duration: number;
  thumbnail_url?: string;
  is_published: boolean;
  created_at: string;
}

export default function LibraryScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: tracks, refetch } = useQuery({
    queryKey: ['userTracks'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Track[];
    },
  });

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderTrackItem = ({ item }: { item: Track }) => (
    <TouchableOpacity
      style={styles.trackCard}
      onPress={() => router.push(`/(tabs)/player?trackId=${item.id}`)}
    >
      <View style={styles.trackThumbnail}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
        ) : (
          <View style={styles.placeholderThumbnail}>
            <Ionicons name="musical-notes" size={30} color="#9CA3AF" />
          </View>
        )}
      </View>
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.trackDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.trackMeta}>
          <Text style={styles.trackDuration}>{formatDuration(item.duration)}</Text>
          {item.is_published && (
            <View style={styles.publishedBadge}>
              <Text style={styles.publishedText}>Published</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Library</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/(tabs)/builder')}
        >
          <Ionicons name="add" size={24} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {tracks && tracks.length > 0 ? (
        <FlatList
          data={tracks}
          renderItem={renderTrackItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="library-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Your library is empty</Text>
          <Text style={styles.emptyDescription}>
            Create your first meditation track to get started
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/builder')}
          >
            <Text style={styles.emptyButtonText}>Create Track</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 20,
  },
  trackCard: {
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
  trackThumbnail: {
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
  trackInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  trackDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  trackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackDuration: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  publishedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  publishedText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});