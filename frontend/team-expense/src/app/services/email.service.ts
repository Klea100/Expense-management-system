import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiResult } from '../shared/types';
import { HttpStateService } from './http-state.service';

const API_BASE = (globalThis as any).API_BASE || 'http://localhost:5000/api/v1';

@Injectable({ providedIn: 'root' })
export class EmailService {
  private http = inject(HttpClient);
  private state = inject(HttpStateService);
  get loading() {
    return this.state.loading;
  }

  sendTestEmail(to: string) {
    return this.state.track(
      this.http
        .post<ApiResult<any>>(`${API_BASE}/dashboard/test-email`, null, { params: { to } })
        .toPromise()
    );
  }

  getServiceStatus() {
    return this.state.track(
      this.http.get<ApiResult<any>>(`${API_BASE}/dashboard/service-status`).toPromise()
    );
  }

  resetBudgetAlerts(teamId?: string) {
    const body = teamId ? { teamId } : {};
    return this.state.track(
      this.http.post<ApiResult<any>>(`${API_BASE}/dashboard/reset-budget-alerts`, body).toPromise()
    );
  }
}
