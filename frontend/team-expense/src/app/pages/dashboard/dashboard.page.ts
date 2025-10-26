import { Component, OnInit, computed, signal } from '@angular/core';
import { NgIf, NgFor, DecimalPipe } from '@angular/common';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [NgIf, NgFor, DecimalPipe, CardModule, ChartModule, TagModule, ProgressBarModule],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage implements OnInit {
  get loading() {
    return this.api.loading;
  }
  summary = signal<any | null>(null);
  alerts = signal<any[] | null>(null);

  // Simple chart config
  chartData = signal<any>({
    labels: [],
    datasets: [
      { label: 'Spend', data: [], borderColor: '#3b82f6', tension: 0.3 },
      { label: 'Budget', data: [], borderColor: '#10b981', tension: 0.3 },
    ],
  });
  chartOptions = { responsive: true, maintainAspectRatio: false } as any;

  constructor(private api: DashboardService) {}

  async ngOnInit() {
    const [dash, alerts] = await Promise.all([
      this.api.getDashboard().catch(() => null),
      this.api.getAlerts().catch(() => ({ data: {} } as any)),
    ]);
    if (dash?.success) {
      this.summary.set(dash.data);
      const labels = (dash.data?.recentExpenses || []).map((x: any) => x.category || 'Other');
      const spend = (dash.data?.recentExpenses || []).map((x: any) => x.amount || 0);
      const budget = spend.map((v: number) =>
        Math.max(v, dash.data?.summary?.avgExpenseAmount ?? 0)
      );
      this.chartData.set({
        labels,
        datasets: [
          {
            label: 'Spend',
            data: spend,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.1)',
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Budget',
            data: budget,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.1)',
            fill: true,
            tension: 0.3,
          },
        ],
      });
    }
    this.alerts.set(this.normalizeAlerts(alerts?.data));
  }

  utilPercent = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    const total = s?.summary?.totalBudget || 0;
    const spent = s?.summary?.totalSpent || 0;
    if (!total) return 0;
    return Math.min(100, Math.round((spent / total) * 100));
  });

  totalBudget = computed(() => this.summary()?.summary?.totalBudget || 0);
  totalSpent = computed(() => this.summary()?.summary?.totalSpent || 0);
  remaining = computed(() => {
    const budget = this.totalBudget();
    const spent = this.totalSpent();
    return Math.max(0, budget - spent);
  });

  private normalizeAlerts(data: any): any[] {
    const out: any[] = [];
    if (!data) return out;
    const budget = data.budgetAlerts || {};
    const push = (level: string, t: any) => {
      out.push({
        level,
        teamName: t?.name || t?.teamName || t?.team || 'Team',
        message:
          level === 'pending' ? 'Pending expense requires attention' : 'Budget threshold reached',
      });
    };
    (budget.warning || []).forEach((t: any) => push('warning', t));
    (budget.critical || []).forEach((t: any) => push('critical', t));
    (budget.overBudget || []).forEach((t: any) => push('critical', t));
    (data.pendingExpenses?.expenses || []).forEach((e: any) =>
      out.push({
        level: 'pending',
        teamName: e?.team?.name || e?.team || 'Team',
        message: e?.description || 'Pending expense',
      })
    );
    return out;
  }
}
