import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { RunResult } from '../models/run-result';

const STORAGE_KEY = 'schnitzeljagd_runs';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  async getRuns(): Promise<RunResult[]> {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (!value) return [];

    try {
      return JSON.parse(value) as RunResult[];
    } catch {
      return [];
    }
  }

  async saveRun(run: RunResult): Promise<void> {
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
