import { Component } from '@angular/core';
import { GameService } from '../services/game';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonAlert } from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonAlert],
})
export class HomePage {


  constructor(private gameService: GameService) { }

  public startButtons = [
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

        this.startGame(name);
        return true;
      }
    },
  ];

  public startInputs = [
    {
      name: 'name',
      type: 'text',
      placeholder: 'Name',
      attributes: {
        required: true,
      }
    }
  ];

  async startGame(name: string) {
    await this.gameService.start(name);
    console.log('Game started for:', name);
  }
}
