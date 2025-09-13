'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@mindscript/ui/utils/cn';

interface MusicTrack {
  id: string;
  title: string;
  category: string;
  tags: string[];
  duration: number; // in seconds
  preview_url: string;
  waveform_url?: string;
}

interface MusicBrowserProps {
  selectedTrackId?: string;
  volume: number; // in dB
  onSelect: (trackId: string | undefined) => void;
  onVolumeChange: (volume: number) => void;
  className?: string;
}

// Mock data for development
const MOCK_TRACKS: MusicTrack[] = [
  {
    id: 'track-1',
    title: 'Ocean Waves',
    category: 'Nature',
    tags: ['relaxing', 'water', 'ambient'],
    duration: 180,
    preview_url: '/audio/ocean-waves-preview.mp3',
    waveform_url: '/images/ocean-waves-waveform.png',
  },
  {
    id: 'track-2',
    title: 'Forest Birds',
    category: 'Nature',
    tags: ['birds', 'forest', 'morning'],
    duration: 240,
    preview_url: '/audio/forest-birds-preview.mp3',
    waveform_url: '/images/forest-birds-waveform.png',
  },
  {
    id: 'track-3',
    title: 'Piano Meditation',
    category: 'Classical',
    tags: ['piano', 'peaceful', 'meditation'],
    duration: 300,
    preview_url: '/audio/piano-meditation-preview.mp3',
    waveform_url: '/images/piano-meditation-waveform.png',
  },
  {
    id: 'track-4',
    title: 'Tibetan Bowls',
    category: 'Ambient',
    tags: ['tibetan', 'bowls', 'healing'],
    duration: 360,
    preview_url: '/audio/tibetan-bowls-preview.mp3',
    waveform_url: '/images/tibetan-bowls-waveform.png',
  },
  {
    id: 'track-5',
    title: 'Rain Sounds',
    category: 'Nature',
    tags: ['rain', 'storm', 'sleep'],
    duration: 420,
    preview_url: '/audio/rain-sounds-preview.mp3',
  },
  {
    id: 'track-6',
    title: 'Zen Garden',
    category: 'Ambient',
    tags: ['zen', 'japanese', 'peaceful'],
    duration: 280,
    preview_url: '/audio/zen-garden-preview.mp3',
  },
  {
    id: 'track-7',
    title: 'Crystal Bowls',
    category: 'Healing',
    tags: ['crystal', 'chakra', 'energy'],
    duration: 320,
    preview_url: '/audio/crystal-bowls-preview.mp3',
  },
  {
    id: 'track-8',
    title: 'Gentle Stream',
    category: 'Nature',
    tags: ['water', 'stream', 'peaceful'],
    duration: 260,
    preview_url: '/audio/gentle-stream-preview.mp3',
  },
  {
    id: 'track-9',
    title: 'Choir Harmony',
    category: 'Classical',
    tags: ['choir', 'harmony', 'sacred'],
    duration: 340,
    preview_url: '/audio/choir-harmony-preview.mp3',
  },
  {
    id: 'track-10',
    title: 'Deep Space',
    category: 'Ambient',
    tags: ['space', 'cosmic', 'ethereal'],
    duration: 380,
    preview_url: '/audio/deep-space-preview.mp3',
  },
];

export function MusicBrowser({
  selectedTrackId,
  volume,
  onSelect,
  onVolumeChange,
  className,
}: MusicBrowserProps) {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<MusicTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);
  
  // Load tracks
  useEffect(() => {
    loadTracks();
  }, []);
  
  // Filter tracks based on search and filters
  useEffect(() => {
    let filtered = tracks;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(track => track.category === selectedCategory);
    }
    
    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(track =>
        selectedTags.some(tag => track.tags.includes(tag))
      );
    }
    
    setFilteredTracks(filtered);
  }, [tracks, searchQuery, selectedCategory, selectedTags]);
  
  const loadTracks = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // In production, this would be an actual API call
      // const response = await fetch('/api/music/tracks');
      // if (!response.ok) throw new Error('Failed to load tracks');
      // const data = await response.json();
      // setTracks(data.tracks);
      
      // For now, use mock data
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
      setTracks(MOCK_TRACKS);
    } catch (err) {
      setError('Failed to load music tracks. Please try again.');
      console.error('Error loading tracks:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const handlePlayPause = (trackId: string) => {
    if (playingTrackId === trackId) {
      // Pause current track
      audioRef.current?.pause();
      setPlayingTrackId(null);
    } else {
      // Play new track
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        audioRef.current = new Audio(track.preview_url);
        audioRef.current.volume = isMuted ? 0 : Math.pow(10, volume / 20); // Convert dB to linear
        
        audioRef.current.addEventListener('timeupdate', () => {
          if (audioRef.current) {
            setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
          }
        });
        
        audioRef.current.addEventListener('ended', () => {
          setPlayingTrackId(null);
          setProgress(0);
        });
        
        audioRef.current.play().catch(err => {
          console.error('Error playing audio:', err);
          setPlayingTrackId(null);
        });
        
        setPlayingTrackId(trackId);
      }
    }
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    onVolumeChange(newVolume);
    
    if (audioRef.current) {
      audioRef.current.volume = Math.pow(10, newVolume / 20);
    }
  };
  
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (audioRef.current) {
        audioRef.current.volume = Math.pow(10, volume / 20);
      }
    } else {
      setIsMuted(true);
      if (audioRef.current) {
        audioRef.current.volume = 0;
      }
      onVolumeChange(-Infinity);
    }
  };
  
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedTags([]);
  };
  
  const categories = Array.from(new Set(tracks.map(t => t.category)));
  const allTags = Array.from(new Set(tracks.flatMap(t => t.tags)));
  
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <div className="text-gray-500">Loading music tracks...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={cn('bg-red-50 border border-red-200 rounded-lg p-4', className)}>
        <div className="text-red-700">{error}</div>
        <button
          onClick={loadTracks}
          className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className={cn('space-y-4', className)}>
      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="search"
            placeholder="Search tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            aria-label="Search music tracks"
            role="search"
          />
          <svg 
            className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Category Filter */}
        <div className="flex items-center gap-3">
          <label htmlFor="category-filter" className="text-sm font-medium text-gray-700">
            Category:
          </label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex-1 px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by category"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          
          {(searchQuery || selectedCategory || selectedTags.length > 0) && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              Clear
            </button>
          )}
        </div>
        
        {/* Tag Pills */}
        <div className="flex flex-wrap gap-2">
          {allTags.slice(0, 10).map(tag => (
            <button
              key={tag}
              onClick={() => {
                if (selectedTags.includes(tag)) {
                  setSelectedTags(selectedTags.filter(t => t !== tag));
                } else {
                  setSelectedTags([...selectedTags, tag]);
                }
              }}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                selectedTags.includes(tag)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      
      {/* Volume Control */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <label htmlFor="volume-slider" className="text-sm font-medium text-gray-700">
          Volume:
        </label>
        <button
          onClick={toggleMute}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          )}
        </button>
        <input
          id="volume-slider"
          type="range"
          min="-20"
          max="0"
          step="1"
          value={isMuted ? -20 : volume}
          onChange={handleVolumeChange}
          disabled={isMuted}
          className="flex-1"
          aria-label="Music volume"
          aria-valuetext={`${volume} decibels`}
        />
        <span className="text-sm font-medium text-gray-700 w-16">
          {isMuted ? 'Muted' : `${volume} dB`}
        </span>
      </div>
      
      {/* No Music Option */}
      <button
        onClick={() => onSelect(undefined)}
        className={cn(
          'w-full p-4 rounded-lg border-2 text-left transition-all',
          'hover:shadow-md hover:border-blue-300',
          !selectedTrackId
            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-2'
            : 'border-gray-200 bg-white'
        )}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-900">No Background Music</div>
            <div className="text-sm text-gray-600">Focus on voice and frequencies only</div>
          </div>
          {!selectedTrackId && (
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      </button>
      
      {/* Track Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredTracks.map((track) => (
          <div
            key={track.id}
            data-track-card
            onClick={() => onSelect(track.id)}
            className={cn(
              'relative p-4 rounded-lg border-2 cursor-pointer transition-all',
              'hover:shadow-md hover:border-blue-300',
              selectedTrackId === track.id
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-offset-2'
                : 'border-gray-200 bg-white'
            )}
            role="button"
            aria-pressed={selectedTrackId === track.id}
            tabIndex={0}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{track.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                    {track.category}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDuration(track.duration)}
                  </span>
                </div>
              </div>
              
              {/* Play/Pause Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayPause(track.id);
                }}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                aria-label={playingTrackId === track.id ? 'Pause' : 'Play'}
              >
                {playingTrackId === track.id ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Waveform or Progress */}
            {track.waveform_url ? (
              <img 
                src={track.waveform_url} 
                alt={`${track.title} waveform`}
                className="w-full h-8 object-cover opacity-50"
              />
            ) : (
              <div className="w-full h-8 bg-gray-100 rounded">
                {playingTrackId === track.id && (
                  <div 
                    className="h-full bg-blue-300 rounded transition-all"
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                )}
              </div>
            )}
            
            {/* Selection Indicator */}
            {selectedTrackId === track.id && (
              <div className="absolute top-2 right-2" data-testid="check-icon">
                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            
            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-2">
              {track.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-xs text-gray-500">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {filteredTracks.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No tracks found matching your filters
        </div>
      )}
    </div>
  );
}