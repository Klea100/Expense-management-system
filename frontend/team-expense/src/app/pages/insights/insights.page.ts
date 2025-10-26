import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CardModule } from 'primeng/card';
import { NgIf, NgFor, DecimalPipe } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-insights-page',
  standalone: true,
  imports: [CardModule, NgIf, NgFor, DecimalPipe],
  templateUrl: './insights.page.html',
})
export class InsightsPage implements OnInit {
  teamId = signal<string>('');
  insights = signal<any>(null);
  get loading() {
    return this.api.loading;
  }

  constructor(private api: DashboardService, private route: ActivatedRoute) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('teamId') || '';
    this.teamId.set(id);
    const res = await this.api.getInsights(id).catch(() => null);
    if (res?.success) this.insights.set(res.data);
  }
}
