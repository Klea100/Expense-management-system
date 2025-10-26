import { Component, OnInit, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { NgIf, NgFor, DatePipe } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { EmailService } from '../../services/email.service';

@Component({
  selector: 'app-alerts-page',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    TagModule,
    InputTextModule,
    FormsModule,
    NgIf,
    NgFor,
    DatePipe,
  ],
  templateUrl: './alerts.page.html',
})
export class AlertsPage implements OnInit {
  alerts = signal<any[]>([]);
  // Email test & status
  testEmail = signal<string>('');
  testEmailMessage = signal<string>('');
  testEmailSuccess = signal<boolean | null>(null);
  serviceStatus = signal<any | null>(null);
  get loading() {
    // Use dashboard service loading for page spinner
    return this.dashboard.loading;
  }

  constructor(private dashboard: DashboardService, private email: EmailService) {}

  async ngOnInit() {
    const [alerts, status] = await Promise.all([
      this.dashboard.getAlerts().catch(() => ({ data: {} } as any)),
      this.email.getServiceStatus().catch(() => ({ data: null } as any)),
    ]);
    this.alerts.set(this.normalizeAlerts(alerts.data));
    this.serviceStatus.set(status.data);
  }

  async recheck() {
    await this.dashboard.forceAlertCheck().catch(() => null);
    const res = await this.dashboard.getAlerts().catch(() => ({ data: {} } as any));
    this.alerts.set(this.normalizeAlerts(res.data));
  }

  async sendTest() {
    const to = this.testEmail().trim();
    if (!to) {
      this.testEmailSuccess.set(false);
      this.testEmailMessage.set('Enter a recipient email address');
      return;
    }
    const res = await this.email.sendTestEmail(to).catch((e) => e);
    if (res?.success) {
      this.testEmailSuccess.set(true);
      this.testEmailMessage.set('Test email triggered successfully');
    } else {
      this.testEmailSuccess.set(false);
      this.testEmailMessage.set('Failed to send test email');
    }
  }

  async checkServices() {
    const res = await this.email.getServiceStatus().catch(() => ({ data: null } as any));
    this.serviceStatus.set(res.data);
  }

  async resetAlerts() {
    await this.email.resetBudgetAlerts().catch(() => null);
    await this.recheck();
  }

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
