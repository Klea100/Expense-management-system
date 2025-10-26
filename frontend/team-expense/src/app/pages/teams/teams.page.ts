import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { DecimalPipe } from '@angular/common';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { CreateTeamDialogComponent } from '../../components/create-team-dialog/create-team-dialog.component';
import { EditTeamDialogComponent } from '../../components/edit-team-dialog/edit-team-dialog.component';
import { Team } from '../../shared/types';
import { TeamsService } from '../../services/teams.service';

@Component({
  selector: 'app-teams-page',
  standalone: true,
  imports: [
    TableModule,
    TagModule,
    ButtonModule,
    DecimalPipe,
    InputTextModule,
    FormsModule,
    CreateTeamDialogComponent,
    EditTeamDialogComponent,
  ],
  templateUrl: './teams.page.html',
})
export class TeamsPage implements OnInit {
  teams = signal<Team[]>([]);
  total = signal<number>(0);
  page = signal<number>(1);
  rows = 10;
  showCreate = signal<boolean>(false);
  showEdit = signal<boolean>(false);
  selectedTeam = signal<Team | null>(null);

  // filters
  search = signal<string>('');
  status = signal<'good' | 'warning' | 'over-budget' | ''>('');
  statusOptions = [
    { label: 'All statuses', value: '' },
    { label: 'Good', value: 'good' },
    { label: 'Warning', value: 'warning' },
    { label: 'Over budget', value: 'over-budget' },
  ];
  get loading() {
    return this.api.loading;
  }

  constructor(private api: TeamsService, private router: Router) {}

  async ngOnInit() {
    await this.load();
  }

  go(team: Team) {
    this.router.navigate(['/teams', team._id]);
  }

  async load() {
    const params: any = {
      page: this.page(),
      limit: this.rows,
    };
    if (this.search().trim()) params.search = this.search().trim();
    if (this.status()) params.status = this.status();

    const res = await this.api.getTeams(params).catch(() => null);
    if (res?.success) {
      this.teams.set(res.data);
      this.total.set(res.pagination?.totalItems ?? res.data.length);
    }
  }

  async onApplyFilters() {
    this.page.set(1);
    await this.load();
  }

  async onClearFilters() {
    this.search.set('');
    this.status.set('');
    this.page.set(1);
    await this.load();
  }

  async onPage(event: any) {
    const nextPage = (event?.page ?? 0) + 1;
    this.page.set(nextPage);
    this.rows = event?.rows ?? this.rows;
    await this.load();
  }

  async onTeamCreated(team: Team) {
    this.showCreate.set(false);
    this.page.set(1);
    await this.load();
  }

  onEdit(team: Team) {
    this.selectedTeam.set(team);
    this.showEdit.set(true);
  }

  async onTeamUpdated(updated: Team) {
    this.showEdit.set(false);
    // Update in place for snappy UX
    this.teams.update((list) =>
      list.map((t) => (t._id === updated._id ? { ...t, ...updated } : t))
    );
  }

  async onDelete(team: Team) {
    if (!team?._id) return;
    const ok = typeof window !== 'undefined' ? window.confirm(`Delete team "${team.name}"?`) : true;
    if (!ok) return;
    await this.api.deleteTeam(team._id).catch(() => null);
    await this.load();
  }
}
