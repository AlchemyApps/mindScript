import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './services/PlaybackService';

// Register the background playback service — must happen before expo-router entry
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Import expo-router entry point
import 'expo-router/entry';
