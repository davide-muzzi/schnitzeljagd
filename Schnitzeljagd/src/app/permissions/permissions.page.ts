import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { Router, RouterLink } from '@angular/router';
import { GameService } from '../services/game';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { ActiveRun } from '../models/active-run';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-permissions',
  templateUrl: './permissions.page.html',
  styleUrls: ['./permissions.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, RouterLink, CommonModule, FormsModule]
})
export class PermissionsPage implements OnInit {
  locationGranted = false;
  cameraGranted = false;
  playerName: string = '';

  constructor(private gameService: GameService, private router: Router, private route: ActivatedRoute) { }

  abort() {
    console.log('Game aborted');
    this.gameService.abort();
    this.router.navigate(['/home']);
  }

  startgame() {
    if (!this.locationGranted || !this.cameraGranted) return;

    this.gameService.start(this.playerName.trim()).then(() => {
      this.router.navigate(['/challenge']);
    }).catch((err) => {
      console.error('Error starting game:', err);
    });
  }

  async locationperm() {
    try {
      let perm = await Geolocation.checkPermissions();
      console.log('Current permission status:', perm);

      if (perm.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        perm = request;
        console.log('Permission after request:', perm);
      }

      if (perm.location === 'granted' || Capacitor.getPlatform() === 'android') {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        console.log('Location granted, position:', pos);
        this.locationGranted = true;
      } else {
        console.warn('Location permission denied');
        this.locationGranted = false;
      }
    } catch (err) {
      console.error('Error requesting location permission', err);
      this.locationGranted = false;
    }
  }

  async cameraperm() {
    try {
      if (Capacitor.getPlatform() === 'web') {
        console.log('Camera permission handled by browser');
        this.cameraGranted = true;
        return;
      }

      const perm = await BarcodeScanner.checkPermissions();

      if (perm.camera !== 'granted') {
        const request = await BarcodeScanner.requestPermissions();
        if (request.camera !== 'granted') {
          console.warn('Camera permission denied');
          this.cameraGranted = false;
          return;
        }
      }

      console.log('Camera permission granted');
      this.cameraGranted = true;

    } catch (err) {
      console.error('Error requesting camera permission', err);
      this.cameraGranted = false;
    }
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params: { [key: string]: string }) => {
      this.playerName = params['player'] || '';
      console.log('Player name received:', this.playerName);
    });
  }
}
