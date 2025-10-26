import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DecimalPipe, DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Expense, Team } from '../../shared/types';
import { CreateExpenseDialogComponent } from '../../components/create-expense-dialog/create-expense-dialog.component';
import { ChangeExpenseStatusDialogComponent } from '../../components/change-expense-status-dialog/change-expense-status-dialog.component';
import { TeamsService } from '../../services/teams.service';

@Component({
  selector: 'app-team-detail-page',
  standalone: true,
  imports: [
    CardModule,
    ProgressBarModule,
    TableModule,
    TagModule,
    ButtonModule,
    DecimalPipe,
    DatePipe,
    CreateExpenseDialogComponent,
    ChangeExpenseStatusDialogComponent,
    RouterLink,
    FormsModule,
    TitleCasePipe,
  ],
  templateUrl: './team-detail.page.html',
})
export class TeamDetailPage implements OnInit {
  team = signal<Team | null>(null);
  expenses = signal<Expense[]>([]);
  showCreateExpense = signal<boolean>(false);
  showStatus = signal<boolean>(false);
  selectedExpense = signal<Expense | null>(null);

  // Filters
  searchTerm = signal<string>('');
  statusFilter = signal<'all' | 'pending' | 'approved' | 'rejected'>('all');
  categoryFilter = signal<
    | 'all'
    | 'travel'
    | 'food'
    | 'supplies'
    | 'software'
    | 'hardware'
    | 'training'
    | 'entertainment'
    | 'other'
  >('all');
  dateFilter = signal<'all' | 'today' | 'week' | 'month'>('all');
  expenseCategories: Array<
    | 'travel'
    | 'food'
    | 'supplies'
    | 'software'
    | 'hardware'
    | 'training'
    | 'entertainment'
    | 'other'
  > = ['travel', 'food', 'supplies', 'software', 'hardware', 'training', 'entertainment', 'other'];

  filteredExpenses = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.expenses();
    return this.expenses().filter(
      (e) => e.description?.toLowerCase().includes(term) || e.category?.toLowerCase().includes(term)
    );
  });
  get loading() {
    return this.api.loading;
  }

  constructor(private api: TeamsService, private route: ActivatedRoute) {}

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    const [t, e] = await Promise.all([
      this.api.getTeam(id).catch(() => null),
      this.api.getTeamExpenses(id).catch(() => ({ data: [] } as any)),
    ]);
    if (t?.success) this.team.set(t.data);
    this.expenses.set(e?.data || []);
  }

  get util() {
    const t = this.team();
    if (!t) return 0;
    return Math.min(100, Math.round((t.totalSpent / Math.max(1, t.budget)) * 100));
  }

  async onExpenseCreated() {
    this.showCreateExpense.set(false);
    const id = this.team()?._id;
    if (!id) return;
    const [t, e] = await Promise.all([
      this.api.getTeam(id).catch(() => null),
      this.api.getTeamExpenses(id).catch(() => ({ data: [] } as any)),
    ]);
    if (t?.success) this.team.set(t.data);
    this.expenses.set(e?.data || []);
  }

  openStatusDialog(exp: Expense) {
    this.selectedExpense.set(exp);
    this.showStatus.set(true);
  }

  async onStatusUpdated(updated: Expense) {
    this.showStatus.set(false);
    // Update in-place for snappy UI
    this.expenses.update((list) => list.map((e) => (e._id === updated._id ? updated : e)));
    // Also refresh team totals in case approval changed totalSpent
    const id = this.team()?._id;
    if (!id) return;
    const t = await this.api.getTeam(id).catch(() => null);
    if (t?.success) this.team.set(t.data);
  }

  // Apply server-side filters for status/category/date; keep search client-side
  async onFiltersChange() {
    const id = this.team()?._id;
    if (!id) return;
    const params: any = {};
    if (this.statusFilter() !== 'all') params.status = this.statusFilter();
    if (this.categoryFilter() !== 'all') params.category = this.categoryFilter();
    if (this.dateFilter() !== 'all') {
      const now = new Date();
      const from = new Date(now);
      if (this.dateFilter() === 'today') {
        from.setHours(0, 0, 0, 0);
      } else if (this.dateFilter() === 'week') {
        from.setDate(now.getDate() - 7);
      } else if (this.dateFilter() === 'month') {
        from.setMonth(now.getMonth() - 1);
      }
      params.dateFrom = from.toISOString();
    }
    const res = await this.api.getTeamExpenses(id, params).catch(() => ({ data: [] } as any));
    this.expenses.set(res?.data || []);
  }

  async clearFilters() {
    this.searchTerm.set('');
    this.statusFilter.set('all');
    this.categoryFilter.set('all');
    this.dateFilter.set('all');
    await this.onFiltersChange();
  }
}
