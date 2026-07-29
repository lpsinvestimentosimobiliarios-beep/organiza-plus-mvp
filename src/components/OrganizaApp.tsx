"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Bell,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  DollarSign,
  Download,
  Home,
  Leaf,
  Lock,
  LucideIcon,
  Map,
  PiggyBank,
  Plus,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  UserRound,
  WalletCards,
  X,
  ZoomIn,
  ZoomOut
} from "lucide-react";
import type {
  AchievementId,
  AppData,
  CalendarItem,
  Debt,
  DebtCategory,
  Expense,
  StrategyKind,
  ViewKey
} from "@/lib/types";
import {
  buildDailyActions,
  buildPayoffPlan,
  paymentCapacity,
  progressRatio,
  remainingDebt,
  strategyLabel,
  totalDebt,
  totalExpenses,
  totalPaid,
  totalRemaining,
  upcomingCalendar
} from "@/lib/calculations";
import { createId, defaultData, starterDebts, starterExpenses, storageKey } from "@/lib/defaults";
import { formatMoney, formatMonthYear, formatShortDate, moneyToNumber, percent, textValue } from "@/lib/format";
import { generateLocalAssistantReply } from "@/lib/localAssistant";
import { actionCompletedToday, calculateJourney } from "@/lib/gamification";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type AssistantMessage = {
  role: "user" | "assistant";
  text: string;
};

type TreeNode = {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  icon: LucideIcon;
  tone: "root" | "blue" | "green" | "orange" | "danger";
  debtId?: string;
};

type TreeLine = {
  from: string;
  to: string;
};

const navItems: Array<{ key: ViewKey; label: string; icon: LucideIcon }> = [
  { key: "today", label: "Hoje", icon: Home },
  { key: "map", label: "Mapa", icon: Map },
  { key: "plan", label: "Plano", icon: ClipboardCheck },
  { key: "assistant", label: "IA", icon: Brain },
  { key: "profile", label: "Perfil", icon: UserRound }
];

const strategyCopy: Record<
  StrategyKind,
  { title: string; description: string; icon: LucideIcon }
> = {
  urgencias: {
    title: "Urgências",
    description: "Protege contas essenciais e riscos imediatos.",
    icon: AlertTriangle
  },
  menores: {
    title: "Menores",
    description: "Busca vitórias rápidas para manter motivação.",
    icon: BadgeCheck
  },
  juros: {
    title: "Juros",
    description: "Prioriza o maior custo informado.",
    icon: DollarSign
  }
};

const achievements: Array<{
  id: AchievementId;
  title: string;
  description: string;
  icon: LucideIcon;
  isEarned: (data: AppData) => boolean;
}> = [
  {
    id: "first-login",
    title: "Primeiro passo",
    description: "Conta demo criada no aparelho.",
    icon: Sparkles,
    isEarned: (data) => Boolean(data.profile)
  },
  {
    id: "first-income",
    title: "Renda no mapa",
    description: "Renda mensal cadastrada.",
    icon: WalletCards,
    isEarned: (data) => data.income.monthly > 0
  },
  {
    id: "first-debt",
    title: "Dívida visível",
    description: "Primeira dívida cadastrada.",
    icon: AlertTriangle,
    isEarned: (data) => data.debts.length > 0
  },
  {
    id: "first-action",
    title: "Ação concluída",
    description: "Primeira ação diária registrada.",
    icon: CheckCircle2,
    isEarned: (data) => data.completedActions.length > 0
  },
  {
    id: "plan-ready",
    title: "Plano criado",
    description: "Estratégia de quitação definida.",
    icon: ClipboardCheck,
    isEarned: (data) => data.debts.length > 0 && paymentCapacity(data) > 0
  },
  {
    id: "first-payment",
    title: "Primeiro pagamento",
    description: "Um pagamento foi registrado.",
    icon: CheckCircle2,
    isEarned: (data) => data.payments.length > 0
  },
  {
    id: "ten-percent",
    title: "10% concluído",
    description: "A dívida total já reduziu pelo menos 10%.",
    icon: Leaf,
    isEarned: (data) => progressRatio(data.debts) >= 0.1
  },
  {
    id: "quarter",
    title: "Um quarto do caminho",
    description: "25% da dívida cadastrada foi eliminada.",
    icon: Trophy,
    isEarned: (data) => progressRatio(data.debts) >= 0.25
  },
  {
    id: "halfway",
    title: "Metade vencida",
    description: "50% da dívida já ficou para trás.",
    icon: Trophy,
    isEarned: (data) => progressRatio(data.debts) >= 0.5
  },
  {
    id: "urgent-clear",
    title: "Urgências sob controle",
    description: "Nenhuma dívida urgente aberta.",
    icon: ShieldCheck,
    isEarned: (data) => data.debts.length > 0 && data.debts.every((debt) => !debt.urgent || remainingDebt(debt) <= 0)
  },
  {
    id: "reserve-start",
    title: "Reserva em vista",
    description: "Objetivo pós-dívida cadastrado.",
    icon: PiggyBank,
    isEarned: (data) => data.onboarding.firstGoal.trim().length > 0
  },
  {
    id: "streak-3",
    title: "Três dias no jogo",
    description: "Sequência de 3 dias com ações ou pagamentos.",
    icon: Sparkles,
    isEarned: (data) => calculateJourney(data).streak >= 3
  },
  {
    id: "level-3",
    title: "Nível 3",
    description: "A jornada chegou ao nível 3.",
    icon: Trophy,
    isEarned: (data) => calculateJourney(data).level >= 3
  },
  {
    id: "level-5",
    title: "Nível 5",
    description: "A jornada chegou ao nível 5.",
    icon: Trophy,
    isEarned: (data) => calculateJourney(data).level >= 5
  }
];

function emptyData(): AppData {
  return {
    ...defaultData,
    income: { ...defaultData.income },
    expenses: [],
    debts: [],
    payments: [],
    completedActions: [],
    achievements: [],
    onboarding: { ...defaultData.onboarding }
  };
}

function normalizeData(value: Partial<AppData>): AppData {
  return {
    ...emptyData(),
    ...value,
    profile: value.profile ?? null,
    income: { ...defaultData.income, ...(value.income ?? {}) },
    expenses: value.expenses ?? [],
    debts: value.debts ?? [],
    payments: value.payments ?? [],
    completedActions: value.completedActions ?? [],
    achievements: value.achievements ?? [],
    onboarding: { ...defaultData.onboarding, ...(value.onboarding ?? {}) },
    strategy: value.strategy ?? "urgencias",
    demoDataLoaded: Boolean(value.demoDataLoaded),
    localModeAcknowledged: Boolean(value.localModeAcknowledged)
  };
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function OrganizaApp() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<AppData>(() => emptyData());
  const [authMode, setAuthMode] = useState<"opening" | "login" | "signup">("opening");
  const [view, setView] = useState<ViewKey>("today");
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        setData(normalizeData(JSON.parse(stored) as Partial<AppData>));
      } catch {
        setData(emptyData());
      }
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data, mounted]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const updateData = useCallback((updater: AppData | ((previous: AppData) => AppData)) => {
    setData((previous) =>
      typeof updater === "function" ? normalizeData((updater as (previous: AppData) => AppData)(previous)) : normalizeData(updater)
    );
  }, []);

  const earnedCount = useMemo(
    () => achievements.filter((achievement) => achievement.isEarned(data)).length,
    [data]
  );

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  }

  if (!mounted) {
    return <LoadingScreen />;
  }

  if (!data.profile) {
    return (
      <AuthScreen
        data={data}
        mode={authMode}
        onModeChange={setAuthMode}
        onCreateProfile={(profile) => {
          updateData((previous) => ({
            ...previous,
            profile,
            localModeAcknowledged: true,
            achievements: Array.from(new Set([...previous.achievements, "first-login"]))
          }));
        }}
      />
    );
  }

  if (!data.onboarding.complete) {
    return <OnboardingScreen data={data} updateData={updateData} />;
  }

  return (
    <main className="min-h-screen bg-[rgba(247,250,252,0.96)] text-ink">
      <div className="mx-auto min-h-screen w-full max-w-[480px] bg-cloud shadow-soft">
        <AppHeader
          data={data}
          view={view}
          earnedCount={earnedCount}
          installAvailable={Boolean(installPrompt)}
          onInstall={installApp}
          onNavigate={setView}
        />

        <div className="safe-bottom px-4 pt-4">
          <AnimatePresence mode="wait">
            <motion.section
              key={view}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {view === "today" && <TodayView data={data} updateData={updateData} onNavigate={setView} />}
              {view === "map" && <MapView data={data} updateData={updateData} onNavigate={setView} />}
              {view === "plan" && <PlanView data={data} updateData={updateData} />}
              {view === "calendar" && <CalendarView data={data} />}
              {view === "assistant" && <AssistantView data={data} />}
              {view === "achievements" && <AchievementsView data={data} />}
              {view === "profile" && (
                <ProfileView
                  data={data}
                  updateData={updateData}
                  earnedCount={earnedCount}
                  installAvailable={Boolean(installPrompt)}
                  onInstall={installApp}
                  onNavigate={setView}
                />
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        <BottomNav active={view} onNavigate={setView} />
      </div>
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink text-white">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <LogoMark size="lg" />
        <p className="text-sm text-white/70">Abrindo Organiza+</p>
      </motion.div>
    </main>
  );
}

function AuthScreen({
  data,
  mode,
  onModeChange,
  onCreateProfile
}: {
  data: AppData;
  mode: "opening" | "login" | "signup";
  onModeChange: (mode: "opening" | "login" | "signup") => void;
  onCreateProfile: (profile: NonNullable<AppData["profile"]>) => void;
}) {
  if (mode === "opening") {
    return (
      <main className="min-h-screen bg-ink px-5 py-7 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-[480px] flex-col">
          <div className="flex items-center justify-between">
            <BrandLockup contrast />
            <Badge tone="orange">Modo local demonstrativo</Badge>
          </div>

          <div className="flex flex-1 flex-col justify-center gap-8 py-10">
            <motion.div
              className="relative min-h-[300px] overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.06] p-5 shadow-glow"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42 }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(33,183,166,0.28),transparent_34%),radial-gradient(circle_at_80%_88%,rgba(245,158,91,0.22),transparent_32%)]" />
              <div className="relative flex h-full flex-col justify-between gap-8">
                <div>
                  <p className="mb-3 text-sm text-white/64">Organiza+ Dívidas</p>
                  <h1 className="max-w-[12ch] text-4xl font-black leading-[1.05]">
                    Seu mapa para sair das dívidas.
                  </h1>
                </div>
                <AnimatedTreePreview />
                <div className="grid grid-cols-3 gap-2 text-[11px] text-white/76">
                  <MiniTrust icon={ShieldCheck} label="Dados no aparelho" />
                  <MiniTrust icon={Map} label="Mapa visual" />
                  <MiniTrust icon={Brain} label="IA demo" />
                </div>
              </div>
            </motion.div>

            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-black">Organize suas dívidas. Reconstrua seus planos.</h2>
                <p className="mt-3 text-sm leading-6 text-white/72">
                  Cadastre renda, gastos e dívidas, veja tudo em uma árvore financeira e acompanhe o próximo passo pelo celular.
                </p>
              </div>
              <div className="grid gap-3">
                <AppButton onClick={() => onModeChange("signup")} icon={<ArrowRight size={18} />}>
                  Começar agora
                </AppButton>
                <AppButton variant="secondary" onClick={() => onModeChange("login")} icon={<Lock size={18} />}>
                  Já tenho conta demo
                </AppButton>
              </div>
              {data.demoDataLoaded && (
                <p className="rounded-[8px] bg-white/8 p-3 text-xs text-white/70">
                  Existem dados demonstrativos salvos neste aparelho. Eles aparecem somente porque foram carregados manualmente.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-mist px-5 py-7">
      <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-[480px] flex-col">
        <button
          type="button"
          onClick={() => onModeChange("opening")}
          className="mb-7 flex w-fit items-center gap-2 text-sm font-semibold text-ocean"
        >
          <ChevronRight className="rotate-180" size={17} />
          Voltar
        </button>
        <div className="mb-7">
          <BrandLockup />
          <h1 className="mt-8 text-3xl font-black">
            {mode === "signup" ? "Criar conta demo" : "Entrar na conta demo"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-ocean/74">
            Esta versão salva tudo localmente no seu aparelho. Nenhuma senha bancária é pedida.
          </p>
        </div>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const name = textValue(form.get("name")) || "Usuário Organiza+";
            const email = textValue(form.get("email")) || "demo@organizamais.local";
            onCreateProfile({
              name,
              email,
              createdAt: new Date().toISOString()
            });
          }}
        >
          <label className="grid gap-2 text-sm font-semibold text-ocean">
            Nome
            <input className="field" name="name" placeholder="Seu nome" autoComplete="name" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ocean">
            E-mail
            <input className="field" name="email" type="email" placeholder="voce@email.com" autoComplete="email" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ocean">
            Senha demo
            <input className="field" name="password" type="password" placeholder="Somente para fluxo visual" autoComplete="current-password" />
          </label>
          <div className="demo-ribbon rounded-[8px] border border-amber/25 p-3 text-xs font-medium text-ocean">
            Modo demonstrativo: o login é local e não autentica em servidor. Supabase já está preparado para uma próxima fase.
          </div>
          <AppButton type="submit" icon={<ArrowRight size={18} />}>
            Continuar
          </AppButton>
        </form>
      </div>
    </main>
  );
}

function OnboardingScreen({
  data,
  updateData
}: {
  data: AppData;
  updateData: (updater: AppData | ((previous: AppData) => AppData)) => void;
}) {
  const step = data.onboarding.step;
  const progress = ((step + 1) / 4) * 100;

  function setStep(nextStep: number) {
    updateData((previous) => ({
      ...previous,
      onboarding: {
        ...previous.onboarding,
        step: Math.max(0, Math.min(nextStep, 3))
      }
    }));
  }

  function loadDemoData() {
    updateData((previous) => ({
      ...previous,
      income: previous.income.monthly > 0 ? previous.income : { monthly: 3200, kind: "fixa", payday: 5 },
      expenses: previous.expenses.length > 0 ? previous.expenses : starterExpenses,
      debts: previous.debts.length > 0 ? previous.debts : starterDebts,
      demoDataLoaded: true,
      onboarding: {
        ...previous.onboarding,
        monthlyCapacity: previous.onboarding.monthlyCapacity || 520,
        mainConcern: previous.onboarding.mainConcern || "Sair do cartão e parar de atrasar contas.",
        firstGoal: previous.onboarding.firstGoal || "Criar uma reserva de emergência."
      }
    }));
  }

  return (
    <main className="min-h-screen bg-mist px-4 py-6 text-ink">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="mb-6 flex items-center justify-between">
          <BrandLockup />
          <Badge tone="orange">Demo local</Badge>
        </div>

        <div className="mb-6 overflow-hidden rounded-full bg-white">
          <motion.div
            className="h-2 bg-gradient-to-r from-aqua via-leaf to-amber"
            initial={false}
            animate={{ width: `${progress}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.section
            key={step}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {step === 0 && (
              <section className="space-y-5">
                <SectionTitle
                  eyebrow="Diagnóstico"
                  title="Vamos montar sua base financeira."
                  description="Comece pela renda, capacidade mensal e principal preocupação."
                />
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    updateData((previous) => ({
                      ...previous,
                      income: {
                        monthly: moneyToNumber(form.get("income")),
                        kind: form.get("kind") === "variavel" ? "variavel" : "fixa",
                        payday: Number(form.get("payday")) || 5
                      },
                      onboarding: {
                        ...previous.onboarding,
                        monthlyCapacity: moneyToNumber(form.get("capacity")),
                        mainConcern: textValue(form.get("concern")),
                        step: 1
                      }
                    }));
                  }}
                >
                  <label className="grid gap-2 text-sm font-semibold text-ocean">
                    Renda mensal
                    <input className="field" name="income" inputMode="decimal" placeholder="3200" defaultValue={data.income.monthly || ""} />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-2 text-sm font-semibold text-ocean">
                      Tipo
                      <select className="field" name="kind" defaultValue={data.income.kind}>
                        <option value="fixa">Fixa</option>
                        <option value="variavel">Variável</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-ocean">
                      Dia do salário
                      <input className="field" name="payday" type="number" min={1} max={28} defaultValue={data.income.payday} />
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm font-semibold text-ocean">
                    Valor possível para dívidas por mês
                    <input className="field" name="capacity" inputMode="decimal" placeholder="500" defaultValue={data.onboarding.monthlyCapacity || ""} />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-ocean">
                    Maior preocupação
                    <textarea className="field min-h-24 resize-none" name="concern" placeholder="Ex.: cartão atrasado, conta essencial, nome negativado" defaultValue={data.onboarding.mainConcern} />
                  </label>
                  <AppButton type="submit" icon={<ArrowRight size={18} />}>
                    Salvar e continuar
                  </AppButton>
                </form>
              </section>
            )}

            {step === 1 && (
              <section className="space-y-5">
                <SectionTitle
                  eyebrow="Gastos"
                  title="Liste o que precisa caber no mês."
                  description="Gastos essenciais ajudam o plano a não sugerir parcelas irreais."
                />
                <ExpenseForm
                  onAdd={(expense) =>
                    updateData((previous) => ({
                      ...previous,
                      expenses: [...previous.expenses, expense]
                    }))
                  }
                />
                <ExpenseList
                  expenses={data.expenses}
                  onRemove={(id) =>
                    updateData((previous) => ({
                      ...previous,
                      expenses: previous.expenses.filter((expense) => expense.id !== id)
                    }))
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <AppButton variant="secondary" onClick={() => setStep(0)}>
                    Voltar
                  </AppButton>
                  <AppButton onClick={() => setStep(2)} icon={<ArrowRight size={18} />}>
                    Continuar
                  </AppButton>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-5">
                <SectionTitle
                  eyebrow="Dívidas"
                  title="Agora coloque as dívidas no mapa."
                  description="Você pode cadastrar só uma agora e completar depois."
                />
                <div className="rounded-[8px] border border-amber/25 bg-amber/10 p-3 text-xs text-ocean">
                  Os exemplos abaixo só entram se você tocar em carregar dados demonstrativos.
                </div>
                <AppButton variant="secondary" onClick={loadDemoData} icon={<Sparkles size={18} />}>
                  Carregar exemplo demonstrativo
                </AppButton>
                <DebtForm
                  onAdd={(debt) =>
                    updateData((previous) => ({
                      ...previous,
                      debts: [...previous.debts, debt]
                    }))
                  }
                />
                <DebtList
                  debts={data.debts}
                  onRemove={(id) =>
                    updateData((previous) => ({
                      ...previous,
                      debts: previous.debts.filter((debt) => debt.id !== id)
                    }))
                  }
                />
                <div className="grid grid-cols-2 gap-3">
                  <AppButton variant="secondary" onClick={() => setStep(1)}>
                    Voltar
                  </AppButton>
                  <AppButton onClick={() => setStep(3)} icon={<ArrowRight size={18} />}>
                    Continuar
                  </AppButton>
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-5">
                <SectionTitle
                  eyebrow="Plano"
                  title="Escolha o primeiro estilo de quitação."
                  description="Você poderá trocar a estratégia quando quiser."
                />
                <StrategyPicker
                  value={data.strategy}
                  onChange={(strategy) =>
                    updateData((previous) => ({
                      ...previous,
                      strategy
                    }))
                  }
                />
                <label className="grid gap-2 text-sm font-semibold text-ocean">
                  Primeiro objetivo depois de organizar as dívidas
                  <input
                    className="field"
                    placeholder="Ex.: reserva, viagem, moto, casa"
                    defaultValue={data.onboarding.firstGoal}
                    onBlur={(event) =>
                      updateData((previous) => ({
                        ...previous,
                        onboarding: {
                          ...previous.onboarding,
                          firstGoal: event.target.value
                        }
                      }))
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <AppButton variant="secondary" onClick={() => setStep(2)}>
                    Voltar
                  </AppButton>
                  <AppButton
                    onClick={() =>
                      updateData((previous) => ({
                        ...previous,
                        onboarding: {
                          ...previous.onboarding,
                          complete: true,
                          step: 3
                        }
                      }))
                    }
                    icon={<CheckCircle2 size={18} />}
                  >
                    Abrir meu mapa
                  </AppButton>
                </div>
              </section>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </main>
  );
}

function AppHeader({
  data,
  view,
  earnedCount,
  installAvailable,
  onInstall,
  onNavigate
}: {
  data: AppData;
  view: ViewKey;
  earnedCount: number;
  installAvailable: boolean;
  onInstall: () => void;
  onNavigate: (view: ViewKey) => void;
}) {
  const pageTitle: Record<ViewKey, string> = {
    today: "Hoje",
    map: "Mapa financeiro",
    plan: "Plano",
    calendar: "Calendário",
    assistant: "Assistente",
    achievements: "Conquistas",
    profile: "Perfil"
  };

  return (
    <header className="sticky top-0 z-20 border-b border-ocean/8 bg-cloud/94 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ocean/62">Olá, {data.profile?.name.split(" ")[0]}</p>
          <h1 className="text-xl font-black">{pageTitle[view]}</h1>
        </div>
        <div className="flex items-center gap-2">
          {installAvailable && (
            <IconButton label="Instalar aplicativo" onClick={onInstall} icon={Download} />
          )}
          <button
            type="button"
            onClick={() => onNavigate("achievements")}
            className="flex h-10 items-center gap-2 rounded-[8px] border border-ocean/10 bg-white px-3 text-sm font-bold text-ocean shadow-sm"
          >
            <Trophy size={17} className="text-amber" />
            {earnedCount}
          </button>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 overflow-x-auto app-scrollbar">
        <Badge tone="orange">Modo local demonstrativo</Badge>
        {data.demoDataLoaded && <Badge tone="green">Dados de exemplo ativos</Badge>}
        <Badge tone="blue">PWA instalável</Badge>
      </div>
    </header>
  );
}

function TodayView({
  data,
  updateData,
  onNavigate
}: {
  data: AppData;
  updateData: (updater: AppData | ((previous: AppData) => AppData)) => void;
  onNavigate: (view: ViewKey) => void;
}) {
  const remaining = totalRemaining(data.debts);
  const paid = totalPaid(data.debts);
  const progress = progressRatio(data.debts);
  const plan = buildPayoffPlan(data);
  const next = plan[0];
  const actions = buildDailyActions(data);
  const calendar = upcomingCalendar(data, 1).slice(0, 3);
  const journey = calculateJourney(data);

  return (
    <div className="space-y-4">
      <section className="rounded-[8px] bg-ink p-5 text-white shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/66">Progresso geral</p>
            <h2 className="mt-2 text-4xl font-black">{percent.format(progress)}</h2>
          </div>
          <ProgressOrb progress={progress} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <DarkMetric label="Em aberto" value={formatMoney(remaining)} />
          <DarkMetric label="Já quitado" value={formatMoney(paid)} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <MetricCard icon={WalletCards} label="Renda" value={formatMoney(data.income.monthly)} tone="blue" />
        <MetricCard icon={Home} label="Gastos" value={formatMoney(totalExpenses(data))} tone="orange" />
      </section>

      <JourneyCard journey={journey} />

      <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black">Seu plano de hoje</h2>
          <IconButton label="Abrir calendário" icon={CalendarDays} onClick={() => onNavigate("calendar")} />
        </div>
        <div className="space-y-3">
          {actions.map((action) => (
            <div key={action} className="rounded-[8px] bg-mist p-3">
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 shrink-0 text-leaf" size={18} />
                <p className="text-sm leading-5 text-ocean">{action}</p>
              </div>
              <button
                type="button"
                disabled={actionCompletedToday(data, action)}
                onClick={() => completeDailyAction(updateData, action)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-[8px] bg-white px-3 py-2 text-xs font-black text-ocean disabled:opacity-55"
              >
                <Sparkles size={15} className="text-amber" />
                {actionCompletedToday(data, action) ? "Ação concluída hoje" : "Feito +25 XP"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {next && (
        <section className="rounded-[8px] border border-leaf/20 bg-leaf/10 p-4">
          <p className="text-xs font-bold uppercase text-leaf">Próxima prioridade</p>
          <h2 className="mt-2 text-xl font-black">{next.debt.name}</h2>
          <p className="mt-2 text-sm leading-6 text-ocean/76">
            {next.reason} Previsão demonstrativa: {formatMonthYear(next.finishDate)}.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <AppButton variant="secondary" onClick={() => onNavigate("plan")}>
              Ver plano
            </AppButton>
            <AppButton
              onClick={() => registerPayment(updateData, next.debt.id, next.debt.minimumPayment)}
              icon={<CheckCircle2 size={18} />}
            >
              Registrar
            </AppButton>
          </div>
        </section>
      )}

      <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">Próximos vencimentos</h2>
          <button type="button" onClick={() => onNavigate("calendar")} className="text-sm font-bold text-aqua">
            Ver todos
          </button>
        </div>
        <CalendarList items={calendar} compact />
      </section>
    </div>
  );
}

function MapView({
  data,
  updateData,
  onNavigate
}: {
  data: AppData;
  updateData: (updater: AppData | ((previous: AppData) => AppData)) => void;
  onNavigate: (view: ViewKey) => void;
}) {
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.88);
  const selectedDebt = data.debts.find((debt) => debt.id === selectedDebtId) ?? null;
  const nodes = useMemo(() => buildTreeNodes(data), [data]);
  const lines = useMemo(() => buildTreeLines(data), [data]);

  return (
    <div className="space-y-4">
      <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-aqua">Árvore financeira</p>
            <h2 className="mt-1 text-xl font-black">Toque em uma dívida para ver o detalhe.</h2>
          </div>
          <div className="flex gap-2">
            <IconButton label="Aproximar" icon={ZoomIn} onClick={() => setScale((value) => Math.min(value + 0.08, 1.18))} />
            <IconButton label="Afastar" icon={ZoomOut} onClick={() => setScale((value) => Math.max(value - 0.08, 0.68))} />
          </div>
        </div>
      </section>

      <section className="h-[560px] overflow-hidden rounded-[8px] border border-ocean/8 bg-[linear-gradient(180deg,#FFFFFF,#EDF5F8)] shadow-sm">
        <motion.div
          className="relative h-[620px] w-[760px]"
          drag
          dragConstraints={{ left: -280, right: 50, top: -120, bottom: 90 }}
          style={{ scale }}
          initial={{ x: -150, y: -24 }}
        >
          {lines.map((line) => {
            const from = nodes.find((node) => node.id === line.from);
            const to = nodes.find((node) => node.id === line.to);
            if (!from || !to) return null;
            return <TreeConnection key={`${line.from}-${line.to}`} from={from} to={to} />;
          })}
          {nodes.map((node) => (
            <TreeNodeButton
              key={node.id}
              node={node}
              active={node.debtId === selectedDebtId}
              onClick={() => {
                if (node.debtId) setSelectedDebtId(node.debtId);
              }}
            />
          ))}
        </motion.div>
      </section>

      <AnimatePresence>
        {selectedDebt && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-aqua">{selectedDebt.creditor}</p>
                <h2 className="mt-1 text-xl font-black">{selectedDebt.name}</h2>
              </div>
              <IconButton label="Fechar" icon={X} onClick={() => setSelectedDebtId(null)} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricCard icon={AlertTriangle} label="Restante" value={formatMoney(remainingDebt(selectedDebt))} tone={selectedDebt.urgent ? "orange" : "blue"} />
              <MetricCard icon={DollarSign} label="Parcela" value={formatMoney(selectedDebt.minimumPayment)} tone="green" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <AppButton variant="secondary" onClick={() => onNavigate("plan")}>
                Ver no plano
              </AppButton>
              <AppButton
                onClick={() => registerPayment(updateData, selectedDebt.id, selectedDebt.minimumPayment)}
                icon={<CheckCircle2 size={18} />}
              >
                Registrar
              </AppButton>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlanView({
  data,
  updateData
}: {
  data: AppData;
  updateData: (updater: AppData | ((previous: AppData) => AppData)) => void;
}) {
  const plan = buildPayoffPlan(data);
  const capacity = paymentCapacity(data);

  return (
    <div className="space-y-4">
      <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
        <SectionTitle
          eyebrow="Estratégia"
          title={strategyLabel(data.strategy)}
          description="Estimativa demonstrativa baseada apenas nos valores cadastrados."
        />
        <div className="mt-4">
          <StrategyPicker
            value={data.strategy}
            onChange={(strategy) =>
              updateData((previous) => ({
                ...previous,
                strategy
              }))
            }
          />
        </div>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            updateData((previous) => ({
              ...previous,
              onboarding: {
                ...previous.onboarding,
                monthlyCapacity: moneyToNumber(form.get("capacity"))
              }
            }));
          }}
        >
          <label className="grid gap-2 text-sm font-semibold text-ocean">
            Capacidade mensal para dívidas
            <input className="field" name="capacity" inputMode="decimal" defaultValue={capacity || ""} />
          </label>
          <AppButton type="submit" variant="secondary" icon={<RefreshCcw size={18} />}>
            Recalcular plano
          </AppButton>
        </form>
      </section>

      <section className="space-y-3">
        {plan.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhuma dívida aberta"
            description="Cadastre uma dívida para o Organiza+ criar a ordem de quitação."
          />
        ) : (
          plan.map((item, index) => (
            <motion.article
              key={item.debt.id}
              className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-ink text-sm font-black text-white">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black">{item.debt.name}</h3>
                  <p className="mt-1 text-sm leading-5 text-ocean/70">{item.reason}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <TinyStat label="Restante" value={formatMoney(item.remaining)} />
                <TinyStat label="Mensal" value={formatMoney(item.monthlyAllocated)} />
                <TinyStat label="Fim" value={formatMonthYear(item.finishDate)} />
              </div>
              <AppButton
                className="mt-4"
                onClick={() => registerPayment(updateData, item.debt.id, item.debt.minimumPayment)}
                icon={<CheckCircle2 size={18} />}
              >
                Registrar parcela
              </AppButton>
            </motion.article>
          ))
        )}
      </section>

      <FinancialDataSection data={data} updateData={updateData} />
    </div>
  );
}

function CalendarView({ data }: { data: AppData }) {
  const items = upcomingCalendar(data, 3);
  const totalNextMonth = items.slice(0, 12).reduce((sum, item) => sum + item.amount, 0);
  const urgentCount = items.filter((item) => item.urgent).length;

  return (
    <div className="space-y-4">
      <section className="rounded-[8px] bg-ink p-5 text-white shadow-soft">
        <p className="text-sm text-white/64">Próximos lançamentos</p>
        <h2 className="mt-2 text-3xl font-black">{formatMoney(totalNextMonth)}</h2>
        <p className="mt-2 text-sm text-white/72">{urgentCount} itens essenciais ou urgentes no calendário.</p>
      </section>
      <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
        <CalendarList items={items} />
      </section>
    </div>
  );
}

function AssistantView({ data }: { data: AppData }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      text: "Estou em modo demonstrativo local. Posso priorizar dívidas, montar uma mensagem de negociação ou explicar o próximo passo usando os dados salvos neste aparelho."
    }
  ]);
  const [input, setInput] = useState("");

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const reply = generateLocalAssistantReply(trimmed, data);
    setMessages((previous) => [
      ...previous,
      { role: "user", text: trimmed },
      { role: "assistant", text: reply }
    ]);
    setInput("");
  }

  const shortcuts = ["Qual dívida pagar primeiro?", "Quanto posso guardar?", "Crie uma mensagem para negociar"];

  return (
    <div className="space-y-4">
      <section className="rounded-[8px] border border-aqua/20 bg-aqua/10 p-4">
        <div className="flex gap-3">
          <Brain className="mt-1 shrink-0 text-aqua" size={22} />
          <div>
            <h2 className="text-lg font-black">Assistente contextual</h2>
            <p className="mt-1 text-sm leading-5 text-ocean/75">
              Esta versão responde localmente. Com uma chave OpenAI, a rota de IA já está pronta para evoluir.
            </p>
          </div>
        </div>
      </section>

      <section className="max-h-[460px] space-y-3 overflow-y-auto rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm app-scrollbar">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={cn(
              "max-w-[86%] rounded-[8px] px-3 py-2 text-sm leading-6",
              message.role === "assistant"
                ? "bg-mist text-ocean"
                : "ml-auto bg-ink text-white"
            )}
          >
            {message.text}
          </div>
        ))}
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut}
            type="button"
            onClick={() => sendMessage(shortcut)}
            className="shrink-0 rounded-[8px] border border-ocean/10 bg-white px-3 py-2 text-xs font-bold text-ocean"
          >
            {shortcut}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(input);
        }}
      >
        <input
          className="field"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pergunte sobre seu plano"
        />
        <AppButton type="submit" className="w-14 shrink-0 px-0" aria-label="Enviar mensagem">
          <ArrowRight size={19} />
        </AppButton>
      </form>
    </div>
  );
}

function AchievementsView({ data }: { data: AppData }) {
  const earned = achievements.filter((achievement) => achievement.isEarned(data)).length;
  const journey = calculateJourney(data);

  return (
    <div className="space-y-4">
      <JourneyCard journey={journey} />

      <section className="rounded-[8px] bg-ink p-5 text-white shadow-soft">
        <p className="text-sm text-white/64">Conquistas desbloqueadas</p>
        <h2 className="mt-2 text-3xl font-black">
          {earned}/{achievements.length}
        </h2>
        <p className="mt-2 text-sm text-white/72">A árvore evolui conforme você registra dados e pagamentos.</p>
      </section>
      <section className="grid gap-3">
        {achievements.map((achievement) => {
          const Icon = achievement.icon;
          const isEarned = achievement.isEarned(data);
          return (
            <article
              key={achievement.id}
              className={cn(
                "rounded-[8px] border p-4 shadow-sm",
                isEarned ? "border-leaf/25 bg-white" : "border-ocean/8 bg-white/74"
              )}
            >
              <div className="flex gap-3">
                <div
                  className={cn(
                    "grid h-11 w-11 shrink-0 place-items-center rounded-[8px]",
                    isEarned ? "bg-leaf text-white" : "bg-mist text-ocean/42"
                  )}
                >
                  <Icon size={21} />
                </div>
                <div>
                  <h3 className="font-black">{achievement.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-ocean/68">{achievement.description}</p>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function ProfileView({
  data,
  updateData,
  earnedCount,
  installAvailable,
  onInstall,
  onNavigate
}: {
  data: AppData;
  updateData: (updater: AppData | ((previous: AppData) => AppData)) => void;
  earnedCount: number;
  installAvailable: boolean;
  onInstall: () => void;
  onNavigate: (view: ViewKey) => void;
}) {
  const journey = calculateJourney(data);

  return (
    <div className="space-y-4">
      <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-[8px] bg-ink text-xl font-black text-white">
            {data.profile?.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-black">{data.profile?.name}</h2>
            <p className="text-sm text-ocean/68">{data.profile?.email}</p>
          </div>
        </div>
        <form
          className="mt-5 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            updateData((previous) => ({
              ...previous,
              profile: {
                name: textValue(form.get("name")) || previous.profile?.name || "Usuário Organiza+",
                email: textValue(form.get("email")) || previous.profile?.email || "demo@organizamais.local",
                createdAt: previous.profile?.createdAt || new Date().toISOString()
              }
            }));
          }}
        >
          <input className="field" name="name" defaultValue={data.profile?.name} />
          <input className="field" name="email" type="email" defaultValue={data.profile?.email} />
          <AppButton type="submit" variant="secondary" icon={<CheckCircle2 size={18} />}>
            Salvar perfil
          </AppButton>
        </form>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onNavigate("achievements")}
          className="rounded-[8px] border border-ocean/8 bg-white p-4 text-left shadow-sm"
        >
          <Trophy className="text-amber" size={22} />
          <p className="mt-3 text-2xl font-black">{earnedCount}</p>
          <p className="text-sm text-ocean/68">Conquistas</p>
        </button>
        <button
          type="button"
          onClick={() => onNavigate("calendar")}
          className="rounded-[8px] border border-ocean/8 bg-white p-4 text-left shadow-sm"
        >
          <CalendarDays className="text-aqua" size={22} />
          <p className="mt-3 text-2xl font-black">{upcomingCalendar(data, 1).length}</p>
          <p className="text-sm text-ocean/68">Vencimentos</p>
        </button>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <MetricCard icon={Sparkles} label="Nível" value={`${journey.level}`} tone="green" />
        <MetricCard icon={Target} label="XP total" value={`${journey.xp}`} tone="orange" />
      </section>

      <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
        <SectionTitle
          eyebrow="Configurações"
          title="Controle dos dados"
          description="Tudo abaixo se refere ao modo local demonstrativo deste MVP."
        />
        <div className="mt-4 grid gap-3">
          {installAvailable && (
            <AppButton variant="secondary" onClick={onInstall} icon={<Download size={18} />}>
              Instalar na tela inicial
            </AppButton>
          )}
          <AppButton variant="secondary" onClick={() => exportData(data)} icon={<Download size={18} />}>
            Exportar dados locais
          </AppButton>
          <AppButton
            variant="danger"
            onClick={() => {
              if (window.confirm("Apagar todos os dados locais do Organiza+ neste aparelho?")) {
                window.localStorage.removeItem(storageKey);
                updateData(emptyData());
              }
            }}
            icon={<Trash2 size={18} />}
          >
            Apagar dados locais
          </AppButton>
        </div>
      </section>

      <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
        <SectionTitle eyebrow="Integrações" title="Preparado para evoluir" />
        <div className="mt-4 grid gap-3">
          <IntegrationRow icon={ShieldCheck} title="Supabase" description="Autenticação e banco prontos para conectar por variáveis de ambiente." />
          <IntegrationRow icon={Brain} title="OpenAI" description="Rota de assistente pronta. Sem chave, o app usa respostas demonstrativas locais." />
          <IntegrationRow icon={Bell} title="PWA" description="Manifesto e service worker configurados para instalação." />
        </div>
      </section>
    </div>
  );
}

function FinancialDataSection({
  data,
  updateData
}: {
  data: AppData;
  updateData: (updater: AppData | ((previous: AppData) => AppData)) => void;
}) {
  const [panel, setPanel] = useState<"income" | "expenses" | "debts">("debts");

  return (
    <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
      <SectionTitle eyebrow="Dados" title="Ajustar base financeira" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["income", "Renda"],
          ["expenses", "Gastos"],
          ["debts", "Dívidas"]
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPanel(key as "income" | "expenses" | "debts")}
            className={cn(
              "rounded-[8px] px-3 py-2 text-sm font-bold",
              panel === key ? "bg-ink text-white" : "bg-mist text-ocean"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {panel === "income" && (
          <form
            className="grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              updateData((previous) => ({
                ...previous,
                income: {
                  monthly: moneyToNumber(form.get("income")),
                  kind: form.get("kind") === "variavel" ? "variavel" : "fixa",
                  payday: Number(form.get("payday")) || 5
                }
              }));
            }}
          >
            <label className="grid gap-2 text-sm font-semibold text-ocean">
              Renda mensal
              <input className="field" name="income" inputMode="decimal" defaultValue={data.income.monthly || ""} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <select className="field" name="kind" defaultValue={data.income.kind}>
                <option value="fixa">Fixa</option>
                <option value="variavel">Variável</option>
              </select>
              <input className="field" name="payday" type="number" min={1} max={28} defaultValue={data.income.payday} />
            </div>
            <AppButton type="submit" variant="secondary" icon={<CheckCircle2 size={18} />}>
              Salvar renda
            </AppButton>
          </form>
        )}

        {panel === "expenses" && (
          <div className="space-y-4">
            <ExpenseForm
              onAdd={(expense) =>
                updateData((previous) => ({
                  ...previous,
                  expenses: [...previous.expenses, expense]
                }))
              }
            />
            <ExpenseList
              expenses={data.expenses}
              onRemove={(id) =>
                updateData((previous) => ({
                  ...previous,
                  expenses: previous.expenses.filter((expense) => expense.id !== id)
                }))
              }
            />
          </div>
        )}

        {panel === "debts" && (
          <div className="space-y-4">
            <DebtForm
              onAdd={(debt) =>
                updateData((previous) => ({
                  ...previous,
                  debts: [...previous.debts, debt]
                }))
              }
            />
            <DebtList
              debts={data.debts}
              onRemove={(id) =>
                updateData((previous) => ({
                  ...previous,
                  debts: previous.debts.filter((debt) => debt.id !== id)
                }))
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}

function ExpenseForm({ onAdd }: { onAdd: (expense: Expense) => void }) {
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const name = textValue(form.get("name"));
        const amount = moneyToNumber(form.get("amount"));
        if (!name || amount <= 0) return;
        onAdd({
          id: createId("expense"),
          name,
          amount,
          dueDay: Number(form.get("dueDay")) || 1,
          essential: form.get("essential") === "on"
        });
        event.currentTarget.reset();
      }}
    >
      <div className="grid grid-cols-[1fr_110px] gap-3">
        <input className="field" name="name" placeholder="Gasto" />
        <input className="field" name="amount" inputMode="decimal" placeholder="Valor" />
      </div>
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <input className="field" name="dueDay" type="number" min={1} max={28} placeholder="Dia" />
        <label className="flex items-center gap-2 rounded-[8px] bg-mist px-3 py-3 text-sm font-bold text-ocean">
          <input name="essential" type="checkbox" className="h-4 w-4 accent-aqua" />
          Essencial
        </label>
      </div>
      <AppButton type="submit" variant="secondary" icon={<Plus size={18} />}>
        Adicionar gasto
      </AppButton>
    </form>
  );
}

function ExpenseList({ expenses, onRemove }: { expenses: Expense[]; onRemove: (id: string) => void }) {
  if (expenses.length === 0) {
    return <EmptyState icon={Home} title="Sem gastos cadastrados" description="Adicione aluguel, mercado, energia ou outros gastos fixos." compact />;
  }

  return (
    <div className="space-y-2">
      {expenses.map((expense) => (
        <div key={expense.id} className="flex items-center gap-3 rounded-[8px] bg-mist p-3">
          <div className={cn("h-2.5 w-2.5 rounded-full", expense.essential ? "bg-amber" : "bg-aqua")} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{expense.name}</p>
            <p className="text-xs text-ocean/60">Dia {expense.dueDay} • {expense.essential ? "Essencial" : "Flexível"}</p>
          </div>
          <p className="text-sm font-black">{formatMoney(expense.amount)}</p>
          <IconButton label="Remover gasto" icon={Trash2} onClick={() => onRemove(expense.id)} />
        </div>
      ))}
    </div>
  );
}

function DebtForm({ onAdd }: { onAdd: (debt: Debt) => void }) {
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const name = textValue(form.get("name"));
        const total = moneyToNumber(form.get("total"));
        if (!name || total <= 0) return;
        onAdd({
          id: createId("debt"),
          name,
          creditor: textValue(form.get("creditor")) || "Credor não informado",
          category: (form.get("category") || "outro") as DebtCategory,
          total,
          paid: moneyToNumber(form.get("paid")),
          minimumPayment: moneyToNumber(form.get("minimumPayment")),
          interestRate: Number(form.get("interestRate")) || 0,
          dueDay: Number(form.get("dueDay")) || 10,
          urgent: form.get("urgent") === "on",
          notes: textValue(form.get("notes"))
        });
        event.currentTarget.reset();
      }}
    >
      <input className="field" name="name" placeholder="Nome da dívida" />
      <input className="field" name="creditor" placeholder="Credor" />
      <div className="grid grid-cols-2 gap-3">
        <input className="field" name="total" inputMode="decimal" placeholder="Total" />
        <input className="field" name="paid" inputMode="decimal" placeholder="Já pago" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className="field" name="minimumPayment" inputMode="decimal" placeholder="Parcela" />
        <input className="field" name="interestRate" inputMode="decimal" placeholder="Juros %" />
      </div>
      <div className="grid grid-cols-[1fr_88px] gap-3">
        <select className="field" name="category" defaultValue="cartao">
          <option value="cartao">Cartão</option>
          <option value="emprestimo">Empréstimo</option>
          <option value="conta">Conta</option>
          <option value="financiamento">Financiamento</option>
          <option value="loja">Loja</option>
          <option value="outro">Outro</option>
        </select>
        <input className="field" name="dueDay" type="number" min={1} max={28} placeholder="Dia" />
      </div>
      <label className="flex items-center gap-2 rounded-[8px] bg-mist px-3 py-3 text-sm font-bold text-ocean">
        <input name="urgent" type="checkbox" className="h-4 w-4 accent-amber" />
        Tem risco de corte, atraso crítico ou impacto imediato
      </label>
      <textarea className="field min-h-20 resize-none" name="notes" placeholder="Observações" />
      <AppButton type="submit" variant="secondary" icon={<Plus size={18} />}>
        Adicionar dívida
      </AppButton>
    </form>
  );
}

function DebtList({ debts, onRemove }: { debts: Debt[]; onRemove: (id: string) => void }) {
  if (debts.length === 0) {
    return <EmptyState icon={AlertTriangle} title="Sem dívidas cadastradas" description="Adicione pelo menos uma dívida para gerar a árvore." compact />;
  }

  return (
    <div className="space-y-2">
      {debts.map((debt) => (
        <div key={debt.id} className="flex items-center gap-3 rounded-[8px] bg-mist p-3">
          <div className={cn("h-2.5 w-2.5 rounded-full", debt.urgent ? "bg-amber" : "bg-aqua")} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{debt.name}</p>
            <p className="text-xs text-ocean/60">{debt.creditor} • resta {formatMoney(remainingDebt(debt))}</p>
          </div>
          <IconButton label="Remover dívida" icon={Trash2} onClick={() => onRemove(debt.id)} />
        </div>
      ))}
    </div>
  );
}

function StrategyPicker({
  value,
  onChange
}: {
  value: StrategyKind;
  onChange: (strategy: StrategyKind) => void;
}) {
  return (
    <div className="grid gap-2">
      {(Object.keys(strategyCopy) as StrategyKind[]).map((strategy) => {
        const item = strategyCopy[strategy];
        const Icon = item.icon;
        const active = value === strategy;
        return (
          <button
            key={strategy}
            type="button"
            onClick={() => onChange(strategy)}
            className={cn(
              "flex items-start gap-3 rounded-[8px] border p-3 text-left transition",
              active ? "border-aqua bg-aqua/10" : "border-ocean/8 bg-white"
            )}
          >
            <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[8px]", active ? "bg-aqua text-white" : "bg-mist text-ocean")}>
              <Icon size={19} />
            </div>
            <div>
              <p className="font-black">{item.title}</p>
              <p className="mt-1 text-sm leading-5 text-ocean/68">{item.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function BottomNav({ active, onNavigate }: { active: ViewKey; onNavigate: (view: ViewKey) => void }) {
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t border-ocean/8 bg-white/96 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur">
      <div className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key || (active === "calendar" && item.key === "today") || (active === "achievements" && item.key === "profile");
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-1 rounded-[8px] text-[11px] font-bold",
                isActive ? "bg-ink text-white" : "text-ocean/62"
              )}
            >
              <Icon size={19} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function CalendarList({ items, compact = false }: { items: CalendarItem[]; compact?: boolean }) {
  if (items.length === 0) {
    return <EmptyState icon={CalendarDays} title="Calendário vazio" description="Cadastre gastos e dívidas para ver os vencimentos." compact />;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 rounded-[8px] bg-mist p-3">
          <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[8px] text-white", item.type === "debt" ? "bg-amber" : "bg-ocean")}>
            {item.type === "debt" ? <AlertTriangle size={18} /> : <Home size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{item.title}</p>
            <p className="text-xs text-ocean/62">{formatShortDate(item.date)} • {item.urgent ? "prioridade" : "programado"}</p>
          </div>
          {!compact && <p className="text-sm font-black">{formatMoney(item.amount)}</p>}
          {compact && <ChevronRight size={18} className="text-ocean/40" />}
        </div>
      ))}
    </div>
  );
}

function TreeConnection({ from, to }: { from: TreeNode; to: TreeNode }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const width = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <div
      className="tree-line"
      style={{
        left: from.x,
        top: from.y,
        width,
        transform: `rotate(${angle}deg)`
      }}
    />
  );
}

function TreeNodeButton({
  node,
  active,
  onClick
}: {
  node: TreeNode;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = node.icon;
  const toneClass = {
    root: "bg-ink text-white border-ink shadow-glow",
    blue: "bg-white text-ocean border-ocean/10",
    green: "bg-leaf text-white border-leaf",
    orange: "bg-amber text-white border-amber",
    danger: "bg-white text-danger border-danger/28"
  }[node.tone];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute flex min-h-[70px] w-[128px] flex-col items-center justify-center rounded-[8px] border px-3 py-3 text-center shadow-sm",
        toneClass,
        active && "ring-4 ring-aqua/25"
      )}
      style={{ left: node.x, top: node.y, transform: "translate(-50%, -50%)" }}
      whileTap={{ scale: 0.96 }}
    >
      <Icon size={20} />
      <span className="mt-2 text-sm font-black leading-4">{node.label}</span>
      <span className={cn("mt-1 text-[11px] leading-4", node.tone === "root" || node.tone === "green" || node.tone === "orange" ? "text-white/78" : "text-ocean/62")}>
        {node.sublabel}
      </span>
    </motion.button>
  );
}

function buildTreeNodes(data: AppData): TreeNode[] {
  const debtNodes = data.debts.slice(0, 5).map((debt, index) => ({
    id: `debt-${debt.id}`,
    label: debt.name,
    sublabel: formatMoney(remainingDebt(debt)),
    x: 650,
    y: 110 + index * 88,
    icon: debt.urgent ? AlertTriangle : WalletCards,
    tone: debt.urgent ? "orange" : "blue",
    debtId: debt.id
  })) satisfies TreeNode[];

  return [
    {
      id: "root",
      label: "Minha vida",
      sublabel: percent.format(progressRatio(data.debts)),
      x: 380,
      y: 300,
      icon: Leaf,
      tone: "root"
    },
    {
      id: "income",
      label: "Renda",
      sublabel: formatMoney(data.income.monthly),
      x: 170,
      y: 150,
      icon: WalletCards,
      tone: "green"
    },
    {
      id: "expenses",
      label: "Gastos",
      sublabel: formatMoney(totalExpenses(data)),
      x: 170,
      y: 450,
      icon: Home,
      tone: "blue"
    },
    {
      id: "debts",
      label: "Dívidas",
      sublabel: formatMoney(totalRemaining(data.debts)),
      x: 550,
      y: 300,
      icon: AlertTriangle,
      tone: data.debts.some((debt) => debt.urgent && remainingDebt(debt) > 0) ? "orange" : "blue"
    },
    {
      id: "plan",
      label: "Plano",
      sublabel: strategyLabel(data.strategy),
      x: 380,
      y: 90,
      icon: ClipboardCheck,
      tone: "blue"
    },
    {
      id: "goal",
      label: "Próxima meta",
      sublabel: data.onboarding.firstGoal || "A definir",
      x: 380,
      y: 520,
      icon: Target,
      tone: "green"
    },
    ...debtNodes
  ];
}

function buildTreeLines(data: AppData): TreeLine[] {
  return [
    { from: "root", to: "income" },
    { from: "root", to: "expenses" },
    { from: "root", to: "debts" },
    { from: "root", to: "plan" },
    { from: "root", to: "goal" },
    ...data.debts.slice(0, 5).map((debt) => ({ from: "debts", to: `debt-${debt.id}` }))
  ];
}

function registerPayment(
  updateData: (updater: AppData | ((previous: AppData) => AppData)) => void,
  debtId: string,
  amount: number
) {
  updateData((previous) => ({
    ...previous,
    debts: previous.debts.map((debt) =>
      debt.id === debtId
        ? {
            ...debt,
            paid: Math.min(debt.total, debt.paid + Math.max(amount, 0))
          }
        : debt
    ),
    payments: [
      ...previous.payments,
      {
        id: createId("payment"),
        debtId,
        amount,
        paidAt: new Date().toISOString()
      }
    ]
  }));
}

function completeDailyAction(
  updateData: (updater: AppData | ((previous: AppData) => AppData)) => void,
  title: string
) {
  updateData((previous) => {
    if (actionCompletedToday(previous, title)) return previous;
    return {
      ...previous,
      completedActions: [
        ...previous.completedActions,
        {
          id: createId("action"),
          title,
          xp: 25,
          completedAt: new Date().toISOString()
        }
      ]
    };
  });
}

function exportData(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "organiza-plus-dados-locais.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function AnimatedTreePreview() {
  return (
    <div className="relative mx-auto h-36 w-64">
      <motion.div
        className="absolute left-1/2 top-10 h-24 w-1 -translate-x-1/2 rounded-full bg-aqua"
        initial={{ height: 0 }}
        animate={{ height: 96 }}
        transition={{ duration: 0.8, delay: 0.15 }}
      />
      {([
        ["left-7 top-4", "bg-amber", 0.2],
        ["right-7 top-4", "bg-leaf", 0.32],
        ["left-0 bottom-0", "bg-white", 0.44],
        ["right-0 bottom-0", "bg-aqua", 0.56],
        ["left-1/2 top-0 -translate-x-1/2", "bg-white", 0.68]
      ] as const).map(([position, color, delay]) => (
        <motion.div
          key={position}
          className={cn("absolute grid h-16 w-16 place-items-center rounded-full text-sm font-black text-ink shadow-glow", position, color)}
          initial={{ opacity: 0, scale: 0.62 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: Number(delay) }}
        >
          +
        </motion.div>
      ))}
    </div>
  );
}

function BrandLockup({ contrast = false }: { contrast?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div>
        <p className={cn("text-xl font-black", contrast ? "text-white" : "text-ink")}>Organiza+</p>
        <p className={cn("text-xs font-semibold", contrast ? "text-white/56" : "text-ocean/56")}>Dívidas em mapa</p>
      </div>
    </div>
  );
}

function LogoMark({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-[8px] bg-gradient-to-br from-aqua via-leaf to-amber text-ink shadow-glow",
        size === "lg" ? "h-20 w-20" : "h-11 w-11"
      )}
    >
      <Leaf size={size === "lg" ? 34 : 22} strokeWidth={3} />
      <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-white text-[10px] font-black">
        +
      </span>
    </div>
  );
}

function MiniTrust({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="rounded-[8px] bg-white/8 p-2">
      <Icon className="mb-2 text-aqua" size={17} />
      <p className="leading-4">{label}</p>
    </div>
  );
}

function AppButton({
  variant = "primary",
  icon,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
}) {
  const variantClass: Record<ButtonVariant, string> = {
    primary: "bg-ink text-white shadow-soft hover:bg-ocean",
    secondary: "border border-ocean/10 bg-white text-ocean shadow-sm hover:bg-mist",
    ghost: "bg-transparent text-ocean hover:bg-mist",
    danger: "bg-danger text-white shadow-sm hover:brightness-95"
  };

  return (
    <button
      {...props}
      className={cn(
        "flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50",
        variantClass[variant],
        className
      )}
    >
      {children}
      {icon}
    </button>
  );
}

function IconButton({
  label,
  icon: Icon,
  onClick
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-ocean/10 bg-white text-ocean shadow-sm transition hover:bg-mist"
    >
      <Icon size={18} />
    </button>
  );
}

function Badge({ tone, children }: { tone: "blue" | "green" | "orange"; children: React.ReactNode }) {
  const toneClass = {
    blue: "bg-ocean/10 text-ocean",
    green: "bg-leaf/12 text-leaf",
    orange: "bg-amber/14 text-ocean"
  }[tone];

  return <span className={cn("shrink-0 rounded-full px-3 py-1 text-[11px] font-black", toneClass)}>{children}</span>;
}

function SectionTitle({
  eyebrow,
  title,
  description
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow && <p className="text-xs font-black uppercase text-aqua">{eyebrow}</p>}
      <h2 className="mt-1 text-xl font-black leading-tight">{title}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-ocean/70">{description}</p>}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "blue" | "green" | "orange";
}) {
  const toneClass = {
    blue: "bg-ocean text-white",
    green: "bg-leaf text-white",
    orange: "bg-amber text-white"
  }[tone];

  return (
    <div className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
      <div className={cn("grid h-10 w-10 place-items-center rounded-[8px]", toneClass)}>
        <Icon size={19} />
      </div>
      <p className="mt-4 text-xs font-bold text-ocean/58">{label}</p>
      <p className="mt-1 break-words text-lg font-black">{value}</p>
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-white/8 p-3">
      <p className="text-xs text-white/56">{label}</p>
      <p className="mt-1 break-words text-base font-black">{value}</p>
    </div>
  );
}

function TinyStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-mist p-3">
      <p className="text-[11px] font-bold text-ocean/56">{label}</p>
      <p className="mt-1 break-words text-sm font-black">{value}</p>
    </div>
  );
}

function ProgressOrb({ progress }: { progress: number }) {
  return (
    <div
      className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#25B276 ${progress * 360}deg, rgba(255,255,255,0.14) 0deg)`
      }}
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-ink text-sm font-black">
        {percent.format(progress)}
      </div>
    </div>
  );
}

function JourneyCard({ journey }: { journey: ReturnType<typeof calculateJourney> }) {
  return (
    <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase text-amber">Jornada Organiza+</p>
          <h2 className="mt-1 text-xl font-black">
            Nível {journey.level}: {journey.levelTitle}
          </h2>
          <p className="mt-2 text-sm leading-5 text-ocean/68">
            Próximo marco: {journey.nextMilestone}.
          </p>
        </div>
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[8px] bg-ink text-white">
          <Sparkles size={22} className="text-amber" />
          <span className="-mt-2 text-xs font-black">{journey.xp} XP</span>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-ocean/62">
          <span>{journey.currentLevelXp} XP</span>
          <span>{journey.nextLevelXp} XP</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-mist">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-aqua via-leaf to-amber"
            initial={false}
            animate={{ width: `${Math.round(journey.progress * 100)}%` }}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <TinyStat label="Sequência" value={`${journey.streak} dia${journey.streak === 1 ? "" : "s"}`} />
        <TinyStat label="Faltam" value={`${journey.nextLevelXp - journey.currentLevelXp} XP`} />
      </div>
    </section>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  compact = false
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("rounded-[8px] border border-dashed border-ocean/18 bg-white/70 text-center", compact ? "p-4" : "p-8")}>
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-[8px] bg-mist text-ocean">
        <Icon size={20} />
      </div>
      <h3 className="mt-3 font-black">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-ocean/64">{description}</p>
    </div>
  );
}

function IntegrationRow({
  icon: Icon,
  title,
  description
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3 rounded-[8px] bg-mist p-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-white text-ocean">
        <Icon size={19} />
      </div>
      <div>
        <p className="font-black">{title}</p>
        <p className="mt-1 text-sm leading-5 text-ocean/66">{description}</p>
      </div>
    </div>
  );
}
