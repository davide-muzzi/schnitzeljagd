import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { Router, RouterLink } from '@angular/router';
import { GameService } from '../services/game';

@Component({
  selector: 'app-permissions',
  templateUrl: './permissions.page.html',
  styleUrls: ['./permissions.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, RouterLink, CommonModule, FormsModule]
})
export class PermissionsPage implements OnInit {

  constructor(private gameService: GameService, private router: Router) { }

  abort() {
    console.log('Game aborted');
    this.gameService.abort();
    this.router.navigate(['/home']);
  }



  ngOnInit() {
  }

}
