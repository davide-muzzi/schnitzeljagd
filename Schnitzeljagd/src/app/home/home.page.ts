import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonAlert } from '@ionic/angular/standalone';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonAlert],
})
export class HomePage {

  public startButton = [
    {
      text: 'Cancel',
      role: 'cancel',
    },
    {
      text: 'Add',
      role: 'confirm'
    },
  ];
  constructor() { }


  public startInput = [
    {
      name: 'Name',
      type: 'string',
      placeholder: 'Name',
      attribute: 'required',
    }

  ];
}
