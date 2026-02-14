import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';

export interface RecordingConfig {
  android: {
    extension: string;
    outputFormat: number;
    audioEncoder: number;
    sampleRate: number;
    numberOfChannels: number;
    bitRate: number;
  };
  ios: {
    extension: string;
    audioQuality: number;
    sampleRate: number;
    numberOfChannels: number;
    bitRate: number;
    linearPCMBitDepth: number;
    linearPCMIsBigEndian: boolean;
    linearPCMIsFloat: boolean;
  };
  web: {};
}

export class RecordingService {
  private static instance: RecordingService;
  private recording: Audio.Recording | null = null;
  private permissionGranted: boolean = false;

  private constructor() {}

  static getInstance(): RecordingService {
    if (!RecordingService.instance) {
      RecordingService.instance = new RecordingService();
    }
    return RecordingService.instance;
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      this.permissionGranted = status === 'granted';

      if (this.permissionGranted) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      }

      return this.permissionGranted;
    } catch (error) {
      console.error('Failed to request audio permissions:', error);
      return false;
    }
  }

  async startRecording(onStatusUpdate?: (status: Audio.RecordingStatus) => void): Promise<Audio.Recording | null> {
    try {
      if (!this.permissionGranted) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Audio recording permission not granted');
        }
      }

      // Stop any existing recording
      if (this.recording) {
        await this.stopRecording();
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording with high quality settings
      const recordingOptions: RecordingConfig = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      };

      const { recording } = await Audio.Recording.createAsync(
        recordingOptions,
        onStatusUpdate,
        100 // Update interval in milliseconds
      );

      this.recording = recording;
      return recording;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<string | null> {
    try {
      if (!this.recording) {
        return null;
      }

      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      throw error;
    }
  }

  async compressAudio(uri: string): Promise<string> {
    try {
      // Get file info
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) {
        throw new Error('Recording file not found');
      }

      // If file is already small enough (< 5MB), return as is
      if (info.size && info.size < 5 * 1024 * 1024) {
        return uri;
      }

      // For larger files, we would implement compression here
      // For now, return the original URI
      // In production, you might use FFmpeg or a native module for compression
      console.log('Audio compression not implemented, returning original file');
      return uri;
    } catch (error) {
      console.error('Failed to compress audio:', error);
      throw error;
    }
  }

  async uploadToSupabase(uri: string, userId: string): Promise<string> {
    try {
      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to blob
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/m4a' });

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `recordings/${userId}/${timestamp}.m4a`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('audio')
        .upload(filename, blob, {
          contentType: 'audio/m4a',
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('audio')
        .getPublicUrl(filename);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Failed to upload recording to Supabase:', error);
      throw error;
    }
  }

  async deleteLocalRecording(uri: string): Promise<void> {
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch (error) {
      console.error('Failed to delete local recording:', error);
    }
  }

  async getRecordingInfo(uri: string): Promise<FileSystem.FileInfo> {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      return info;
    } catch (error) {
      console.error('Failed to get recording info:', error);
      throw error;
    }
  }

  isRecording(): boolean {
    return this.recording !== null;
  }

  async pauseRecording(): Promise<void> {
    if (this.recording) {
      await this.recording.pauseAsync();
    }
  }

  async resumeRecording(): Promise<void> {
    if (this.recording) {
      await this.recording.startAsync();
    }
  }

  async getRecordingStatus(): Promise<Audio.RecordingStatus | null> {
    if (this.recording) {
      return await this.recording.getStatusAsync();
    }
    return null;
  }
}

// Export singleton instance
export const recordingService = RecordingService.getInstance();