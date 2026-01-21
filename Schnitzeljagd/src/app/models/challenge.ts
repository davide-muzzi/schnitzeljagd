export type ChallengeType =
  | 'geo_target'
  | 'distance'
  | 'qr'
  | 'sensor'
  | 'charging'
  | 'wifi';

export interface Challenge {
  id: ChallengeType;
  title: string;
  intro: string;
  primaryCta: string;
  potatoAfterSeconds: number;
  config?: Record<string, any>;
}
