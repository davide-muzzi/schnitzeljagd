import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
const STORAGE_KEY = 'schnitzeljagd_runs';

export interface StoredScore {
  name: string;
  dateIso: string;
  points: number;
}

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  async getRuns(): Promise<StoredScore[]> {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (!value) return [];

    try {
      return JSON.parse(value) as StoredScore[];
    } catch {
      return [];
    }
  }

  async saveRun(run: StoredScore): Promise<void> {
    const runs = await this.getRuns();
    runs.unshift(run);

    await Preferences.set({
      key: STORAGE_KEY,
      value: JSON.stringify(runs),
    });
  }

  async clearRuns(): Promise<void> {
    await Preferences.remove({ key: STORAGE_KEY });
  }
}
