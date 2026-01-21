import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },  {
    path: 'permissions',
    loadComponent: () => import('./permissions/permissions.page').then( m => m.PermissionsPage)
  },
  {
    path: 'challenge',
    loadComponent: () => import('./challenge/challenge.page').then( m => m.ChallengePage)
  },
  {
    path: 'result',
    loadComponent: () => import('./result/result.page').then( m => m.ResultPage)
  },
  {
    path: 'leaderboard',
    loadComponent: () => import('./leaderboard/leaderboard.page').then( m => m.LeaderboardPage)
  },

];
