import type { AppData, CalendarItem, Debt, PayoffPlanItem, StrategyKind } from "./types";

export function remainingDebt(debt: Debt) {
  return Math.max(debt.total - debt.paid, 0);
}

export function totalDebt(debts: Debt[]) {
  return debts.reduce((sum, debt) => sum + debt.total, 0);
}

export function totalRemaining(debts: Debt[]) {
  return debts.reduce((sum, debt) => sum + remainingDebt(debt), 0);
}

export function totalPaid(debts: Debt[]) {
  return debts.reduce((sum, debt) => sum + Math.min(debt.paid, debt.total), 0);
}

export function totalExpenses(data: AppData) {
  return data.expenses.reduce((sum, expense) => sum + expense.amount, 0);
}

export function availableAfterEssentials(data: AppData) {
  return Math.max(data.income.monthly - totalExpenses(data), 0);
}

export function paymentCapacity(data: AppData) {
  if (data.onboarding.monthlyCapacity > 0) return data.onboarding.monthlyCapacity;
  return Math.max(Math.floor(availableAfterEssentials(data) * 0.75), 0);
}

export function progressRatio(debts: Debt[]) {
  const total = totalDebt(debts);
  if (total <= 0) return 0;
  return Math.min(totalPaid(debts) / total, 1);
}

export function sortDebts(debts: Debt[], strategy: StrategyKind) {
  const openDebts = debts.filter((debt) => remainingDebt(debt) > 0);

  if (strategy === "menores") {
    return [...openDebts].sort((a, b) => remainingDebt(a) - remainingDebt(b));
  }

  if (strategy === "juros") {
    return [...openDebts].sort((a, b) => b.interestRate - a.interestRate);
  }

  return [...openDebts].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return b.interestRate - a.interestRate;
  });
}

export function strategyLabel(strategy: StrategyKind) {
  if (strategy === "menores") return "Menores dívidas primeiro";
  if (strategy === "juros") return "Juros maiores primeiro";
  return "Urgências primeiro";
}

export function strategyReason(strategy: StrategyKind, debt: Debt) {
  if (strategy === "menores") return "Vitória rápida para ganhar ritmo.";
  if (strategy === "juros") return "Prioridade pelo custo mensal informado.";
  return debt.urgent ? "Conta marcada como urgente." : "Próxima melhor prioridade.";
}

export function buildPayoffPlan(data: AppData): PayoffPlanItem[] {
  const capacity = Math.max(paymentCapacity(data), 0);
  const ordered = sortDebts(data.debts, data.strategy);
  let cursor = new Date();
  cursor.setDate(1);

  return ordered.map((debt) => {
    const remaining = remainingDebt(debt);
    const basePayment = Math.max(debt.minimumPayment, 1);
    const monthlyAllocated = Math.max(capacity || basePayment, basePayment);
    const months = Math.max(Math.ceil(remaining / monthlyAllocated), 1);
    cursor = addMonths(cursor, months);

    return {
      debt,
      remaining,
      months,
      monthlyAllocated,
      finishDate: new Date(cursor),
      reason: strategyReason(data.strategy, debt)
    };
  });
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function nextDateForDay(day: number, from = new Date()) {
  const safeDay = Math.min(Math.max(day, 1), 28);
  const date = new Date(from.getFullYear(), from.getMonth(), safeDay);
  if (date < from) date.setMonth(date.getMonth() + 1);
  return date;
}

export function upcomingCalendar(data: AppData, months = 2): CalendarItem[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = addMonths(start, Math.max(months, 1));
  const items: CalendarItem[] = [];

  data.expenses.forEach((expense) => {
    const date = nextDateForDay(expense.dueDay, start);
    if (date <= end) {
      items.push({
        id: `expense-${expense.id}`,
        title: expense.name,
        amount: expense.amount,
        date,
        type: "expense",
        urgent: expense.essential
      });
    }
  });

  data.debts
    .filter((debt) => remainingDebt(debt) > 0)
    .forEach((debt) => {
      const date = nextDateForDay(debt.dueDay, start);
      if (date <= end) {
        items.push({
          id: `debt-${debt.id}`,
          title: debt.name,
          amount: debt.minimumPayment,
          date,
          type: "debt",
          urgent: debt.urgent
        });
      }
    });

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function buildDailyActions(data: AppData) {
  const actions: string[] = [];
  const plan = buildPayoffPlan(data);
  const nextDebt = plan[0];
  const upcoming = upcomingCalendar(data, 1)[0];
  const capacity = paymentCapacity(data);

  if (nextDebt) {
    actions.push(`Reservar pelo menos ${Math.min(nextDebt.monthlyAllocated, nextDebt.remaining).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    })} para ${nextDebt.debt.name}.`);
  }

  if (upcoming) {
    actions.push(`Conferir ${upcoming.title}, vence em ${upcoming.date.toLocaleDateString("pt-BR")}.`);
  }

  if (capacity > 0) {
    actions.push("Registrar os gastos do dia antes de dormir.");
  }

  if (actions.length === 0) {
    actions.push("Cadastrar sua renda, gastos e primeira dívida para montar o plano.");
  }

  return actions.slice(0, 3);
}
