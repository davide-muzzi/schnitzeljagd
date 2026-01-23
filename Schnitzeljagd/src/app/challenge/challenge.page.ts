import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { Geolocation } from '@capacitor/geolocation';
import { Network } from '@capacitor/network';
import { Device } from '@capacitor/device';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { randomPointWithinRadius, randomDistanceMeters } from '../services/geo.util';

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
  private timerInterval?: any;
  elapsedSeconds = 0;

  // GEO CHALLENGE STATE
  private geoInterval?: any;

  targetLat?: number;
  targetLng?: number;

  currentDistanceMeters?: number;

  private distanceStartLat?: number;
  private distanceStartLng?: number;

  private walkedDistanceMeters = 0;
  private readonly distanceGoalMeters = 20;
  private readonly validQrValues = new Set([
    'First location found',
    'Second location found',
    'Third location found',
  ]);

  statusText = '';
  isDone = false;

  // geo / distance
  private geoWatchId: string | null = null;
  walkedMeters = 0;

  // wifi
  private sawConnected = false;
  private sawDisconnected = false;
  private networkListener: { remove: () => Promise<void> } | null = null;
  private chargingPollAbort = false;

  constructor(
    private game: GameService,
    private router: Router,
    private zone: NgZone,
  ) {}

  // -------------------- LIFECYCLE --------------------

  ngOnInit(): void {
    const DEV_BYPASS = false;

    if (!this.game.activeRun && !DEV_BYPASS) {
      this.router.navigateByUrl('/home');
      return;
    }

    this.timerInterval = setInterval(() => {
      this.zone.run(() => {
        this.elapsedSeconds++;
      });
    }, 1000);

    this.resetChallenge();
  }

  ngOnDestroy(): void {
    this.cleanup();

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }

    this.distanceStartLat = undefined;
    this.distanceStartLng = undefined;
    this.walkedDistanceMeters = 0;
  }

  // -------------------- TEMPLATE GETTERS --------------------
  // (HTML binds ONLY to these)

  get formattedTime(): string {
    const minutes = Math.floor(this.elapsedSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (this.elapsedSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

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

  get playerName(): string {
    return this.game.activeRun?.name || this.game.getPlayerName() || 'Player';
  }

  get challengeIcon(): string {
    const base = 'assets/icons';
    switch (this.currentChallenge?.id) {
      case 'distance':
        return `${base}/footprints.svg`;
      case 'qr':
        return `${base}/qr_code_scan.svg`;
      case 'charging':
        return `${base}/charging_battery.svg`;
      case 'wifi':
        return `${base}/wifi.svg`;
      case 'geo_target':
      default:
        return `${base}/pin.svg`;
    }
  }

  // -------------------- UI ACTIONS --------------------

  abort(): void {
    this.game.abort();
    this.router.navigateByUrl('/leaderboard');
  }

  async nextChallenge(): Promise<void> {
    if (!this.isDone) return;

    await this.game.completeChallenge();

    if (!this.game.activeRun) {
      this.router.navigateByUrl('/result');
      return;
    }

    this.resetChallenge();
  }

  async skipChallenge(): Promise<void> {
    await this.game.skipChallenge();

    if (!this.game.activeRun) {
      this.router.navigateByUrl('/result');
      return;
    }

    this.resetChallenge();
  }

  primaryAction(): void {
    const ch = this.currentChallenge;
    if (!ch) return;

    switch (ch.id) {
      case 'qr':
        this.scanQr();
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
    this.distanceStartLat = undefined;
    this.distanceStartLng = undefined;
    this.walkedDistanceMeters = 0;
    this.sawConnected = false;
    this.sawDisconnected = false;
    this.chargingPollAbort = false;

    const ch = this.currentChallenge;
    if (!ch) return;

    if (ch.id === 'geo_target') {
      this.statusText = `${this.playerName} sucht den Standort…`;
    }

    if (ch.id === 'distance') {
      this.statusText = 'Distanz-Tracking startet…';
    }

    if (ch.id === 'geo_target' || ch.id === 'distance') {
      this.startGeoTracking(ch);
    }

    if (ch.id === 'wifi') {
      this.startWifiTracking();
    }

    if (ch.id === 'charging') {
      this.statusText = 'Ladezustand wird geprüft…';
      this.pollCharging();
    }
  }

  private cleanup(): void {
    if (this.geoInterval) {
      clearInterval(this.geoInterval);
      this.geoInterval = undefined;
    }
    this.targetLat = undefined;
    this.targetLng = undefined;
    this.currentDistanceMeters = undefined;

    if (this.geoWatchId) {
      Geolocation.clearWatch({ id: this.geoWatchId });
      this.geoWatchId = null;
    }

    if (this.networkListener) {
      this.networkListener.remove();
      this.networkListener = null;
    }

    this.chargingPollAbort = true;
  }

  // -------------------- GEO + DISTANCE --------------------
  private generateRandomTargetWithinRadius(
    startLatitude: number,
    startLongitude: number,
    maxDistanceMeters: number = 2000,
  ): { targetLatitude: number; targetLongitude: number } {
    const metersPerDegreeLatitude = 111_000;
    const maxDistanceDegrees = maxDistanceMeters / metersPerDegreeLatitude;

    const randomRadiusFactor = Math.random();
    const randomAngleFactor = Math.random();

    const randomDistanceFromCenter =
      maxDistanceDegrees * Math.sqrt(randomRadiusFactor);
    const randomAngleRadians = 2 * Math.PI * randomAngleFactor;

    const latitudeOffset =
      randomDistanceFromCenter * Math.cos(randomAngleRadians);
    const longitudeOffset =
      (randomDistanceFromCenter * Math.sin(randomAngleRadians)) /
      Math.cos((startLatitude * Math.PI) / 180);

    return {
      targetLatitude: startLatitude + latitudeOffset,
      targetLongitude: startLongitude + longitudeOffset,
    };
  }

  private updateGeoIntroText(): void {
    if (this.targetLat === undefined || this.targetLng === undefined) {
      return;
    }

    const ch = this.currentChallenge;
    if (!ch || ch.id !== 'geo_target') return;

    const coords = `${this.targetLat.toFixed(5)}\u00b0 N, ${this.targetLng.toFixed(5)}\u00b0 E`;
    ch.intro =
      'Begib dich zu einem zuf\u00e4lligen Ort in deiner N\u00e4he.\n' + coords;
  }

  private async startGeoTracking(ch: Challenge): Promise<void> {
    if (ch.id === 'geo_target') {
      this.geoInterval = setInterval(async () => {
        if (this.isDone) return;

        try {
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 10000,
          });

          this.zone.run(() => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            // generate random target once
            if (this.targetLat === undefined || this.targetLng === undefined) {
              const generated = this.generateRandomTargetWithinRadius(
                lat,
                lng,
                2000,
              );

              this.targetLat = generated.targetLatitude;
              this.targetLng = generated.targetLongitude;

              // show coordinates to user
              this.updateGeoIntroText();
            }

            const distanceToTarget = this.distance(
              lat,
              lng,
              this.targetLat!,
              this.targetLng!,
            );

            this.currentDistanceMeters = Math.round(distanceToTarget);

            if (distanceToTarget <= 25) {
              this.isDone = true;
              this.statusText = 'Standort gefunden';
            } else {
              this.statusText = `Noch ${this.currentDistanceMeters} m`;
            }
          });
        } catch (err: any) {
          this.zone.run(() => {
            this.statusText = `${this.playerName}'s location not found`;
          });

          // ignore GPS timeouts (very common indoors / browser)
          if (err?.code !== 3) {
            console.error(err);
          }
        }
      }, 1000);
    }

    this.geoWatchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true },
      (pos, err) => {
        this.zone.run(() => {
          if (err) {
            if (ch.id === 'geo_target' || ch.id === 'distance') {
              this.statusText = `${this.playerName}'s location not found`;
            }
            return;
          }
          if (!pos) return;

          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          /* ??????????? Challenge 1: GEO TARGET ??????????? */
          if (ch.id === 'geo_target') {
            if (this.targetLat === undefined || this.targetLng === undefined) {
              const generated = this.generateRandomTargetWithinRadius(
                lat,
                lng,
                2000,
              );

              this.targetLat = generated.targetLatitude;
              this.targetLng = generated.targetLongitude;

              this.updateGeoIntroText();
            }

            const distanceToTarget = this.distance(
              lat,
              lng,
              this.targetLat!,
              this.targetLng!,
            );

            this.currentDistanceMeters = Math.round(distanceToTarget);

            if (distanceToTarget <= 25) {
              this.isDone = true;
              this.statusText = 'Standort gefunden';
            } else {
              this.statusText = `Noch ${this.currentDistanceMeters} m`;
            }
          }

          /* ??????????? Challenge 2: WALK DISTANCE ??????????? */
          if (ch.id === 'distance') {
            if (
              this.distanceStartLat === undefined ||
              this.distanceStartLng === undefined
            ) {
              this.distanceStartLat = lat;
              this.distanceStartLng = lng;
              this.walkedDistanceMeters = 0;
            }

            const walked = this.distance(
              this.distanceStartLat,
              this.distanceStartLng,
              lat,
              lng,
            );

            this.walkedDistanceMeters = Math.round(walked);

            const goal = (ch.config?.['goalM'] as number) ?? 20;
            const remaining = Math.max(goal - this.walkedDistanceMeters, 0);

            if (remaining <= 0) {
              this.isDone = true;
              this.statusText = 'Distanz erreicht';
            } else {
              this.statusText = `Noch ${remaining} m`;
            }
          }
        });
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

      if (this.validQrValues.has(raw)) {
        this.isDone = true;
        this.statusText = '✅ QR korrekt!';
      } else {
        this.statusText = '❌ Falscher QR-Code';
      }
    } catch {
      this.statusText = '❌ Scan abgebrochen';
    }
  }

  // -------------------- CHARGING --------------------

  private async pollCharging(): Promise<void> {
    for (let i = 0; i < 30 && !this.isDone && !this.chargingPollAbort; i++) {
      await this.checkCharging();
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  private async getChargingStatus(): Promise<boolean | null> {
    try {
      if (Capacitor.isNativePlatform()) {
        const info = await Device.getBatteryInfo();
        if (typeof info.isCharging === 'boolean') {
          return info.isCharging;
        }
        return null;
      }

      const nav = navigator as any;
      if (nav?.getBattery) {
        const battery = await nav.getBattery();
        return !!battery?.charging;
      }
    } catch (err) {
      console.warn('Battery status unavailable', err);
    }

    return null;
  }

  private async checkCharging(): Promise<void> {
    if (this.currentChallenge?.id !== 'charging') return;

    const isCharging = await this.getChargingStatus();

    if (isCharging === null) {
      this.statusText = 'Batteriestatus nicht verfügbar';
      return;
    }

    if (isCharging) {
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
