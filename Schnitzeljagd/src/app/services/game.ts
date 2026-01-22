import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ActiveRun } from '../models/active-run';
import { RunResult } from '../models/run-result';
import { Challenge } from '../models/challenge';
import { StorageService } from './storage';
import { LeaderboardApiService } from './leaderboard-api';
import { randomPointWithinRadius, randomDistanceMeters } from './geo.util';
import { Camera, CameraPermissionType } from '@capacitor/camera';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

@Injectable({
  providedIn: 'root',
})
export class GameService {
  private activeRun$ = new BehaviorSubject<ActiveRun | null>(null);
  activeRunObs = this.activeRun$.asObservable();

  private lastResult$ = new BehaviorSubject<RunResult | null>(null);
  lastResultObs = this.lastResult$.asObservable();

  challenges: Challenge[] = [];

  constructor(
    private storage: StorageService,
    private leaderboardApi: LeaderboardApiService,
  ) { }

  get activeRun(): ActiveRun | null {
    return this.activeRun$.value;
  }

  async start(): Promise<void> {
    const now = Date.now();

    this.activeRun$.next({
      name: 'Player',
      startedAt: now,
      challengeStartedAt: now,
      startLat: undefined,
      startLng: undefined,
      currentIndex: 0,
      schnitzel: 0,
      kartoffeln: 0,
    });
  }

  abort(): void {
    this.activeRun$.next(null);
  }

  skipChallenge(): void {
    const run = this.activeRun;
    if (!run) return;

    this.activeRun$.next({
      ...run,
      currentIndex: run.currentIndex + 1,
      challengeStartedAt: Date.now(),
    });
  }

  async completeChallenge(): Promise<void> {
    const run = this.activeRun;
    if (!run) return;

    const challenge = this.challenges[run.currentIndex];
    const seconds = (Date.now() - run.challengeStartedAt) / 1000;

    const gotKartoffel = seconds > challenge.potatoAfterSeconds ? 1 : 0;

    await Haptics.impact({ style: ImpactStyle.Medium });

    const updatedRun: ActiveRun = {
      ...run,
      schnitzel: run.schnitzel + 1,
      kartoffeln: run.kartoffeln + gotKartoffel,
    };

    if (run.currentIndex === this.challenges.length - 1) {
      await this.finish(updatedRun);
      return;
    }

    this.activeRun$.next({
      ...updatedRun,
      currentIndex: run.currentIndex + 1,
      challengeStartedAt: Date.now(),
    });
  }

  private async finish(run: ActiveRun): Promise<void> {
    const durationSeconds = Math.floor((Date.now() - run.startedAt) / 1000);

    const schnitzelBonus = run.schnitzel * 100;
    const kartoffelMalus = run.kartoffeln * 20;
    const points = Math.max(0, schnitzelBonus - kartoffelMalus);

    const result: RunResult = {
      id: crypto.randomUUID(),
      name: run.name,
      dateIso: new Date().toISOString(),
      schnitzel: run.schnitzel,
      kartoffeln: run.kartoffeln,
      durationSeconds,
      schnitzelBonus,
      kartoffelMalus,
      points,
    };

    await this.storage.saveRun(result);
    await this.leaderboardApi.submit(result).catch(() => { });

    this.lastResult$.next(result);
    this.activeRun$.next(null);
  }

  private buildChallenges(
    target: { lat: number; lng: number },
    distanceMeters: number,
  ): Challenge[] {
    return [
      {
        id: 'geo_target',
        title: 'Standort finden',
        intro: 'Begib dich zu einem zufälligen Ort in deiner Nähe.',
        primaryCta: 'Standort prüfen',
        potatoAfterSeconds: 180,
        config: {
          lat: target.lat,
          lng: target.lng,
          radiusM: 25,
        },
      },
      {
        id: 'distance',
        title: 'Distanz zurücklegen',
        intro: `Laufe mindestens ${distanceMeters} Meter.`,
        primaryCta: 'Tracking starten',
        potatoAfterSeconds: 300,
        config: {
          goalM: distanceMeters,
        },
      },
      {
        id: 'qr',
        title: 'QR-Code scannen',
        intro: 'Scanne den richtigen QR-Code.',
        primaryCta: 'QR-Code scannen',
        potatoAfterSeconds: 120,
        config: {
          expected: 'Schnitzeljagd-OK',
        },
      },
      {
        id: 'sensor',
        title: 'Sensor-Aufgabe',
        intro: 'Bewege dein Gerät.',
        primaryCta: 'Sensor prüfen',
        potatoAfterSeconds: 120,
      },
      {
        id: 'charging',
        title: 'Gerät laden',
        intro: 'Schließe dein Gerät an Strom an.',
        primaryCta: 'Status prüfen',
        potatoAfterSeconds: 120,
      },
      {
        id: 'wifi',
        title: 'WLAN wechseln',
        intro: 'Verbinde und trenne ein WLAN.',
        primaryCta: 'Netzwerkstatus prüfen',
        potatoAfterSeconds: 180,
      },
    ];
  }
}
