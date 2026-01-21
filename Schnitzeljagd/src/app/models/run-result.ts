export interface RunResult {
  id: string;
  name: string;
  dateIso: string;

  schnitzel: number;
  kartoffeln: number;

  durationSeconds: number;
  schnitzelBonus: number;
  kartoffelMalus: number;
  points: number;
}
