import { TestBed } from '@angular/core/testing';

import { LeaderboardApi } from './leaderboard-api';

describe('LeaderboardApi', () => {
  let service: LeaderboardApi;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LeaderboardApi);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
