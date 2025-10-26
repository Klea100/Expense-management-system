import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { TeamsService } from '../../services/teams.service';

@Component({
  selector: 'app-create-team-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    ButtonModule,
  ],
  templateUrl: './create-team-dialog.component.html',
})
export class CreateTeamDialogComponent {
  @Input() visible = false;
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<any>();

  private fb = inject(FormBuilder);
  private api = inject(TeamsService);

  submitting = false;

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', [Validators.required, Validators.minLength(10)]],
    budget: [null as number | null, [Validators.required, Validators.min(0)]],
    currency: ['USD'],
    members: this.fb.array([]),
  });

  get members(): FormArray {
    return this.form.get('members') as FormArray;
  }

  addMember() {
    const group = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      role: ['member', Validators.required],
      isActive: [true],
    });
    this.members.push(group);
  }

  removeMember(index: number) {
    this.members.removeAt(index);
  }

  fieldError(field: string): string | null {
    const c = this.form.get(field);
    if (!c) return null;
    if (c.touched && c.invalid) {
      if (c.errors?.['required']) return 'This field is required';
      if (c.errors?.['minlength'])
        return `Minimum length is ${c.errors['minlength'].requiredLength}`;
      if (c.errors?.['min']) return 'Value must be greater than or equal to 0';
    }
    return null;
  }

  async submit() {
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;
    const payload = {
      ...this.form.value,
      createdBy: 'System', // TODO: replace with authenticated user when auth is present
    } as any;

    try {
      const res = await this.api.createTeam(payload);
      if (res?.success) {
        this.created.emit(res.data);
        this.form.reset({ currency: 'USD', members: [] });
        // clear members formarray completely
        while (this.members.length) this.members.removeAt(0);
        this.onHide();
      }
    } catch (e) {
      // no-op; errors surfaced elsewhere if needed
    } finally {
      this.submitting = false;
    }
  }

  onHide() {
    this.close.emit();
  }
}
