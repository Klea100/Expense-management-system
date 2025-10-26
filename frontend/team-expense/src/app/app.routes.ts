import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('../app/pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'teams',
    loadComponent: () => import('../app/pages/teams/teams.page').then((m) => m.TeamsPage),
  },
  {
    path: 'teams/:id',
    loadComponent: () =>
      import('../app/pages/team-detail/team-detail.page').then((m) => m.TeamDetailPage),
  },
  {
    path: 'alerts',
    loadComponent: () => import('../app/pages/alerts/alerts.page').then((m) => m.AlertsPage),
  },
  {
    path: 'insights/:teamId',
    loadComponent: () => import('../app/pages/insights/insights.page').then((m) => m.InsightsPage),
  },
];
