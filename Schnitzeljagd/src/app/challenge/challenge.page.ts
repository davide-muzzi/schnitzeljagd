import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

import { GameService } from '../services/game';
import { Challenge } from '../models/challenge';

@Component({
  selector: 'app-challenge',
  templateUrl: './challenge.page.html',
  styleUrls: ['./challenge.page.scss'],
})
export class ChallengePage implements OnInit, OnDestroy {
  run = signal(this.game.activeRun);

  challenge = computed<Challenge | null>(() => {
    const run = this.run();
    if (!run) return null;
    return this.game.challenges[run.currentIndex];
  });

  progress = computed(() => {
    const run = this.run();
    if (!run) return 0;
    return (run.currentIndex + 1) / this.game.challenges.length;
  });

  statusText = signal('');
  isDone = signal(false);

  // geo / distance
  private geoWatchId: string | null = null;
  walkedMeters = signal(0);

  // wifi
  private sawConnected = false;
  private sawDisconnected = false;
  private networkListener: { remove: () => Promise<void> } | null = null;

  constructor(
    private game: GameService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (!this.game.activeRun) {
      this.router.navigateByUrl('/home');
      return;
    }

    this.run.set(this.game.activeRun);
    this.resetChallenge();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /* -------------------- UI ACTIONS -------------------- */

  primaryAction(): void {
    const ch = this.challenge();
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
        // geo + distance auto-track
        this.statusText.set('Tracking läuft…');
    }
  }

  async complete(): Promise<void> {
    if (!this.isDone()) return;

    await this.game.completeChallenge();

    if (!this.game.activeRun) {
      this.router.navigateByUrl('/result');
      return;
    }

    this.run.set(this.game.activeRun);
    this.resetChallenge();
  }

  skip(): void {
    this.game.skipChallenge();
    this.run.set(this.game.activeRun);
    this.resetChallenge();
  }

  abort(): void {
    this.game.abort();
    this.router.navigateByUrl('/leaderboard');
  }

  /* -------------------- CHALLENGE SETUP -------------------- */

  private resetChallenge(): void {
    this.cleanup();
    this.isDone.set(false);
    this.statusText.set('');
    this.walkedMeters.set(0);
    this.sawConnected = false;
    this.sawDisconnected = false;

    const ch = this.challenge();
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

  /* -------------------- GEO + DISTANCE -------------------- */

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

          this.statusText.set(`Noch ${Math.round(d)} m`);

          if (d <= radiusM) {
            this.isDone.set(true);
            this.statusText.set('✅ Ziel erreicht!');
          }
        }

        if (ch.id === 'distance') {
          if (lastLat !== null && lastLng !== null) {
            const step = this.distance(lat, lng, lastLat, lastLng);
            const total = this.walkedMeters() + step;
            this.walkedMeters.set(total);

            const goal = ch.config!['goalM'] as number;
            this.statusText.set(`${Math.floor(total)} m / ${goal} m`);

            if (total >= goal) {
              this.isDone.set(true);
              this.statusText.set('✅ Distanz erreicht!');
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

  /* -------------------- QR -------------------- */

  private async scanQr(): Promise<void> {
    try {
      const perm = await BarcodeScanner.requestPermissions();
      if (perm.camera !== 'granted') {
        this.statusText.set('❌ Kamera verweigert');
        return;
      }

      const res = await BarcodeScanner.scan();
      const raw = res?.barcodes?.[0]?.rawValue ?? '';

      if (!raw) {
        this.statusText.set('❌ Kein QR erkannt');
        return;
      }

      if (raw === this.challenge()!.config!['expected']) {
        this.isDone.set(true);
        this.statusText.set('✅ QR korrekt!');
      } else {
        this.statusText.set('❌ Falscher QR-Code');
      }
    } catch {
      this.statusText.set('❌ Scan abgebrochen');
    }
  }

  /* -------------------- SENSOR -------------------- */

  private checkSensor(): void {
    this.statusText.set('Gerät bewegen…');

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
        this.isDone.set(true);
        this.statusText.set('✅ Sensor erkannt!');
      }
    };

    window.addEventListener('deviceorientation', orient);
    window.addEventListener('devicemotion', motion);

    setTimeout(() => {
      window.removeEventListener('deviceorientation', orient);
      window.removeEventListener('devicemotion', motion);
    }, 12000);
  }

  /* -------------------- CHARGING -------------------- */

  private async pollCharging(): Promise<void> {
    for (let i = 0; i < 30 && !this.isDone(); i++) {
      await this.checkCharging();
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  private async checkCharging(): Promise<void> {
    const info = await Device.getBatteryInfo();
    if (info.isCharging) {
      this.isDone.set(true);
      this.statusText.set('✅ Gerät lädt');
    } else {
      this.statusText.set('Nicht am Strom');
    }
  }

  /* -------------------- WIFI -------------------- */

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
          this.isDone.set(true);
          this.statusText.set('✅ WLAN gewechselt!');
        }
      },
    );
  }

  private async checkWifi(): Promise<void> {
    const s = await Network.getStatus();
    s.connected ? (this.sawConnected = true) : (this.sawDisconnected = true);

    if (this.sawConnected && this.sawDisconnected) {
      this.isDone.set(true);
      this.statusText.set('✅ WLAN gewechselt!');
    }
  }
}
