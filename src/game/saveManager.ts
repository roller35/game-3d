import { DEFAULT_SAVE_DATA, sanitizeSaveData } from './rules';
import type { SaveData } from './types';

const STORAGE_KEY = 'crowd_rush_3d_save_v1';

export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  load(): SaveData {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return structuredClone(DEFAULT_SAVE_DATA);
      }
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return structuredClone(DEFAULT_SAVE_DATA);
      }
      const parsed = JSON.parse(raw);
      return sanitizeSaveData(parsed);
    } catch {
      return structuredClone(DEFAULT_SAVE_DATA);
    }
  }

  save(nextData?: SaveData): SaveData {
    if (nextData) {
      this.data = sanitizeSaveData(nextData);
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      }
    } catch {
      // Ignore storage quota errors cleanly
    }
    return this.data;
  }

  getData(): SaveData {
    return this.data;
  }

  update(mutator: (draft: SaveData) => void): SaveData {
    const draft = sanitizeSaveData(structuredClone(this.data));
    mutator(draft);
    return this.save(draft);
  }

  resetProgress(): SaveData {
    this.data = structuredClone(DEFAULT_SAVE_DATA);
    return this.save(this.data);
  }
}

export const saveManager = new SaveManager();
