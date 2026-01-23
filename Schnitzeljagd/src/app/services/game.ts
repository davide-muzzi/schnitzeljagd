import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BehaviorSubject } from 'rxjs';
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ActiveRun } from '../models/active-run';
import { RunResult } from '../models/run-result';
import { Challenge } from '../models/challenge';
import { StorageService, StoredScore } from './storage';
import { LeaderboardApiService } from './leaderboard-api';
import { randomPointWithinRadius, randomDistanceMeters } from './geo.util';

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

  get lastResult(): RunResult | null {
    return this.lastResult$.value;
  }

  async start(): Promise<void> {
    const now = Date.now();

    const name = this.getPlayerName() || 'Player';

    let startLat: number | undefined;
    let startLng: number | undefined;

    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      startLat = pos.coords.latitude;
      startLng = pos.coords.longitude;
    } catch (err) {
      console.warn('Unable to fetch start location', err);
    }

    const baseLat = startLat ?? 47.376887;
    const baseLng = startLng ?? 8.541694;
    const target = randomPointWithinRadius(baseLat, baseLng, 1000);
    const distanceMeters = randomDistanceMeters(30, 80);

    this.challenges = this.buildChallenges(target, distanceMeters);

    this.activeRun$.next({
      name,
      startedAt: now,
      challengeStartedAt: now,
      startLat,
      startLng,
      currentIndex: 0,
      schnitzel: 0,
      kartoffeln: 0,
    });
  }

  abort(): void {
    this.activeRun$.next(null);
  }

  async skipChallenge(): Promise<void> {
    const run = this.activeRun;
    if (!run) return;

    await Haptics.impact({ style: ImpactStyle.Light });

    const nextIndex = run.currentIndex + 1;

    if (nextIndex >= this.challenges.length) {
      await this.finish(run);
      return;
    }

    this.activeRun$.next({
      ...run,
      currentIndex: nextIndex,
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

    const summary: StoredScore = {
      name: result.name,
      dateIso: result.dateIso,
      points: result.points,
    };

    await this.storage.saveRun(summary);
    this.submitResultOnline(result).catch(() => {});
    await this.leaderboardApi.submit(result).catch(() => { });

    this.lastResult$.next(result);
    this.activeRun$.next(null);
  }

  private async submitResultOnline(result: RunResult): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    const url =
      'https://docs.google.com/forms/u/0/d/e/1FAIpQLSc9v68rbCckYwcIekRLOaVZ0Qdm3eeh1xCEkgpn3d7pParfLQ/formResponse';

    const hours = Math.floor(result.durationSeconds / 3600)
      .toString()
      .padStart(2, '0');
    const minutes = Math.floor((result.durationSeconds % 3600) / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (result.durationSeconds % 60).toString().padStart(2, '0');

    const body =
      `entry.1860183935=${encodeURIComponent(result.name)}` +
      `&entry.564282981=${result.schnitzel}` +
      `&entry.1079317865=${result.kartoffeln}` +
      `&entry.985590604=${hours}:${minutes}:${seconds}`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  }

  private buildChallenges(
    target: { lat: number; lng: number },
    distanceMeters: number,
  ): Challenge[] {
    return [
      {
        id: 'geo_target',
        title: 'Standort finden',
        intro: `Begib dich zu einem zufälligen Ort in deiner Nähe.\n${target.lat.toFixed(5)}° N, ${target.lng.toFixed(5)}° E`,
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



  private playerName = '';

  setPlayerName(name: string) {
    this.playerName = name;
  }

  getPlayerName(): string {
    return this.playerName;
  }
}
