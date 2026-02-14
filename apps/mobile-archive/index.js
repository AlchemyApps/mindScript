import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './services/PlaybackService';
import App from './App';

// Register the playback service
TrackPlayer.registerPlaybackService(() => PlaybackService);

// Register the main app component
registerRootComponent(App);