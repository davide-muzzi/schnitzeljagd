import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { RunResult } from '../models/run-result';
import { GameService } from '../services/game';

@Component({
  selector: 'app-result',
  templateUrl: './result.page.html',
  styleUrls: ['./result.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule],
})
export class ResultPage implements OnInit {
  result: RunResult | null = null;

  constructor(
    private gameService: GameService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const res = this.gameService.lastResult;
    if (!res) {
      this.router.navigateByUrl('/home');
      return;
    }

    this.result = res;
  }

  get playerName(): string {
    return this.result?.name || this.gameService.getPlayerName() || 'Player';
  }

  get totalPoints(): number {
    return this.result?.points ?? 0;
  }

  get schnitzelCount(): number {
    return this.result?.schnitzel ?? 0;
  }

  get kartoffelCount(): number {
    return this.result?.kartoffeln ?? 0;
  }

  get schnitzelBonus(): number {
    return this.result?.schnitzelBonus ?? 0;
  }

  get kartoffelMalus(): number {
    return this.result?.kartoffelMalus ?? 0;
  }

  get formattedDuration(): string {
    const seconds = this.result?.durationSeconds ?? 0;
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainingSeconds}`;
  }

  goToLeaderboard(): void {
    this.router.navigateByUrl('/leaderboard');
  }

  goToHome(): void {
    this.router.navigateByUrl('/home');
  }
}
