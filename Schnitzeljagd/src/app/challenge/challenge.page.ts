import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonCard,
  IonCardContent,
} from '@ionic/angular/standalone';

import { GameService } from '../services/game';
import { Challenge } from '../models/challenge';

@Component({
  selector: 'app-challenge',
  standalone: true,
  templateUrl: './challenge.page.html',
  styleUrls: ['./challenge.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonCard,
    IonCardContent,
  ],
})
export class ChallengePage implements OnInit, OnDestroy {
  // -------------------- RUNTIME STATE --------------------

  statusText = '';
  isDone = false;

  // geo / distance
  private geoWatchId: string | null = null;
  walkedMeters = 0;

  // wifi
  private sawConnected = false;
  private sawDisconnected = false;
  private networkListener: { remove: () => Promise<void> } | null = null;

  constructor(
    private game: GameService,
    private router: Router,
  ) {}

  // -------------------- LIFECYCLE --------------------

  ngOnInit(): void {
    const DEV_BYPASS = true;

    if (!this.game.activeRun && !DEV_BYPASS) {
      this.router.navigateByUrl('/home');
      return;
    }

    this.resetChallenge();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  // -------------------- TEMPLATE GETTERS --------------------
  // (HTML binds ONLY to these)

  get gameRun() {
    return this.game.activeRun;
  }

  get currentChallenge(): Challenge | null {
    const run = this.game.activeRun;
    if (!run) return null;
    return this.game.challenges[run.currentIndex] ?? null;
  }

  get challenges(): Challenge[] {
    return this.game.challenges;
  }

  get currentIndex(): number {
    return this.game.activeRun?.currentIndex ?? 0;
  }

  // -------------------- UI ACTIONS --------------------

  abort(): void {
    this.game.abort();
    this.router.navigateByUrl('/leaderboard');
  }

  nextChallenge(): void {
    if (!this.isDone) return;

    this.game.completeChallenge();

    if (!this.game.activeRun) {
      this.router.navigateByUrl('/result');
      return;
    }

    this.resetChallenge();
  }

  skipChallenge(): void {
    this.game.skipChallenge();
    this.resetChallenge();
  }

  primaryAction(): void {
    const ch = this.currentChallenge;
    if (!ch) return;

    switch (ch.id) {
      case 'qr':
        this.scanQr();
        break;
      case 'sensor':
        this.checkSensor();
        break;
      case 'charging':
        this.checkCharging();
        break;
      case 'wifi':
        this.checkWifi();
        break;
      default:
        this.statusText = 'Tracking läuft…';
    }
  }

  // -------------------- CHALLENGE SETUP --------------------

  private resetChallenge(): void {
    this.cleanup();
    this.isDone = false;
    this.statusText = '';
    this.walkedMeters = 0;
    this.sawConnected = false;
    this.sawDisconnected = false;

    const ch = this.currentChallenge;
    if (!ch) return;

    if (ch.id === 'geo_target' || ch.id === 'distance') {
      this.startGeoTracking(ch);
    }

    if (ch.id === 'wifi') {
      this.startWifiTracking();
    }

    if (ch.id === 'charging') {
      this.pollCharging();
    }
  }

  private cleanup(): void {
    if (this.geoWatchId) {
      Geolocation.clearWatch({ id: this.geoWatchId });
      this.geoWatchId = null;
    }
    if (this.networkListener) {
      this.networkListener.remove();
      this.networkListener = null;
    }
  }

  // -------------------- GEO + DISTANCE --------------------

  private async startGeoTracking(ch: Challenge): Promise<void> {
    let lastLat: number | null = null;
    let lastLng: number | null = null;

    this.geoWatchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true },
      (pos) => {
        if (!pos) return;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (ch.id === 'geo_target') {
          const { lat: tLat, lng: tLng, radiusM } = ch.config!;
          const d = this.distance(lat, lng, tLat, tLng);

          this.statusText = `Noch ${Math.round(d)} m`;

          if (d <= radiusM) {
            this.isDone = true;
            this.statusText = '✅ Ziel erreicht!';
          }
        }

        if (ch.id === 'distance') {
          if (lastLat !== null && lastLng !== null) {
            const step = this.distance(lat, lng, lastLat, lastLng);
            this.walkedMeters += step;

            const goal = ch.config!['goalM'] as number;
            this.statusText = `${Math.floor(this.walkedMeters)} m / ${goal} m`;

            if (this.walkedMeters >= goal) {
              this.isDone = true;
              this.statusText = '✅ Distanz erreicht!';
            }
          }

          lastLat = lat;
          lastLng = lng;
        }
      },
    );
  }

  private distance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

    return 2 * R * Math.asin(Math.sqrt(a));
  }

  // -------------------- QR --------------------

  private async scanQr(): Promise<void> {
    try {
      const perm = await BarcodeScanner.requestPermissions();
      if (perm.camera !== 'granted') {
        this.statusText = '❌ Kamera verweigert';
        return;
      }

      const res = await BarcodeScanner.scan();
      const raw = res?.barcodes?.[0]?.rawValue ?? '';

      if (!raw) {
        this.statusText = '❌ Kein QR erkannt';
        return;
      }

      if (raw === this.currentChallenge!.config!['expected']) {
        this.isDone = true;
        this.statusText = '✅ QR korrekt!';
      } else {
        this.statusText = '❌ Falscher QR-Code';
      }
    } catch {
      this.statusText = '❌ Scan abgebrochen';
    }
  }

  // -------------------- SENSOR --------------------

  private checkSensor(): void {
    this.statusText = 'Gerät bewegen…';

    let swings = 0;
    let upsideDown = false;

    const orient = (e: DeviceOrientationEvent) => {
      if (Math.abs(Math.abs(e.beta ?? 0) - 180) < 25) {
        upsideDown = true;
      }
    };

    const motion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;

      const mag = Math.sqrt(
        (a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2,
      );

      if (mag > 18) swings++;

      if (upsideDown && swings >= 2) {
        window.removeEventListener('deviceorientation', orient);
        window.removeEventListener('devicemotion', motion);
        this.isDone = true;
        this.statusText = '✅ Sensor erkannt!';
      }
    };

    window.addEventListener('deviceorientation', orient);
    window.addEventListener('devicemotion', motion);

    setTimeout(() => {
      window.removeEventListener('deviceorientation', orient);
      window.removeEventListener('devicemotion', motion);
    }, 12000);
  }

  // -------------------- CHARGING --------------------

  private async pollCharging(): Promise<void> {
    for (let i = 0; i < 30 && !this.isDone; i++) {
      await this.checkCharging();
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  private async checkCharging(): Promise<void> {
    const info = await Device.getBatteryInfo();
    if (info.isCharging) {
      this.isDone = true;
      this.statusText = '✅ Gerät lädt';
    } else {
      this.statusText = 'Nicht am Strom';
    }
  }

  // -------------------- WIFI --------------------

  private async startWifiTracking(): Promise<void> {
    const status = await Network.getStatus();
    status.connected
      ? (this.sawConnected = true)
      : (this.sawDisconnected = true);

    this.networkListener = await Network.addListener(
      'networkStatusChange',
      (s) => {
        s.connected
          ? (this.sawConnected = true)
          : (this.sawDisconnected = true);

        if (this.sawConnected && this.sawDisconnected) {
          this.isDone = true;
          this.statusText = '✅ WLAN gewechselt!';
        }
      },
    );
  }

  private async checkWifi(): Promise<void> {
    const s = await Network.getStatus();
    s.connected ? (this.sawConnected = true) : (this.sawDisconnected = true);

    if (this.sawConnected && this.sawDisconnected) {
      this.isDone = true;
      this.statusText = '✅ WLAN gewechselt!';
    }
  }
}
