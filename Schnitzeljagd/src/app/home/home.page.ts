import { Component } from '@angular/core';
import { GameService } from '../services/game';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonAlert } from '@ionic/angular/standalone';
import { Router } from '@angular/router';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonAlert],
})
export class HomePage {


  constructor(private gameService: GameService, private router: Router) { }

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
}
