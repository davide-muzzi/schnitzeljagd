import { Component, OnInit } from '@angular/core';
import { GameService } from '../services/game';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonAlert,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { StorageService, StoredScore } from '../services/storage';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonAlert],
})
export class HomePage implements OnInit {


  constructor(
    private gameService: GameService,
    private router: Router,
    private storage: StorageService,
  ) { }

  public startButton = [
    {
      text: 'Cancel',
      role: 'cancel',
    },
    {
      text: 'Start',
      role: 'confirm',
      handler: (data: any) => {
        const name = data.name?.trim();
        if (!name) return false;

        this.gameService.setPlayerName(name);

        this.router.navigate(['/permissions']);
        return true;
      }
    }
  ];

  public startInput = [
    {
      name: 'name',
      type: 'text',
      placeholder: 'Name',
      attributes: {
        required: true,
      }
    }
  ];

  topJagers: (StoredScore | null)[] = [null, null, null];
  readonly avatars = ['🥇', '🥈', '🥉'];

  async ngOnInit() {
    await this.loadLeaders();
  }

  private async loadLeaders(): Promise<void> {
    const runs = await this.storage.getRuns();
    runs.sort((a, b) => b.points - a.points);
    this.topJagers = Array.from({ length: 3 }, (_, idx) => runs[idx] ?? null);
  }
}
