import { Injectable } from '@angular/core';
import { RunResult } from '../models/run-result';

@Injectable({
  providedIn: 'root',
})
export class LeaderboardApiService {
  // TODO: replace with your real endpoint
  private readonly endpoint = '';

  async submit(run: RunResult): Promise<void> {
    if (!this.endpoint) {
      // Endpoint not configured yet → silently skip
      console.warn('[LeaderboardApi] No endpoint set, skipping submit');
      return;
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(run),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Leaderboard submit failed (${response.status}): ${text}`,
      );
    }
  }
}
