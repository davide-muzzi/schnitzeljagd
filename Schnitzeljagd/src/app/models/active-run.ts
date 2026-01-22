export interface ActiveRun {
  name: string;

  startedAt: number;
  challengeStartedAt: number;

  startLat?: number;
  startLng?: number;

  currentIndex: number;
  schnitzel: number;
  kartoffeln: number;
}
