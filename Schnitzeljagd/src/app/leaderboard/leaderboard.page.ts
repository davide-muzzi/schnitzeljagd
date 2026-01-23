import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { StorageService, StoredScore } from '../services/storage';

@Component({
  selector: 'app-leaderboard',
  templateUrl: './leaderboard.page.html',
  styleUrls: ['./leaderboard.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule],
})
export class LeaderboardPage implements OnInit {
  topThree: (StoredScore | null)[] = [null, null, null];
  nextRanks: (StoredScore | null)[] = [null, null, null, null];
  allRuns: StoredScore[] = [];
  averagePoints = 0;

  constructor(
    private storage: StorageService,
    private router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadRuns();
  }

  private async loadRuns(): Promise<void> {
    const runs = await this.storage.getRuns();
    runs.sort((a, b) => b.points - a.points);

    this.allRuns = runs;
    this.averagePoints = runs.length
      ? Math.round(runs.reduce((sum, run) => sum + run.points, 0) / runs.length)
      : 0;

    const topSeven = runs.slice(0, 7);

    this.topThree = Array.from({ length: 3 }, (_, idx) => topSeven[idx] ?? null);
    this.nextRanks = Array.from({ length: 4 }, (_, idx) => topSeven[3 + idx] ?? null);
  }

  trackByIndex(_: number, item: StoredScore | null): string | number {
    return item?.dateIso ?? _;
  }

  goHome(): void {
    this.router.navigateByUrl('/home');
  }

  get hasRuns(): boolean {
    return this.allRuns.length > 0;
  }

  get totalRuns(): number {
    return this.allRuns.length;
  }
}
