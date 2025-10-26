import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiResult, Expense, Pagination } from '../shared/types';
import { HttpStateService } from './http-state.service';

const API_BASE = (globalThis as any).API_BASE || 'http://localhost:5000/api/v1';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private http = inject(HttpClient);
  private state = inject(HttpStateService);
  get loading() {
    return this.state.loading;
  }

  getExpenses(params: Record<string, any> = {}) {
    return this.state.track(
      this.http.get<Pagination<Expense>>(`${API_BASE}/expenses`, { params }).toPromise()
    );
  }

  createExpense(body: Partial<Expense>) {
    return this.state.track(
      this.http.post<ApiResult<Expense>>(`${API_BASE}/expenses`, body).toPromise()
    );
  }

  approveExpense(id: string, approver: { name: string; email: string }) {
    return this.state.track(
      this.http
        .put<ApiResult<Expense>>(`${API_BASE}/expenses/${id}/approve`, { approver })
        .toPromise()
    );
  }

  rejectExpense(id: string, rejector: { name: string; email: string }, reason: string) {
    return this.state.track(
      this.http
        .put<ApiResult<Expense>>(`${API_BASE}/expenses/${id}/reject`, { rejector, reason })
        .toPromise()
    );
  }
}
