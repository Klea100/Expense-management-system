import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AnalyticsResponse, ApiResult, DashboardSummary } from '../shared/types';
import { HttpStateService } from './http-state.service';

const API_BASE = (globalThis as any).API_BASE || 'http://localhost:5000/api/v1';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private state = inject(HttpStateService);
  get loading() {
    return this.state.loading;
  }

  getDashboard() {
    return this.state.track(this.http.get<DashboardSummary>(`${API_BASE}/dashboard`).toPromise());
  }

  getBudgetSummary() {
    return this.state.track(
      this.http.get<ApiResult<any>>(`${API_BASE}/dashboard/budget-summary`).toPromise()
    );
  }

  getAlerts() {
    return this.state.track(
      this.http.get<ApiResult<any>>(`${API_BASE}/dashboard/alerts`).toPromise()
    );
  }

  forceAlertCheck() {
    return this.state.track(
      this.http.post<ApiResult<any>>(`${API_BASE}/dashboard/budget-alerts/check`, {}).toPromise()
    );
  }

  getAnalytics(params: Record<string, any> = {}) {
    return this.state.track(
      this.http.get<AnalyticsResponse>(`${API_BASE}/dashboard/analytics`, { params }).toPromise()
    );
  }

  getInsights(teamId: string, period: string = 'month') {
    return this.state.track(
      this.http
        .get<ApiResult<any>>(`${API_BASE}/dashboard/ai-insights/${teamId}`, { params: { period } })
        .toPromise()
    );
  }
}
