export type IncomeKind = "fixa" | "variavel";

export type DebtCategory =
  | "cartao"
  | "emprestimo"
  | "conta"
  | "financiamento"
  | "loja"
  | "outro";

export type StrategyKind = "urgencias" | "menores" | "juros";

export type ViewKey =
  | "today"
  | "map"
  | "plan"
  | "calendar"
  | "assistant"
  | "achievements"
  | "profile";

export type UserProfile = {
  name: string;
  email: string;
  createdAt: string;
};

export type Income = {
  monthly: number;
  kind: IncomeKind;
  payday: number;
};

export type Expense = {
  id: string;
  name: string;
  amount: number;
  dueDay: number;
  essential: boolean;
};

export type Debt = {
  id: string;
  name: string;
  creditor: string;
  category: DebtCategory;
  total: number;
  paid: number;
  minimumPayment: number;
  interestRate: number;
  dueDay: number;
  urgent: boolean;
  notes?: string;
};

export type Payment = {
  id: string;
  debtId: string;
  amount: number;
  paidAt: string;
};

export type CompletedAction = {
  id: string;
  title: string;
  xp: number;
  completedAt: string;
};

export type AchievementId =
  | "first-login"
  | "first-income"
  | "first-debt"
  | "first-action"
  | "first-payment"
  | "ten-percent"
  | "quarter"
  | "halfway"
  | "urgent-clear"
  | "reserve-start"
  | "plan-ready"
  | "streak-3"
  | "level-3"
  | "level-5";

export type Onboarding = {
  complete: boolean;
  step: number;
  monthlyCapacity: number;
  mainConcern: string;
  firstGoal: string;
};

export type AppData = {
  profile: UserProfile | null;
  income: Income;
  expenses: Expense[];
  debts: Debt[];
  payments: Payment[];
  completedActions: CompletedAction[];
  achievements: AchievementId[];
  onboarding: Onboarding;
  strategy: StrategyKind;
  demoDataLoaded: boolean;
  localModeAcknowledged: boolean;
};

export type PayoffPlanItem = {
  debt: Debt;
  remaining: number;
  months: number;
  monthlyAllocated: number;
  finishDate: Date;
  reason: string;
};

export type CalendarItem = {
  id: string;
  title: string;
  amount: number;
  date: Date;
  type: "expense" | "debt";
  urgent?: boolean;
};
