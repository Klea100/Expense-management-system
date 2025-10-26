import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { Team } from '../../shared/types';
import { TeamsService } from '../../services/teams.service';

@Component({
  selector: 'app-edit-team-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    ButtonModule,
  ],
  templateUrl: './edit-team-dialog.component.html',
})
export class EditTeamDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() team: Team | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<Team>();

  private fb = inject(FormBuilder);
  private api = inject(TeamsService);

  submitting = false;

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.maxLength(500)]],
    budget: [0, [Validators.required, Validators.min(0)]],
    currency: ['USD'],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['team'] && this.team) {
      this.form.reset({
        name: this.team.name || '',
        description: this.team.description || '',
        budget: this.team.budget || 0,
        currency: this.team.currency || 'USD',
      });
    }
  }

  fieldError(field: string): string | null {
    const c = this.form.get(field);
    if (!c) return null;
    if (c.touched && c.invalid) {
      if (c.errors?.['required']) return 'This field is required';
      if (c.errors?.['minlength'])
        return `Minimum length is ${c.errors['minlength'].requiredLength}`;
      if (c.errors?.['min']) return 'Value must be >= 0';
      if (c.errors?.['maxlength']) return 'Too long';
    }
    return null;
  }

  async submit() {
    if (!this.team?._id || this.form.invalid || this.submitting) return;
    this.submitting = true;
    try {
      const res = await this.api.updateTeam(this.team._id, this.form.value as Partial<Team>);
      if (res?.success) {
        this.updated.emit(res.data);
        this.onHide();
      }
    } catch (e) {
      // noop
    } finally {
      this.submitting = false;
    }
  }

  onHide() {
    this.close.emit();
  }
}
