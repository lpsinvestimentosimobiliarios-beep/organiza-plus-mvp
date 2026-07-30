import type { AppData, Expense, Debt } from "./types";

export const storageKey = "organiza-plus-mvp-v1";

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

export const defaultData: AppData = {
  profile: null,
  income: {
    monthly: 0,
    kind: "fixa",
    payday: 5
  },
  expenses: [],
  debts: [],
  payments: [],
  completedActions: [],
  achievements: [],
  onboarding: {
    complete: false,
    step: 0,
    monthlyCapacity: 0,
    mainConcern: "",
    firstGoal: ""
  },
  strategy: "urgencias",
  demoDataLoaded: false,
  localModeAcknowledged: false
};

export const starterExpenses: Expense[] = [
  {
    id: createId("expense"),
    name: "Aluguel",
    amount: 900,
    dueDay: 8,
    essential: true
  },
  {
    id: createId("expense"),
    name: "Energia",
    amount: 170,
    dueDay: 14,
    essential: true
  },
  {
    id: createId("expense"),
    name: "Mercado",
    amount: 650,
    dueDay: 1,
    essential: true
  },
  {
    id: createId("expense"),
    name: "Internet",
    amount: 120,
    dueDay: 20,
    essential: false
  }
];

export const starterDebts: Debt[] = [
  {
    id: createId("debt"),
    name: "Cartão principal",
    creditor: "Banco exemplo",
    category: "cartao",
    total: 4200,
    paid: 850,
    minimumPayment: 390,
    interestRate: 12.9,
    dueDay: 12,
    urgent: true,
    notes: "Dado demonstrativo carregado manualmente."
  },
  {
    id: createId("debt"),
    name: "Loja parcelada",
    creditor: "Loja exemplo",
    category: "loja",
    total: 980,
    paid: 250,
    minimumPayment: 160,
    interestRate: 3.2,
    dueDay: 18,
    urgent: false,
    notes: "Dado demonstrativo carregado manualmente."
  },
  {
    id: createId("debt"),
    name: "Conta atrasada",
    creditor: "Serviço essencial",
    category: "conta",
    total: 620,
    paid: 120,
    minimumPayment: 180,
    interestRate: 1.8,
    dueDay: 6,
    urgent: true,
    notes: "Dado demonstrativo carregado manualmente."
  }
];
