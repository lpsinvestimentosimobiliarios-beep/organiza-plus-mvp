import type { AppData } from "./types";
import { progressRatio, remainingDebt } from "./calculations";

export type Journey = {
  xp: number;
  level: number;
  levelTitle: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
  streak: number;
  nextMilestone: string;
};

const levelSize = 500;

const levelTitles = [
  "Organizador iniciante",
  "Caçador de atrasos",
  "Mente no controle",
  "Quitador estratégico",
  "Reconstrutor de planos",
  "Vida financeira em ordem",
  "Mestre do Organiza+"
];

export function calculateJourney(data: AppData): Journey {
  const completedDebts = data.debts.filter((debt) => remainingDebt(debt) <= 0).length;
  const actionXp = data.completedActions.reduce((sum, action) => sum + action.xp, 0);
  const paymentXp = data.payments.length * 80;
  const progressXp = Math.round(progressRatio(data.debts) * 700);
  const urgentClearXp =
    data.debts.length > 0 && data.debts.every((debt) => !debt.urgent || remainingDebt(debt) <= 0)
      ? 150
      : 0;

  const xp =
    (data.profile ? 50 : 0) +
    (data.income.monthly > 0 ? 60 : 0) +
    data.expenses.length * 20 +
    data.debts.length * 50 +
    actionXp +
    paymentXp +
    completedDebts * 250 +
    progressXp +
    (data.onboarding.firstGoal.trim() ? 60 : 0) +
    urgentClearXp;

  const level = Math.max(Math.floor(xp / levelSize) + 1, 1);
  const currentLevelXp = xp % levelSize;
  const progress = currentLevelXp / levelSize;
  const levelTitle = levelTitles[Math.min(level - 1, levelTitles.length - 1)];

  return {
    xp,
    level,
    levelTitle,
    currentLevelXp,
    nextLevelXp: levelSize,
    progress,
    streak: calculateStreak(data),
    nextMilestone: getNextMilestone(data, level)
  };
}

export function actionCompletedToday(data: AppData, title: string) {
  const today = toDateKey(new Date());
  return data.completedActions.some(
    (action) => action.title === title && toDateKey(new Date(action.completedAt)) === today
  );
}

function calculateStreak(data: AppData) {
  const dates = new Set<string>();
  data.completedActions.forEach((action) => dates.add(toDateKey(new Date(action.completedAt))));
  data.payments.forEach((payment) => dates.add(toDateKey(new Date(payment.paidAt))));

  if (dates.size === 0) return 0;

  const sorted = Array.from(dates).sort();
  let streak = 1;
  for (let index = sorted.length - 1; index > 0; index -= 1) {
    const current = new Date(`${sorted[index]}T00:00:00`);
    const previous = new Date(`${sorted[index - 1]}T00:00:00`);
    const diffDays = Math.round((current.getTime() - previous.getTime()) / 86_400_000);
    if (diffDays === 1) streak += 1;
    else break;
  }
  return streak;
}

function getNextMilestone(data: AppData, level: number) {
  if (data.completedActions.length === 0) return "Concluir a primeira ação diária";
  if (data.payments.length === 0) return "Registrar o primeiro pagamento";
  if (progressRatio(data.debts) < 0.1) return "Eliminar 10% da dívida cadastrada";
  if (level < 3) return "Chegar ao nível 3";
  if (data.debts.some((debt) => debt.urgent && remainingDebt(debt) > 0)) {
    return "Resolver as dívidas marcadas como urgentes";
  }
  return "Quitar a próxima dívida e liberar uma nova fase";
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
