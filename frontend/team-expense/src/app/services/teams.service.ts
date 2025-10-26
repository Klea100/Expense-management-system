import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiResult, Expense, Pagination, Team } from '../shared/types';
import { HttpStateService } from './http-state.service';

const API_BASE = (globalThis as any).API_BASE || 'http://localhost:5000/api/v1';

@Injectable({ providedIn: 'root' })
export class TeamsService {
  private http = inject(HttpClient);
  private state = inject(HttpStateService);
  get loading() {
    return this.state.loading;
  }

  getTeams(params: Record<string, any> = {}) {
    return this.state.track(
      this.http.get<Pagination<Team>>(`${API_BASE}/teams`, { params }).toPromise()
    );
  }

  getTeam(id: string) {
    return this.state.track(this.http.get<ApiResult<Team>>(`${API_BASE}/teams/${id}`).toPromise());
  }

  createTeam(body: Partial<Team>) {
    return this.state.track(this.http.post<ApiResult<Team>>(`${API_BASE}/teams`, body).toPromise());
  }

  updateTeam(id: string, body: Partial<Team>) {
    return this.state.track(
      this.http.put<ApiResult<Team>>(`${API_BASE}/teams/${id}`, body).toPromise()
    );
  }

  deleteTeam(id: string) {
    return this.state.track(
      this.http.delete<ApiResult<any>>(`${API_BASE}/teams/${id}`).toPromise()
    );
  }

  getTeamExpenses(teamId: string, params: Record<string, any> = {}) {
    return this.state.track(
      this.http
        .get<Pagination<Expense>>(`${API_BASE}/teams/${teamId}/expenses`, { params })
        .toPromise()
    );
  }
}
