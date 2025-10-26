import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ButtonModule } from 'primeng/button';
import { ExpensesService } from '../../services/expenses.service';

interface AISuggestion {
  category: string;
  confidence: number;
}

@Component({
  selector: 'app-create-expense-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    InputNumberModule,
    ButtonModule,
  ],
  templateUrl: './create-expense-dialog.component.html',
})
export class CreateExpenseDialogComponent {
  @Input() visible = false;
  @Input() teamId!: string;
  @Input() teamName?: string;
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<any>();

  private fb = inject(FormBuilder);
  private api = inject(ExpensesService);

  submitting = false;

  categories = [
    'travel',
    'food',
    'supplies',
    'software',
    'hardware',
    'training',
    'entertainment',
    'other',
  ];

  form: FormGroup = this.fb.group({
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    description: ['', [Validators.required, Validators.minLength(5)]],
    category: ['', [Validators.required]],
    date: [this.today(), [Validators.required]],
    submittedByName: ['', [Validators.required]],
    submittedByEmail: ['', [Validators.required, Validators.email]],
  });

  aiSuggestion: AISuggestion | null = null;
  showAISuggestion = false;

  constructor() {
    // simple AI suggestion: watch description changes
    this.form.get('description')?.valueChanges?.subscribe((desc: string) => {
      if (desc && desc.length > 10) {
        this.aiSuggestion = this.suggestCategoryFallback(desc);
        this.showAISuggestion = !!this.aiSuggestion;
      } else {
        this.aiSuggestion = null;
        this.showAISuggestion = false;
      }
    });
  }

  private today(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  fieldError(field: string): string | null {
    const c = this.form.get(field);
    if (!c) return null;
    if (c.touched && c.invalid) {
      if (c.errors?.['required']) return 'This field is required';
      if (c.errors?.['minlength'])
        return `Minimum length is ${c.errors['minlength'].requiredLength}`;
      if (c.errors?.['min']) return 'Value must be greater than 0';
      if (c.errors?.['email']) return 'Enter a valid email';
    }
    return null;
  }

  acceptAISuggestion() {
    if (this.aiSuggestion) {
      this.form.patchValue({ category: this.aiSuggestion.category });
      this.showAISuggestion = false;
    }
  }

  dismissAISuggestion() {
    this.showAISuggestion = false;
  }

  suggestCategoryFallback(text: string): AISuggestion {
    const map: Record<string, string> = {
      flight: 'travel',
      hotel: 'travel',
      uber: 'travel',
      taxi: 'travel',
      lunch: 'food',
      dinner: 'food',
      meal: 'food',
      coffee: 'food',
      restaurant: 'food',
      license: 'software',
      subscription: 'software',
      saas: 'software',
      laptop: 'hardware',
      monitor: 'hardware',
      keyboard: 'hardware',
      mouse: 'hardware',
      paper: 'supplies',
      pen: 'supplies',
      office: 'supplies',
      training: 'training',
      course: 'training',
      certification: 'training',
      cinema: 'entertainment',
      party: 'entertainment',
      event: 'entertainment',
    };
    const lower = text.toLowerCase();
    for (const k of Object.keys(map)) {
      if (lower.includes(k)) return { category: map[k], confidence: 0.75 };
    }
    return { category: 'other', confidence: 0.5 };
  }

  async submit() {
    if (this.form.invalid || this.submitting) return;
    if (!this.teamId) return;
    this.submitting = true;
    const v = this.form.value;
    const payload = {
      team: this.teamId,
      amount: v.amount,
      description: v.description,
      category: v.category,
      date: v.date,
      submittedBy: {
        name: v.submittedByName,
        email: v.submittedByEmail,
      },
    } as any;

    try {
      const res = await this.api.createExpense(payload);
      if (res?.success) {
        this.created.emit(res.data);
        this.form.reset({ date: this.today() });
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
