import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { Expense } from '../../shared/types';
import { ExpensesService } from '../../services/expenses.service';

@Component({
  selector: 'app-change-expense-status-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DialogModule, InputTextModule, ButtonModule],
  templateUrl: './change-expense-status-dialog.component.html',
})
export class ChangeExpenseStatusDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() expense: Expense | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() updated = new EventEmitter<Expense>();

  private fb = inject(FormBuilder);
  private api = inject(ExpensesService);

  submitting = false;

  form: FormGroup = this.fb.group({
    status: ['approved', Validators.required],
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    reason: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['expense'] && this.expense) {
      const nextStatus = this.expense.status === 'rejected' ? 'rejected' : 'approved';
      this.form.reset({
        status: nextStatus,
        name: 'Manager',
        email: 'manager@example.com',
        reason: '',
      });
    }
  }

  async submit() {
    if (!this.expense || this.form.invalid) return;
    const { status, name, email, reason } = this.form.value as {
      status: 'approved' | 'rejected';
      name: string;
      email: string;
      reason?: string;
    };
    this.submitting = true;
    try {
      let res: any;
      if (status === 'approved') {
        res = await this.api.approveExpense(this.expense._id, { name, email });
      } else {
        res = await this.api.rejectExpense(this.expense._id, { name, email }, reason || '');
      }
      if (res?.success) {
        this.updated.emit(res.data);
        this.onHide();
      }
    } catch (e) {
      // no-op for now
    } finally {
      this.submitting = false;
    }
  }

  onHide() {
    this.close.emit();
  }
}
