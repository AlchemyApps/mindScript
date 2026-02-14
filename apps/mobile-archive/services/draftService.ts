import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_STORAGE_KEY = '@mindscript_track_draft';
const DRAFT_VERSION = '1.0';

export interface TrackDraft {
  version: string;
  timestamp: number;
  data: {
    title: string;
    script: string;
    voice: string;
    recordedVoiceUrl?: string;
    backgroundMusic: string | null;
    frequencyType: 'solfeggio' | 'binaural' | 'none';
    frequencyValue: number;
    gain: number;
  };
}

export class DraftService {
  private static instance: DraftService;
  private autoSaveTimeout: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): DraftService {
    if (!DraftService.instance) {
      DraftService.instance = new DraftService();
    }
    return DraftService.instance;
  }

  async saveDraft(data: TrackDraft['data']): Promise<void> {
    try {
      const draft: TrackDraft = {
        version: DRAFT_VERSION,
        timestamp: Date.now(),
        data,
      };

      const jsonValue = JSON.stringify(draft);
      await AsyncStorage.setItem(DRAFT_STORAGE_KEY, jsonValue);
      console.log('Draft saved successfully');
    } catch (error) {
      console.error('Failed to save draft:', error);
      throw error;
    }
  }

  async loadDraft(): Promise<TrackDraft['data'] | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);

      if (jsonValue === null) {
        return null;
      }

      const draft: TrackDraft = JSON.parse(jsonValue);

      // Check version compatibility
      if (draft.version !== DRAFT_VERSION) {
        console.warn('Draft version mismatch, clearing old draft');
        await this.clearDraft();
        return null;
      }

      // Check if draft is too old (older than 7 days)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      if (draft.timestamp < sevenDaysAgo) {
        console.warn('Draft is too old, clearing');
        await this.clearDraft();
        return null;
      }

      return draft.data;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  }

  async clearDraft(): Promise<void> {
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
      console.log('Draft cleared successfully');
    } catch (error) {
      console.error('Failed to clear draft:', error);
      throw error;
    }
  }

  async hasDraft(): Promise<boolean> {
    try {
      const jsonValue = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
      return jsonValue !== null;
    } catch (error) {
      console.error('Failed to check draft existence:', error);
      return false;
    }
  }

  async getDraftAge(): Promise<number | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);

      if (jsonValue === null) {
        return null;
      }

      const draft: TrackDraft = JSON.parse(jsonValue);
      return Date.now() - draft.timestamp;
    } catch (error) {
      console.error('Failed to get draft age:', error);
      return null;
    }
  }

  autoSave(data: TrackDraft['data'], delayMs: number = 2000): void {
    // Clear existing timeout
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    // Set new timeout
    this.autoSaveTimeout = setTimeout(async () => {
      await this.saveDraft(data);
    }, delayMs);
  }

  cancelAutoSave(): void {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
      this.autoSaveTimeout = null;
    }
  }

  async migrateDraft(oldKey: string): Promise<void> {
    try {
      // Check if old draft exists
      const oldDraft = await AsyncStorage.getItem(oldKey);
      if (oldDraft) {
        // Parse and migrate to new format if needed
        const parsedOldDraft = JSON.parse(oldDraft);

        // Create new draft format
        const newDraft: TrackDraft = {
          version: DRAFT_VERSION,
          timestamp: Date.now(),
          data: {
            title: parsedOldDraft.title || '',
            script: parsedOldDraft.script || '',
            voice: parsedOldDraft.voice || 'alloy',
            recordedVoiceUrl: parsedOldDraft.recordedVoiceUrl,
            backgroundMusic: parsedOldDraft.backgroundMusic || null,
            frequencyType: parsedOldDraft.frequencyType || 'none',
            frequencyValue: parsedOldDraft.frequencyValue || 0,
            gain: parsedOldDraft.gain || 0.5,
          },
        };

        // Save new draft
        await AsyncStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(newDraft));

        // Remove old draft
        await AsyncStorage.removeItem(oldKey);

        console.log('Draft migrated successfully');
      }
    } catch (error) {
      console.error('Failed to migrate draft:', error);
    }
  }

  async getAllDrafts(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys.filter(key => key.startsWith('@mindscript_'));
    } catch (error) {
      console.error('Failed to get all drafts:', error);
      return [];
    }
  }

  async clearAllDrafts(): Promise<void> {
    try {
      const draftKeys = await this.getAllDrafts();
      await AsyncStorage.multiRemove(draftKeys);
      console.log('All drafts cleared successfully');
    } catch (error) {
      console.error('Failed to clear all drafts:', error);
      throw error;
    }
  }
}

// Export convenience functions
const draftService = DraftService.getInstance();

export const saveDraft = (data: TrackDraft['data']) => draftService.saveDraft(data);
export const loadDraft = () => draftService.loadDraft();
export const clearDraft = () => draftService.clearDraft();
export const hasDraft = () => draftService.hasDraft();
export const getDraftAge = () => draftService.getDraftAge();
export const autoSaveDraft = (data: TrackDraft['data'], delayMs?: number) =>
  draftService.autoSave(data, delayMs);
export const cancelAutoSave = () => draftService.cancelAutoSave();