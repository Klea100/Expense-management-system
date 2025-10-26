export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD';

export interface TeamMember {
  name: string;
  email: string;
  role: 'manager' | 'member';
  isActive: boolean;
  _id?: string;
}

export interface Team {
  _id: string;
  name: string;
  description?: string;
  budget: number;
  currency: Currency;
  members: TeamMember[];
  totalSpent: number;
  alertsSent: { warning: boolean; critical: boolean };
  budgetUtilization: number;
  remainingBudget: number;
  budgetStatus: 'good' | 'warning' | 'over-budget' | 'critical' | 'moderate';
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  _id: string;
  team: string | Pick<Team, '_id' | 'name' | 'budget'>;
  amount: number;
  description: string;
  category: string;
  date: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedBy: { name: string; email: string };
  currency: Currency;
  aiInsights?: {
    suggestedCategory?: string;
    confidence?: number;
  };
  createdAt: string;
}

export interface Pagination<T> {
  success: boolean;
  message?: string;
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export interface DashboardSummary {
  success: boolean;
  data: any;
}

export interface AnalyticsResponse {
  success: boolean;
  data: any;
}

export interface ApiResult<T> {
  success: boolean;
  message?: string;
  data: T;
}
