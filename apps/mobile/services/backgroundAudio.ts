import { setAudioModeAsync } from 'expo-audio';

let configured = false;

export async function configureAudioMode(): Promise<void> {
  if (configured) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    configured = true;
  } catch (error) {
    console.warn('Failed to configure audio mode:', error);
  }
}
