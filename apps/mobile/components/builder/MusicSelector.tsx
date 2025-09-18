import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import Slider from '@react-native-community/slider';

interface MusicSelectorProps {
  selectedMusic: string | null;
  onSelectMusic: (music: string | null) => void;
}

const MUSIC_CATEGORIES = [
  { id: 'ambient', name: 'Ambient', icon: 'cloud-outline', color: '#8B5CF6' },
  { id: 'nature', name: 'Nature', icon: 'leaf-outline', color: '#10B981' },
  { id: 'classical', name: 'Classical', icon: 'musical-notes-outline', color: '#F59E0B' },
  { id: 'meditation', name: 'Meditation', icon: 'flower-outline', color: '#EC4899' },
  { id: 'sleep', name: 'Sleep', icon: 'moon-outline', color: '#6366F1' },
  { id: 'focus', name: 'Focus', icon: 'bulb-outline', color: '#14B8A6' },
];

const MUSIC_TRACKS = [
  // Ambient
  { id: 'ambient-1', name: 'Cosmic Drift', category: 'ambient', duration: '3:45', bpm: 60 },
  { id: 'ambient-2', name: 'Ethereal Waves', category: 'ambient', duration: '4:20', bpm: 55 },
  { id: 'ambient-3', name: 'Floating Dreams', category: 'ambient', duration: '5:00', bpm: 50 },
  // Nature
  { id: 'nature-1', name: 'Forest Rain', category: 'nature', duration: '4:30', bpm: null },
  { id: 'nature-2', name: 'Ocean Waves', category: 'nature', duration: '6:00', bpm: null },
  { id: 'nature-3', name: 'Mountain Stream', category: 'nature', duration: '3:15', bpm: null },
  // Classical
  { id: 'classical-1', name: 'Piano Sonata', category: 'classical', duration: '5:30', bpm: 70 },
  { id: 'classical-2', name: 'String Quartet', category: 'classical', duration: '4:45', bpm: 65 },
  { id: 'classical-3', name: 'Gentle Harp', category: 'classical', duration: '3:20', bpm: 60 },
  // Meditation
  { id: 'meditation-1', name: 'Tibetan Bowls', category: 'meditation', duration: '7:00', bpm: null },
  { id: 'meditation-2', name: 'Om Chanting', category: 'meditation', duration: '10:00', bpm: null },
  { id: 'meditation-3', name: 'Zen Garden', category: 'meditation', duration: '5:45', bpm: 45 },
  // Sleep
  { id: 'sleep-1', name: 'Deep Sleep', category: 'sleep', duration: '8:00', bpm: 40 },
  { id: 'sleep-2', name: 'Lullaby', category: 'sleep', duration: '4:30', bpm: 50 },
  { id: 'sleep-3', name: 'Night Sounds', category: 'sleep', duration: '6:15', bpm: null },
  // Focus
  { id: 'focus-1', name: 'Alpha Waves', category: 'focus', duration: '15:00', bpm: null },
  { id: 'focus-2', name: 'Concentration', category: 'focus', duration: '20:00', bpm: 75 },
  { id: 'focus-3', name: 'Study Music', category: 'focus', duration: '30:00', bpm: 80 },
];

const RECENTLY_USED = ['ambient-1', 'nature-2', 'meditation-3'];

export default function MusicSelector({ selectedMusic, onSelectMusic }: MusicSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7);

  const filteredTracks = MUSIC_TRACKS.filter((track) => {
    const matchesCategory = !selectedCategory || track.category === selectedCategory;
    const matchesSearch =
      track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const recentTracks = MUSIC_TRACKS.filter((track) => RECENTLY_USED.includes(track.id));

  const handlePlayTrack = useCallback((trackId: string) => {
    // In real implementation, this would play the actual track
    if (playingTrack === trackId) {
      setPlayingTrack(null);
    } else {
      setPlayingTrack(trackId);
      // Simulate play duration
      setTimeout(() => setPlayingTrack(null), 3000);
    }
  }, [playingTrack]);

  const getCategoryIcon = (categoryId: string) => {
    const category = MUSIC_CATEGORIES.find((c) => c.id === categoryId);
    return category ? category.icon : 'musical-notes-outline';
  };

  const getCategoryColor = (categoryId: string) => {
    const category = MUSIC_CATEGORIES.find((c) => c.id === categoryId);
    return category ? category.color : '#6B7280';
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* No Music Option */}
      <TouchableOpacity
        style={[styles.noMusicCard, selectedMusic === null && styles.noMusicCardActive]}
        onPress={() => onSelectMusic(null)}
      >
        <Ionicons
          name="volume-off"
          size={24}
          color={selectedMusic === null ? '#7C3AED' : '#6B7280'}
        />
        <View style={styles.noMusicContent}>
          <Text style={[styles.noMusicTitle, selectedMusic === null && styles.noMusicTitleActive]}>
            No Background Music
          </Text>
          <Text style={styles.noMusicSubtitle}>Focus on voice and frequencies only</Text>
        </View>
        {selectedMusic === null && (
          <Ionicons name="checkmark-circle" size={24} color="#7C3AED" />
        )}
      </TouchableOpacity>

      {/* Volume Control */}
      {selectedMusic && (
        <Animated.View entering={FadeIn} style={styles.volumeControl}>
          <View style={styles.volumeHeader}>
            <Ionicons name="volume-medium" size={20} color="#6B7280" />
            <Text style={styles.volumeLabel}>Music Volume</Text>
            <Text style={styles.volumeValue}>{Math.round(volume * 100)}%</Text>
          </View>
          <Slider
            style={styles.volumeSlider}
            value={volume}
            onValueChange={setVolume}
            minimumValue={0}
            maximumValue={1}
            minimumTrackTintColor="#7C3AED"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#7C3AED"
          />
        </Animated.View>
      )}

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search music..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesRow}>
        <TouchableOpacity
          style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
            All Music
          </Text>
        </TouchableOpacity>
        {MUSIC_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.categoryChip,
              selectedCategory === category.id && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <Ionicons
              name={category.icon as any}
              size={16}
              color={selectedCategory === category.id ? '#7C3AED' : '#6B7280'}
            />
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category.id && styles.categoryTextActive,
              ]}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Recently Used Section */}
      {!searchQuery && !selectedCategory && recentTracks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently Used</Text>
          <View style={styles.trackList}>
            {recentTracks.map((track) => (
              <TouchableOpacity
                key={track.id}
                style={[styles.trackCard, selectedMusic === track.id && styles.trackCardActive]}
                onPress={() => onSelectMusic(track.id)}
              >
                <View
                  style={[
                    styles.trackIcon,
                    { backgroundColor: `${getCategoryColor(track.category)}20` },
                  ]}
                >
                  <Ionicons
                    name={getCategoryIcon(track.category) as any}
                    size={20}
                    color={getCategoryColor(track.category)}
                  />
                </View>

                <View style={styles.trackInfo}>
                  <Text style={styles.trackName}>{track.name}</Text>
                  <View style={styles.trackMeta}>
                    <Text style={styles.trackCategory}>
                      {MUSIC_CATEGORIES.find((c) => c.id === track.category)?.name}
                    </Text>
                    <Text style={styles.trackDuration}>{track.duration}</Text>
                    {track.bpm && <Text style={styles.trackBpm}>{track.bpm} BPM</Text>}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.playButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    handlePlayTrack(track.id);
                  }}
                >
                  <Ionicons
                    name={playingTrack === track.id ? 'pause-circle' : 'play-circle'}
                    size={32}
                    color="#7C3AED"
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* All Tracks */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {selectedCategory
            ? MUSIC_CATEGORIES.find((c) => c.id === selectedCategory)?.name
            : 'All Music'}
        </Text>
        <View style={styles.trackList}>
          {filteredTracks.map((track) => (
            <TouchableOpacity
              key={track.id}
              style={[styles.trackCard, selectedMusic === track.id && styles.trackCardActive]}
              onPress={() => onSelectMusic(track.id)}
            >
              <View
                style={[
                  styles.trackIcon,
                  { backgroundColor: `${getCategoryColor(track.category)}20` },
                ]}
              >
                <Ionicons
                  name={getCategoryIcon(track.category) as any}
                  size={20}
                  color={getCategoryColor(track.category)}
                />
              </View>

              <View style={styles.trackInfo}>
                <Text style={styles.trackName}>{track.name}</Text>
                <View style={styles.trackMeta}>
                  <Text style={styles.trackCategory}>
                    {MUSIC_CATEGORIES.find((c) => c.id === track.category)?.name}
                  </Text>
                  <Text style={styles.trackDuration}>{track.duration}</Text>
                  {track.bpm && <Text style={styles.trackBpm}>{track.bpm} BPM</Text>}
                </View>
              </View>

              <TouchableOpacity
                style={styles.playButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handlePlayTrack(track.id);
                }}
              >
                <Ionicons
                  name={playingTrack === track.id ? 'pause-circle' : 'play-circle'}
                  size={32}
                  color="#7C3AED"
                />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
  },
  noMusicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    margin: 20,
    marginBottom: 12,
  },
  noMusicCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  noMusicContent: {
    flex: 1,
    marginLeft: 12,
  },
  noMusicTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  noMusicTitleActive: {
    color: '#7C3AED',
  },
  noMusicSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  volumeControl: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  volumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  volumeLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  volumeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7C3AED',
  },
  volumeSlider: {
    height: 40,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#0F172A',
  },
  categoriesRow: {
    paddingHorizontal: 20,
    marginBottom: 20,
    maxHeight: 40,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  categoryText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#7C3AED',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  trackList: {
    gap: 8,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  trackCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  trackIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
  },
  trackName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  trackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackCategory: {
    fontSize: 12,
    color: '#6B7280',
  },
  trackDuration: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  trackBpm: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  playButton: {
    padding: 4,
  },
});