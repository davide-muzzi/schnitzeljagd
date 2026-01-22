import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { ActiveRun } from '../models/active-run';
import { RunResult } from '../models/run-result';
import { GameService } from '../services/game';
import { PermissionsPage } from '../permissions/permissions.page';

@Component({
  selector: 'app-result',
  templateUrl: './result.page.html',
  styleUrls: ['./result.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, PermissionsPage, IonToolbar, CommonModule, FormsModule]
})
export class ResultPage implements OnInit {

  constructor(private gameService: GameService) {
  }

  playerName = '';

  ngOnInit() {
    this.playerName = this.gameService.getPlayerName();
  }

}
