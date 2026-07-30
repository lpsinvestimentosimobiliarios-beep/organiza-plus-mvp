import type { User } from "@supabase/supabase-js";
import { defaultData } from "./defaults";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { AppData, DebtCategory, IncomeKind, StrategyKind } from "./types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const cloudReady = isSupabaseConfigured && Boolean(supabase);

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function newUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) =>
    (Number(char) ^ (Math.random() * 16) >> (Number(char) / 4)).toString(16)
  );
}

function toUuid(value: string | undefined, fallbackMap?: Map<string, string>) {
  if (value && uuidPattern.test(value)) return value;
  if (value && fallbackMap?.has(value)) return fallbackMap.get(value)!;
  const next = newUuid();
  if (value) fallbackMap?.set(value, next);
  return next;
}

function userDisplayName(user: User) {
  const metadataName = typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "";
  return metadataName || user.email?.split("@")[0] || "Usuario Organiza+";
}

export async function loadCloudData(user: User): Promise<AppData> {
  if (!supabase) {
    return defaultData;
  }

  const [profileResult, settingsResult, expensesResult, debtsResult, paymentsResult, actionsResult] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("finance_settings").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("expenses").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("debts").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("payments").select("*").eq("user_id", user.id).order("paid_at"),
      supabase.from("completed_actions").select("*").eq("user_id", user.id).order("completed_at")
    ]);

  const firstError = [
    profileResult.error,
    settingsResult.error,
    expensesResult.error,
    debtsResult.error,
    paymentsResult.error,
    actionsResult.error
  ].find(Boolean);

  if (firstError) {
    throw firstError;
  }

  const profile = profileResult.data;
  const settings = settingsResult.data;

  return {
    ...defaultData,
    profile: {
      name: profile?.name || userDisplayName(user),
      email: profile?.email || user.email || "",
      createdAt: profile?.created_at || user.created_at || new Date().toISOString()
    },
    income: {
      monthly: toNumber(settings?.monthly_income),
      kind: (settings?.income_kind === "variavel" ? "variavel" : "fixa") as IncomeKind,
      payday: Number(settings?.payday) || 5
    },
    expenses: (expensesResult.data ?? []).map((expense) => ({
      id: expense.id,
      name: expense.name,
      amount: toNumber(expense.amount),
      dueDay: Number(expense.due_day) || 1,
      essential: Boolean(expense.essential)
    })),
    debts: (debtsResult.data ?? []).map((debt) => ({
      id: debt.id,
      name: debt.name,
      creditor: debt.creditor || "",
      category: (debt.category || "outro") as DebtCategory,
      total: toNumber(debt.total),
      paid: toNumber(debt.paid),
      minimumPayment: toNumber(debt.minimum_payment),
      interestRate: toNumber(debt.interest_rate),
      dueDay: Number(debt.due_day) || 10,
      urgent: Boolean(debt.urgent),
      notes: debt.notes || ""
    })),
    payments: (paymentsResult.data ?? []).map((payment) => ({
      id: payment.id,
      debtId: payment.debt_id,
      amount: toNumber(payment.amount),
      paidAt: payment.paid_at
    })),
    completedActions: (actionsResult.data ?? []).map((action) => ({
      id: action.id,
      title: action.title,
      xp: Number(action.xp) || 25,
      completedAt: action.completed_at
    })),
    achievements: [],
    onboarding: {
      complete: Boolean(settings?.onboarding_complete),
      step: Number(settings?.onboarding_step) || 0,
      monthlyCapacity: toNumber(settings?.monthly_capacity),
      mainConcern: settings?.main_concern || "",
      firstGoal: settings?.first_goal || ""
    },
    strategy: (settings?.strategy || "urgencias") as StrategyKind,
    demoDataLoaded: false,
    localModeAcknowledged: false
  };
}

export async function saveCloudData(userId: string, data: AppData) {
  if (!supabase || !data.profile) return;

  const debtIdMap = new Map<string, string>();
  const expenseIdMap = new Map<string, string>();
  const paymentIdMap = new Map<string, string>();
  const actionIdMap = new Map<string, string>();

  const debts = data.debts.map((debt) => ({
    id: toUuid(debt.id, debtIdMap),
    user_id: userId,
    name: debt.name,
    creditor: debt.creditor,
    category: debt.category,
    total: debt.total,
    paid: debt.paid,
    minimum_payment: debt.minimumPayment,
    interest_rate: debt.interestRate,
    due_day: debt.dueDay,
    urgent: debt.urgent,
    notes: debt.notes || null
  }));

  const payments = data.payments
    .flatMap((payment) => {
      const debtId = data.debts.find((debt) => debt.id === payment.debtId)?.id;
      if (!debtId) return [];
      return [
        {
          id: toUuid(payment.id, paymentIdMap),
          user_id: userId,
          debt_id: toUuid(debtId, debtIdMap),
          amount: payment.amount,
          paid_at: payment.paidAt
        }
      ];
    });

  const operations = [
    supabase.from("profiles").upsert({
      id: userId,
      name: data.profile.name,
      email: data.profile.email,
      updated_at: new Date().toISOString()
    }),
    supabase.from("finance_settings").upsert({
      user_id: userId,
      monthly_income: data.income.monthly,
      income_kind: data.income.kind,
      payday: data.income.payday,
      monthly_capacity: data.onboarding.monthlyCapacity,
      main_concern: data.onboarding.mainConcern,
      first_goal: data.onboarding.firstGoal,
      onboarding_complete: data.onboarding.complete,
      onboarding_step: data.onboarding.step,
      strategy: data.strategy,
      updated_at: new Date().toISOString()
    }),
    supabase.from("completed_actions").delete().eq("user_id", userId),
    supabase.from("payments").delete().eq("user_id", userId),
    supabase.from("expenses").delete().eq("user_id", userId),
    supabase.from("debts").delete().eq("user_id", userId)
  ];

  const operationResults = await Promise.all(operations);
  const operationError = operationResults.find((result) => result.error)?.error;
  if (operationError) throw operationError;

  const insertResults = await Promise.all([
    data.expenses.length
      ? supabase.from("expenses").insert(
          data.expenses.map((expense) => ({
            id: toUuid(expense.id, expenseIdMap),
            user_id: userId,
            name: expense.name,
            amount: expense.amount,
            due_day: expense.dueDay,
            essential: expense.essential
          }))
        )
      : Promise.resolve({ error: null }),
    debts.length ? supabase.from("debts").insert(debts) : Promise.resolve({ error: null })
  ]);

  const insertError = insertResults.find((result) => result.error)?.error;
  if (insertError) throw insertError;

  const finalResults = await Promise.all([
    payments.length ? supabase.from("payments").insert(payments) : Promise.resolve({ error: null }),
    data.completedActions.length
      ? supabase.from("completed_actions").insert(
          data.completedActions.map((action) => ({
            id: toUuid(action.id, actionIdMap),
            user_id: userId,
            title: action.title,
            xp: action.xp,
            completed_at: action.completedAt
          }))
        )
      : Promise.resolve({ error: null })
  ]);

  const finalError = finalResults.find((result) => result.error)?.error;
  if (finalError) throw finalError;
}

export async function resetCloudData(userId: string) {
  if (!supabase) return;

  const results = await Promise.all([
    supabase.from("completed_actions").delete().eq("user_id", userId),
    supabase.from("payments").delete().eq("user_id", userId),
    supabase.from("expenses").delete().eq("user_id", userId),
    supabase.from("debts").delete().eq("user_id", userId),
    supabase.from("finance_settings").delete().eq("user_id", userId)
  ]);

  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw firstError;
}
