import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { Router, RouterLink } from '@angular/router';
import { GameService } from '../services/game';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { ActiveRun } from '../models/active-run';
import { ActivatedRoute } from '@angular/router';
import { Camera } from '@capacitor/camera';

@Component({
  selector: 'app-permissions',
  templateUrl: './permissions.page.html',
  styleUrls: ['./permissions.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    RouterLink,
    CommonModule,
    FormsModule,
  ],
})
export class PermissionsPage implements OnInit {
  locationGranted = false;
  cameraGranted = false;
  playerName = '';

  constructor(public gameService: GameService, private router: Router, private route: ActivatedRoute,) { }

  abort() {
    console.log('Game aborted');
    this.gameService.abort();
    this.router.navigate(['/home']);
  }

  async startGame(name: string) {
    await this.gameService.start();
    console.log('Game started for:', name);
  }



  async locationperm() {
    try {
      if (!Capacitor.isNativePlatform()) {
      if (!('geolocation' in navigator)) {
        console.error('Geolocation not supported');
        this.locationGranted = false;
        return;
      }

      navigator.geolocation.getCurrentPosition(
        () => {
          this.locationGranted = true;
        },
        (err) => {
          console.error('Browser geolocation denied', err);
          this.locationGranted = false;
        },
        { enableHighAccuracy: true }
      );

      return;
    }

      let perm = await Geolocation.checkPermissions();
      console.log('Current permission status:', perm);

      if (perm.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        perm = request;
        console.log('Permission after request:', perm);
      }

      if (
        perm.location === 'granted'
      ) {
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

      const perm = await Camera.checkPermissions();

      if (perm.camera !== 'granted') {
        const request = await Camera.requestPermissions();
        if (request.camera !== 'granted') {
          console.warn('Camera permission denied');
          this.cameraGranted = false;
          return;
        }
        this.cameraGranted = true;
      }

      console.log('Camera permission granted');
      this.cameraGranted = true;
    } catch (err) {
      console.error('Error requesting camera permission', err);
      this.cameraGranted = false;
    }
  }


  ngOnInit() {
    this.gameService.activeRunObs.subscribe(run => {
      if (run) {
        this.playerName = run.name;
      } else {
        this.playerName = this.gameService.getPlayerName();
      }
    });
  }
}
