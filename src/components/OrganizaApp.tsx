"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Laptop,
  Leaf,
  Lock,
  LucideIcon,
  Map,
  PiggyBank,
  Plus,
  RefreshCcw,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Star,
  Target,
  Trash2,
  Trophy,
  UserRound,
  WalletCards,
  X
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
import { supabase } from "@/lib/supabase";
import { cloudReady, loadCloudData, resetCloudData, saveCloudData } from "@/lib/cloudSync";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type AuthPayload = { name: string; email: string; password: string };
type SyncStatus = "local" | "checking" | "online" | "saving" | "error";
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type CelebrationEvent = {
  id: string;
  kind: "achievement" | "level";
  title: string;
  message: string;
  level?: number;
};

type AssistantMessage = {
  role: "user" | "assistant";
  text: string;
};

type JourneyStepState = "done" | "current" | "future" | "locked";
type FinancialPanel = "income" | "expenses" | "debts";

type JourneyStep = {
  id: string;
  label: string;
  sublabel: string;
  icon: LucideIcon;
  tone: "ink" | "blue" | "green" | "orange" | "muted";
  state: JourneyStepState;
  xp: number;
  building: "hall" | "income" | "expenses" | "debts" | "plan" | "goal";
  panel?: FinancialPanel;
  target?: ViewKey;
  debtId?: string;
};

type JourneyPoint = {
  x: number;
  y: number;
};

const navItems: Array<{ key: ViewKey; label: string; icon: LucideIcon }> = [
  { key: "today", label: "Hoje", icon: Home },
  { key: "map", label: "Mapa", icon: Map },
  { key: "plan", label: "Plano", icon: ClipboardCheck },
  { key: "profile", label: "Perfil", icon: UserRound }
];

const celebrationStars = [
  { className: "left-4 top-8", delay: 0, size: 18 },
  { className: "right-7 top-7", delay: 0.08, size: 22 },
  { className: "left-10 top-32", delay: 0.16, size: 15 },
  { className: "right-10 top-36", delay: 0.24, size: 17 },
  { className: "left-1/2 top-5 -translate-x-1/2", delay: 0.32, size: 20 },
  { className: "left-8 bottom-20", delay: 0.4, size: 18 },
  { className: "right-8 bottom-24", delay: 0.48, size: 15 },
  { className: "left-1/2 bottom-12 -translate-x-1/2", delay: 0.56, size: 22 }
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

function readableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
  }

  if (lower.includes("user already registered") || lower.includes("already registered")) {
    return "Ja existe uma conta com este e-mail. Use Entrar na conta ou cadastre outro e-mail.";
  }

  if (lower.includes("password")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }

  if (lower.includes("email not confirmed")) {
    return "Conta criada, mas o e-mail ainda precisa ser confirmado antes de entrar.";
  }

  return message || "Nao foi possivel concluir agora. Confira os dados e tente novamente.";
}

function appIsStandalone() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

export function OrganizaApp() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<AppData>(() => emptyData());
  const [authMode, setAuthMode] = useState<"opening" | "login" | "signup">("opening");
  const [view, setView] = useState<ViewKey>("today");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [appInstalled, setAppInstalled] = useState(false);
  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(cloudReady ? "checking" : "local");
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [celebration, setCelebration] = useState<CelebrationEvent | null>(null);
  const [floatingAssistantOpen, setFloatingAssistantOpen] = useState(false);
  const initialCloudSaveSkipped = useRef(false);
  const cloudSaveVersion = useRef(0);
  const celebrationSnapshot = useRef<{ earnedIds: AchievementId[]; level: number } | null>(null);

  useEffect(() => {
    let active = true;
    const stored = window.localStorage.getItem(storageKey);
    let localData = emptyData();

    if (stored) {
      try {
        localData = normalizeData(JSON.parse(stored) as Partial<AppData>);
      } catch {
        localData = emptyData();
      }
    }

    setData(localData);

    async function loadSession() {
      if (!cloudReady || !supabase) {
        setSyncStatus("local");
        setMounted(true);
        return;
      }

      try {
        setSyncStatus("checking");
        const sessionResult = await supabase.auth.getSession();
        if (sessionResult.error) throw sessionResult.error;

        const user = sessionResult.data.session?.user;
        if (!user) {
          if (!active) return;
          setSyncStatus("local");
          setMounted(true);
          return;
        }

        const cloudData = await loadCloudData(user);
        if (!active) return;
        setCloudUserId(user.id);
        setCloudSyncEnabled(true);
        setData(normalizeData(cloudData));
        setSyncStatus("online");
        setMounted(true);
      } catch (error) {
        if (!active) return;
        setAuthError(readableError(error));
        setSyncStatus("error");
        setMounted(true);
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  }, [data, mounted]);

  useEffect(() => {
    if (!mounted || !cloudSyncEnabled || !cloudUserId) return;

    if (!initialCloudSaveSkipped.current) {
      initialCloudSaveSkipped.current = true;
      return;
    }

    const saveVersion = cloudSaveVersion.current;
    const timeout = window.setTimeout(async () => {
      if (saveVersion !== cloudSaveVersion.current) return;

      try {
        setSyncStatus("saving");
        await saveCloudData(cloudUserId, data);
        setSyncStatus("online");
      } catch {
        setSyncStatus("error");
      }
    }, 900);

    return () => window.clearTimeout(timeout);
  }, [cloudSyncEnabled, cloudUserId, data, mounted]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    setAppInstalled(appIsStandalone());
    const displayMode = window.matchMedia("(display-mode: standalone)") as MediaQueryList & {
      addListener?: (listener: () => void) => void;
      removeListener?: (listener: () => void) => void;
    };
    const displayModeHandler = () => setAppInstalled(appIsStandalone());
    const installedHandler = () => {
      setAppInstalled(true);
      setInstallPrompt(null);
      setInstallHelpOpen(false);
    };
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    if (typeof displayMode.addEventListener === "function") {
      displayMode.addEventListener("change", displayModeHandler);
    } else {
      displayMode.addListener?.(displayModeHandler);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
      if (typeof displayMode.removeEventListener === "function") {
        displayMode.removeEventListener("change", displayModeHandler);
      } else {
        displayMode.removeListener?.(displayModeHandler);
      }
    };
  }, []);

  const updateData = useCallback((updater: AppData | ((previous: AppData) => AppData)) => {
    setData((previous) =>
      typeof updater === "function" ? normalizeData((updater as (previous: AppData) => AppData)(previous)) : normalizeData(updater)
    );
  }, []);

  const journey = useMemo(() => calculateJourney(data), [data]);
  const earnedAchievements = useMemo(() => achievements.filter((achievement) => achievement.isEarned(data)), [data]);
  const earnedCount = earnedAchievements.length;
  const celebrationReady = Boolean(data.profile && data.onboarding.complete);

  useEffect(() => {
    const earnedIds = earnedAchievements.map((achievement) => achievement.id);
    const previous = celebrationSnapshot.current;

    if (!celebrationReady) {
      celebrationSnapshot.current = { earnedIds, level: journey.level };
      return;
    }

    if (!previous) {
      celebrationSnapshot.current = { earnedIds, level: journey.level };
      return;
    }

    if (journey.level > previous.level) {
      setCelebration({
        id: createId("celebration"),
        kind: "level",
        level: journey.level,
        title: `Nível ${journey.level}!`,
        message: `Você subiu para ${journey.levelTitle}. Continue juntando XP para desbloquear a próxima fase.`
      });
    } else {
      const newAchievement = earnedAchievements.find((achievement) => !previous.earnedIds.includes(achievement.id));
      if (newAchievement) {
        setCelebration({
          id: createId("celebration"),
          kind: "achievement",
          title: newAchievement.title,
          message: newAchievement.description
        });
      }
    }

    celebrationSnapshot.current = { earnedIds, level: journey.level };
  }, [celebrationReady, earnedAchievements, journey.level, journey.levelTitle]);

  useEffect(() => {
    if (!celebration) return;
    const timeout = window.setTimeout(() => setCelebration(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [celebration]);

  async function installApp() {
    if (appInstalled) {
      setInstallHelpOpen(true);
      return;
    }

    if (!installPrompt) {
      setInstallHelpOpen(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice?.catch(() => null);
    setInstallPrompt(null);
    if (choice?.outcome === "accepted") {
      setAppInstalled(true);
      setInstallHelpOpen(false);
      return;
    }
    setInstallHelpOpen(true);
  }

  async function handleAuthSubmit(payload: AuthPayload, mode: "login" | "signup") {
    setAuthBusy(true);
    setAuthError("");

    if (!cloudReady || !supabase) {
      updateData((previous) => ({
        ...previous,
        profile: {
          name: payload.name || "Usuario Organiza+",
          email: payload.email || "demo@organizamais.local",
          createdAt: new Date().toISOString()
        },
        localModeAcknowledged: true,
        achievements: Array.from(new Set([...previous.achievements, "first-login"]))
      }));
      setAuthBusy(false);
      return;
    }

    try {
      const authResult =
        mode === "signup"
          ? await supabase.auth.signUp({
              email: payload.email,
              password: payload.password,
              options: { data: { name: payload.name } }
            })
          : await supabase.auth.signInWithPassword({
              email: payload.email,
              password: payload.password
            });

      if (authResult.error) throw authResult.error;

      if (mode === "signup" && !authResult.data.session) {
        setAuthMode("login");
        setAuthError("Conta criada. Agora entre com seu e-mail e senha para abrir o app.");
        setSyncStatus("local");
        return;
      }

      const user = authResult.data.user;
      if (!user) throw new Error("Nao foi possivel abrir a conta agora.");

      const cloudData = await loadCloudData(user);
      const profile = {
        name: cloudData.profile?.name || payload.name || user.email?.split("@")[0] || "Usuario Organiza+",
        email: cloudData.profile?.email || user.email || payload.email,
        createdAt: cloudData.profile?.createdAt || user.created_at || new Date().toISOString()
      };

      setCloudUserId(user.id);
      setCloudSyncEnabled(true);
      setSyncStatus("online");
      initialCloudSaveSkipped.current = true;
      updateData({
        ...cloudData,
        profile,
        achievements: Array.from(new Set([...cloudData.achievements, "first-login"]))
      });
    } catch (error) {
      setAuthError(readableError(error));
      setSyncStatus("error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleResetData() {
    const confirmation = cloudSyncEnabled
      ? "Apagar todos os dados desta conta no Organiza+? Isso zera renda, gastos, dividas, pagamentos, plano e conquistas."
      : "Apagar todos os dados salvos neste aparelho?";

    if (!window.confirm(confirmation)) return;

    setResetBusy(true);
    setAuthError("");
    cloudSaveVersion.current += 1;

    try {
      if (cloudSyncEnabled && cloudUserId && data.profile) {
        const resetData = normalizeData({
          ...emptyData(),
          profile: data.profile,
          localModeAcknowledged: true
        });

        setSyncStatus("saving");
        await resetCloudData(cloudUserId);
        await saveCloudData(cloudUserId, resetData);
        window.localStorage.setItem(storageKey, JSON.stringify(resetData));
        initialCloudSaveSkipped.current = true;
        setSyncStatus("online");
        setView("today");
        setCelebration(null);
        updateData(resetData);
        return;
      }

      window.localStorage.removeItem(storageKey);
      setCloudUserId(null);
      setCloudSyncEnabled(false);
      setSyncStatus("local");
      setAuthMode("opening");
      setView("today");
      setCelebration(null);
      updateData(emptyData());
    } catch (error) {
      setSyncStatus("error");
      window.alert(readableError(error));
    } finally {
      setResetBusy(false);
    }
  }

  async function handleSignOut() {
    cloudSaveVersion.current += 1;
    if (supabase) {
      await supabase.auth.signOut().catch(() => undefined);
    }
    window.localStorage.removeItem(storageKey);
    setCloudUserId(null);
    setCloudSyncEnabled(false);
    setSyncStatus(cloudReady ? "local" : "local");
    initialCloudSaveSkipped.current = false;
    setAuthMode("opening");
    updateData(emptyData());
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
        cloudEnabled={cloudReady}
        busy={authBusy}
        error={authError}
        installAvailable={!appInstalled}
        onInstall={installApp}
        onSubmitAuth={handleAuthSubmit}
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
          installAvailable={!appInstalled}
          appInstalled={appInstalled}
          cloudEnabled={cloudSyncEnabled}
          syncStatus={syncStatus}
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
              {view === "assistant" && <AssistantViewV2 data={data} />}
              {view === "achievements" && <AchievementsView data={data} />}
              {view === "profile" && (
                <ProfileView
                  data={data}
                  updateData={updateData}
                  earnedCount={earnedCount}
                  installAvailable={!appInstalled}
                  appInstalled={appInstalled}
                  cloudEnabled={cloudSyncEnabled}
                  syncStatus={syncStatus}
                  resetBusy={resetBusy}
                  onInstall={installApp}
                  onNavigate={setView}
                  onSignOut={handleSignOut}
                  onResetData={handleResetData}
                />
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        <BottomNav active={view} onNavigate={setView} />
        <InstallGuideModal
          open={installHelpOpen}
          canPrompt={Boolean(installPrompt)}
          installed={appInstalled}
          onInstall={installApp}
          onClose={() => setInstallHelpOpen(false)}
        />
        <CelebrationOverlay event={celebration} onClose={() => setCelebration(null)} />
        <FloatingAssistant
          data={data}
          open={floatingAssistantOpen}
          onOpen={() => setFloatingAssistantOpen(true)}
          onClose={() => setFloatingAssistantOpen(false)}
        />
      </div>
    </main>
  );
}

function CelebrationOverlay({
  event,
  onClose
}: {
  event: CelebrationEvent | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          className="fixed inset-0 z-[70] grid place-items-center bg-ink/68 px-5 py-8 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.section
            key={event.id}
            className="relative w-full max-w-[360px] overflow-hidden rounded-[8px] border border-white/60 bg-white p-5 text-center text-ink shadow-soft"
            initial={{ opacity: 0, y: 26, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 240, damping: 20 }}
          >
            <button
              className="absolute right-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-ink shadow-sm"
              type="button"
              onClick={onClose}
              aria-label="Fechar comemoração"
            >
              <X size={18} />
            </button>

            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute -left-14 -top-16 h-36 w-36 rounded-full bg-aqua/20 blur-2xl"
                animate={{ scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              />
              <motion.div
                className="absolute -bottom-20 -right-10 h-44 w-44 rounded-full bg-amber/24 blur-2xl"
                animate={{ scale: [1.1, 0.96, 1.1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2.8, repeat: Infinity }}
              />
              {celebrationStars.map((star) => (
                <motion.div
                  key={star.className}
                  className={cn("absolute text-amber", star.className)}
                  initial={{ opacity: 0, scale: 0.2, rotate: -18 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    scale: [0.2, 1.15, 0.92, 0.2],
                    y: [10, -8, -16, -22],
                    rotate: [-18, 12, -8, 18]
                  }}
                  transition={{ duration: 1.9, delay: star.delay, repeat: Infinity, repeatDelay: 0.35 }}
                >
                  <Sparkles size={star.size} fill="currentColor" />
                </motion.div>
              ))}
            </div>

            <div className="relative z-10">
              <div className="mx-auto mb-3 grid h-10 w-fit place-items-center rounded-full bg-aqua/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-aqua">
                {event.kind === "level" ? "Você subiu de nível" : "Conquista desbloqueada"}
              </div>

              <ClappingMascot />

              <motion.h2
                className="mt-4 text-3xl font-black leading-tight text-ink"
                initial={{ scale: 0.92 }}
                animate={{ scale: [0.92, 1.05, 1] }}
                transition={{ duration: 0.45, delay: 0.1 }}
              >
                {event.title}
              </motion.h2>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-600">{event.message}</p>

              {event.kind === "level" && event.level ? (
                <div className="mx-auto mt-4 w-fit rounded-[8px] bg-leaf px-4 py-2 text-sm font-black text-white">
                  Nível {event.level}
                </div>
              ) : null}

              <AppButton className="mt-5 w-full" onClick={onClose} icon={<ArrowRight size={18} />}>
                Continuar
              </AppButton>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ClappingMascot() {
  return (
    <div className="relative mx-auto h-48 w-48">
      <motion.div
        className="absolute inset-x-8 bottom-2 h-4 rounded-full bg-ink/10 blur-sm"
        animate={{ scaleX: [1, 0.86, 1], opacity: [0.22, 0.12, 0.22] }}
        transition={{ duration: 0.82, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.svg
        className="relative h-full w-full overflow-visible"
        viewBox="0 0 220 220"
        role="img"
        aria-label="Bonequinho do Organiza+ batendo palma"
        initial={{ scale: 0.94 }}
        animate={{ scale: [0.94, 1, 0.94] }}
        transition={{ duration: 0.82, repeat: Infinity, ease: "easeInOut" }}
      >
        <defs>
          <linearGradient id="celebration-shirt" x1="57" x2="164" y1="122" y2="184" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22B7A6" />
            <stop offset="1" stopColor="#27B978" />
          </linearGradient>
          <linearGradient id="celebration-face" x1="78" x2="143" y1="43" y2="117" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFD2A7" />
            <stop offset="1" stopColor="#F2A56C" />
          </linearGradient>
        </defs>

        <motion.g animate={{ y: [0, -7, 0] }} transition={{ duration: 0.82, repeat: Infinity, ease: "easeInOut" }}>
          <ellipse cx="110" cy="199" rx="56" ry="9" fill="#071A3D" opacity="0.1" />

          <path
            d="M76 165 C68 177 66 189 70 197 L96 197 C97 184 96 174 93 165 Z"
            fill="#071A3D"
            stroke="#071A3D"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M127 165 C123 177 123 187 126 197 L151 197 C156 187 153 176 144 165 Z"
            fill="#071A3D"
            stroke="#071A3D"
            strokeWidth="5"
            strokeLinejoin="round"
          />

          <path
            d="M64 126 C72 106 91 98 110 98 C131 98 149 107 157 126 L168 181 C151 193 72 193 52 181 Z"
            fill="url(#celebration-shirt)"
            stroke="#071A3D"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          <path d="M96 102 L124 102 L119 124 L101 124 Z" fill="#FFD2A7" stroke="#071A3D" strokeWidth="5" strokeLinejoin="round" />
          <path d="M95 108 C101 115 119 115 125 108" fill="none" stroke="#071A3D" strokeWidth="4" strokeLinecap="round" />

          <motion.g
            style={{ transformOrigin: "78px 128px" }}
            animate={{ rotate: [-14, 15, -14], x: [0, 10, 0], y: [0, -3, 0] }}
            transition={{ duration: 0.48, repeat: Infinity, ease: "easeInOut" }}
          >
            <path
              d="M69 127 C54 134 44 148 41 162"
              fill="none"
              stroke="#071A3D"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <path
              d="M69 127 C54 134 44 148 41 162"
              fill="none"
              stroke="#22B7A6"
              strokeWidth="11"
              strokeLinecap="round"
            />
            <ellipse cx="54" cy="126" rx="15" ry="18" fill="#FFD2A7" stroke="#071A3D" strokeWidth="5" transform="rotate(-24 54 126)" />
          </motion.g>

          <motion.g
            style={{ transformOrigin: "142px 128px" }}
            animate={{ rotate: [14, -15, 14], x: [0, -10, 0], y: [0, -3, 0] }}
            transition={{ duration: 0.48, repeat: Infinity, ease: "easeInOut" }}
          >
            <path
              d="M151 127 C166 134 176 148 179 162"
              fill="none"
              stroke="#071A3D"
              strokeWidth="18"
              strokeLinecap="round"
            />
            <path
              d="M151 127 C166 134 176 148 179 162"
              fill="none"
              stroke="#27B978"
              strokeWidth="11"
              strokeLinecap="round"
            />
            <ellipse cx="166" cy="126" rx="15" ry="18" fill="#FFD2A7" stroke="#071A3D" strokeWidth="5" transform="rotate(24 166 126)" />
          </motion.g>

          <motion.g
            animate={{ opacity: [0, 1, 0], scale: [0.7, 1.08, 0.7] }}
            transition={{ duration: 0.48, repeat: Infinity, ease: "easeInOut" }}
          >
            <path d="M103 132 L95 145" stroke="#F59E5B" strokeWidth="5" strokeLinecap="round" />
            <path d="M117 132 L125 145" stroke="#F59E5B" strokeWidth="5" strokeLinecap="round" />
            <path d="M110 127 L110 144" stroke="#F59E5B" strokeWidth="5" strokeLinecap="round" />
          </motion.g>

          <circle cx="69" cy="80" r="9" fill="#FFD2A7" stroke="#071A3D" strokeWidth="5" />
          <circle cx="151" cy="80" r="9" fill="#FFD2A7" stroke="#071A3D" strokeWidth="5" />
          <circle cx="110" cy="75" r="43" fill="url(#celebration-face)" stroke="#071A3D" strokeWidth="6" />
          <path
            d="M70 69 C72 41 93 25 118 29 C139 31 151 45 153 68 C138 58 121 56 100 62 C88 66 80 68 70 69 Z"
            fill="#071A3D"
            stroke="#071A3D"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M88 72 C93 68 99 68 104 72" fill="none" stroke="#071A3D" strokeWidth="4" strokeLinecap="round" />
          <path d="M119 72 C124 68 130 68 135 72" fill="none" stroke="#071A3D" strokeWidth="4" strokeLinecap="round" />
          <circle cx="96" cy="83" r="5" fill="#071A3D" />
          <circle cx="127" cy="83" r="5" fill="#071A3D" />
          <path d="M101 99 C108 106 121 106 128 99" fill="none" stroke="#071A3D" strokeWidth="5" strokeLinecap="round" />
          <circle cx="86" cy="96" r="5" fill="#F59E5B" opacity="0.55" />
          <circle cx="137" cy="96" r="5" fill="#F59E5B" opacity="0.55" />

          <path d="M82 193 L98 193" stroke="#F59E5B" strokeWidth="9" strokeLinecap="round" />
          <path d="M128 193 L146 193" stroke="#F59E5B" strokeWidth="9" strokeLinecap="round" />
        </motion.g>
      </motion.svg>
    </div>
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

function InstallGuideModal({
  open,
  canPrompt,
  installed,
  onInstall,
  onClose
}: {
  open: boolean;
  canPrompt: boolean;
  installed: boolean;
  onInstall: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid items-end justify-items-center overflow-y-auto bg-ink/52 px-3 py-3 backdrop-blur-sm sm:items-center">
      <motion.section
        className="w-full max-w-[480px] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[8px] bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-ink shadow-soft"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-aqua">Atalho do app</p>
            <h2 className="mt-1 text-xl font-black">Instalar Organiza+</h2>
            <p className="mt-2 text-sm leading-6 text-ocean/70">
              {installed
                ? "Este aparelho ja abriu o Organiza+ como aplicativo instalado."
                : "Coloque o Organiza+ na tela inicial do celular ou como app no PC para abrir sem procurar o link."}
            </p>
          </div>
          <IconButton label="Fechar instalacao" icon={X} onClick={onClose} />
        </div>

        {!canPrompt && !installed && (
          <div className="mt-4 flex gap-3 rounded-[8px] border border-amber/25 bg-amber/10 p-3">
            <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber" />
            <div>
              <p className="text-sm font-black text-ocean">No iPhone, o passo e manual</p>
              <p className="mt-1 text-sm leading-5 text-ocean/70">
                A Apple nao deixa o Organiza+ abrir sozinho a tela de adicionar atalho. Toque no botao de compartilhar do navegador e escolha adicionar a tela inicial.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3">
          <InstallInstruction
            icon={Smartphone}
            title="Android"
            description="No Chrome, toque em Instalar se a janela aparecer. Se nao aparecer, abra o menu de tres pontos e escolha Adicionar a tela inicial."
          />
          <InstallInstruction
            icon={Share2}
            title="iPhone"
            description="Use o Safari para melhor resultado. Toque no icone de compartilhar e depois em Adicionar a Tela de Inicio."
          />
          <InstallInstruction
            icon={Laptop}
            title="PC"
            description="No Chrome ou Edge, use o icone de instalar na barra de endereco. Depois voce pode fixar o app na barra de tarefas ou na area de trabalho."
          />
        </div>

        <div className="mt-4 grid gap-3">
          {canPrompt && !installed && (
            <AppButton onClick={onInstall} icon={<Download size={18} />}>
              Instalar agora
            </AppButton>
          )}
          <AppButton variant="secondary" onClick={onClose}>
            Entendi, vou fazer manualmente
          </AppButton>
        </div>
      </motion.section>
    </div>
  );
}

function InstallInstruction({
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

function AuthScreen({
  data,
  mode,
  onModeChange,
  cloudEnabled,
  busy,
  error,
  installAvailable,
  onInstall,
  onSubmitAuth
}: {
  data: AppData;
  mode: "opening" | "login" | "signup";
  onModeChange: (mode: "opening" | "login" | "signup") => void;
  cloudEnabled: boolean;
  busy: boolean;
  error: string;
  installAvailable: boolean;
  onInstall: () => void;
  onSubmitAuth: (payload: AuthPayload, mode: "login" | "signup") => void;
}) {
  if (mode === "opening") {
    const modeBadge = cloudEnabled
      ? ({ tone: "green", label: "Conta online" } as const)
      : ({ tone: "orange", label: "Modo local demonstrativo" } as const);

    return (
      <main className="min-h-screen bg-ink px-5 py-7 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-[480px] flex-col">
          <div className="flex items-center justify-between">
            <BrandLockup contrast />
            <Badge tone={modeBadge.tone}>{modeBadge.label}</Badge>
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
                  <MiniTrust icon={ShieldCheck} label={cloudEnabled ? "Dados na nuvem" : "Dados no aparelho"} />
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
                  {cloudEnabled ? "Ja tenho conta" : "Ja tenho conta demo"}
                </AppButton>
                {installAvailable && (
                  <AppButton variant="ghost" onClick={onInstall} icon={<Download size={18} />}>
                    Como instalar no celular ou PC
                  </AppButton>
                )}
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
            {mode === "signup"
              ? cloudEnabled
                ? "Criar conta"
                : "Criar conta demo"
              : cloudEnabled
                ? "Entrar na conta"
                : "Entrar na conta demo"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-ocean/74">
            {cloudEnabled
              ? "Sua conta sera salva com seguranca no Supabase. O Organiza+ nao pede senha bancaria."
              : "Esta versao salva tudo localmente no seu aparelho. Nenhuma senha bancaria e pedida."}
          </p>
        </div>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const name = textValue(form.get("name")) || "Usuario Organiza+";
            const email = textValue(form.get("email")) || "demo@organizamais.local";
            const password = textValue(form.get("password")) || "demo-password";
            onSubmitAuth({ name, email, password }, mode === "login" ? "login" : "signup");
          }}
        >
          <label className="grid gap-2 text-sm font-semibold text-ocean">
            Nome
            <input className="field" name="name" placeholder="Seu nome" autoComplete="name" required={mode === "signup" && cloudEnabled} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ocean">
            E-mail
            <input className="field" name="email" type="email" placeholder="voce@email.com" autoComplete="email" required={cloudEnabled} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ocean">
            {cloudEnabled ? "Senha" : "Senha demo"}
            <input
              className="field"
              name="password"
              type="password"
              placeholder={cloudEnabled ? "Minimo 6 caracteres" : "Somente para fluxo visual"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={cloudEnabled ? 6 : undefined}
              required={cloudEnabled}
            />
          </label>
          <div className="demo-ribbon rounded-[8px] border border-amber/25 p-3 text-xs font-medium text-ocean">
            {cloudEnabled
              ? "Conta online: seus dados serao sincronizados na nuvem deste projeto."
              : "Modo demonstrativo: o login e local e nao autentica em servidor. Supabase ja esta preparado para ativar depois."}
          </div>
          {error && (
            <div className="rounded-[8px] border border-danger/20 bg-danger/10 p-3 text-xs font-bold text-danger">
              {error}
            </div>
          )}
          <AppButton type="submit" disabled={busy} icon={<ArrowRight size={18} />}>
            {busy ? (mode === "login" ? "Entrando..." : "Criando...") : "Continuar"}
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
                  onUpdate={(updatedExpense) =>
                    updateData((previous) => ({
                      ...previous,
                      expenses: previous.expenses.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense))
                    }))
                  }
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
                  onUpdate={(updatedDebt) =>
                    updateData((previous) => ({
                      ...previous,
                      debts: previous.debts.map((debt) => (debt.id === updatedDebt.id ? updatedDebt : debt))
                    }))
                  }
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
  appInstalled,
  cloudEnabled,
  syncStatus,
  onInstall,
  onNavigate
}: {
  data: AppData;
  view: ViewKey;
  earnedCount: number;
  installAvailable: boolean;
  appInstalled: boolean;
  cloudEnabled: boolean;
  syncStatus: SyncStatus;
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
  const syncBadge: { tone: "blue" | "green" | "orange"; label: string } =
    syncStatus === "saving"
      ? { tone: "blue", label: "Salvando na nuvem" }
      : syncStatus === "checking"
        ? { tone: "blue", label: "Verificando conta" }
        : syncStatus === "error"
          ? { tone: "orange", label: "Verificar conexao" }
          : cloudEnabled
            ? { tone: "green", label: "Nuvem sincronizada" }
            : { tone: "orange", label: "Modo local demonstrativo" };

  return (
    <header className="sticky top-0 z-20 border-b border-ocean/8 bg-cloud/94 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ocean/62">Olá, {data.profile?.name.split(" ")[0]}</p>
          <h1 className="text-xl font-black">{pageTitle[view]}</h1>
        </div>
        <div className="flex items-center gap-2">
          {installAvailable && (
            <IconButton label="Como instalar o Organiza+" onClick={onInstall} icon={Download} />
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
        <Badge tone={syncBadge.tone}>{syncBadge.label}</Badge>
        {data.demoDataLoaded && <Badge tone="green">Dados de exemplo ativos</Badge>}
        <Badge tone={appInstalled ? "green" : "blue"}>{appInstalled ? "App instalado" : "Instale como app"}</Badge>
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
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [mapResetKey, setMapResetKey] = useState(0);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const journey = useMemo(() => calculateJourney(data), [data]);
  const journeySteps = useMemo(() => buildJourneySteps(data), [data]);
  const journeyWidth = 660;
  const journeyHeight = Math.max(780, journeySteps.length * 150 + 120);
  const journeyPoints = useMemo(() => buildJourneyPoints(journeySteps.length, journeyWidth), [journeySteps.length, journeyWidth]);
  const journeyPath = useMemo(() => buildJourneyPath(journeyPoints), [journeyPoints]);
  const completedSteps = journeySteps.filter((step) => step.state === "done").length;
  const selectedStep = journeySteps.find((step) => step.id === selectedStepId) ?? null;
  const selectedDebt = selectedStep?.debtId ? data.debts.find((debt) => debt.id === selectedStep.debtId) ?? null : null;
  const selectedPanel = selectedStep?.panel;

  useEffect(() => {
    if (!selectedStepId) return;
    const timer = window.setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [selectedStepId]);

  const handleStepClick = (step: JourneyStep) => {
    if (step.state === "locked") return;
    setSelectedStepId(step.id);
    if (step.target) onNavigate(step.target);
  };

  const updateDebt = (updatedDebt: Debt) => {
    updateData((previous) => ({
      ...previous,
      debts: previous.debts.map((debt) => (debt.id === updatedDebt.id ? updatedDebt : debt))
    }));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-aqua">Caminho financeiro</p>
            <h2 className="mt-1 text-xl font-black">Sua vila financeira cresce com seu progresso.</h2>
            <p className="mt-1 text-sm text-ocean/60">Toque em uma casa para abrir a area dela, editar dados e registrar avancos.</p>
          </div>
          <Badge tone="green">
            Nivel {journey.level} | {journey.xp} XP | {completedSteps}/{journeySteps.length}
          </Badge>
        </div>
      </section>

      <section className="rounded-[8px] border border-ocean/8 bg-[linear-gradient(180deg,#FFFFFF,#EEF7F7)] p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-ocean/58">Arraste a vila para cima, baixo e lados.</p>
          <button
            type="button"
            onClick={() => setMapResetKey((current) => current + 1)}
            className="flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-ocean shadow-sm"
          >
            <RefreshCcw size={14} />
            Centralizar
          </button>
        </div>
        <div className="relative h-[72vh] min-h-[620px] max-h-[920px] touch-none overflow-hidden rounded-[8px] border border-ocean/6 bg-[radial-gradient(circle_at_50%_0%,rgba(33,183,166,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.86),rgba(238,247,247,0.94))]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,51,95,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(18,51,95,0.035)_1px,transparent_1px)] bg-[size:38px_38px]" />
          <div className="absolute left-1/2 top-8 -translate-x-1/2">
            <motion.div
              key={mapResetKey}
              drag
              dragMomentum={false}
              className="relative cursor-grab active:cursor-grabbing"
              style={{ width: journeyWidth, height: journeyHeight }}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
            >
              <JourneyPathSvg path={journeyPath} width={journeyWidth} height={journeyHeight} />
              <VillageDecorations level={journey.level} width={journeyWidth} height={journeyHeight} />
              {journeySteps.map((step, index) => (
                <JourneyStepButton
                  key={step.id}
                  step={step}
                  point={journeyPoints[index]}
                  active={step.id === selectedStepId}
                  onClick={() => handleStepClick(step)}
                />
              ))}
            </motion.div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-white/88 px-3 py-1.5 text-[11px] font-bold text-ocean/58 shadow-sm">
            Mova para cima, baixo e lados
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedDebt && (
          <motion.section
            ref={detailRef}
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
              <IconButton label="Fechar" icon={X} onClick={() => setSelectedStepId(null)} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MetricCard icon={AlertTriangle} label="Restante" value={formatMoney(remainingDebt(selectedDebt))} tone={selectedDebt.urgent ? "orange" : "blue"} />
              <MetricCard icon={DollarSign} label="Parcela" value={formatMoney(selectedDebt.minimumPayment)} tone="green" />
            </div>
            <div className="mt-4 rounded-[8px] border border-ocean/8 bg-mist/70 p-3">
              <p className="mb-3 text-sm font-black text-ocean">Editar esta divida</p>
              <DebtEditForm debt={selectedDebt} onSave={updateDebt} />
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

      <AnimatePresence>
        {selectedPanel && !selectedDebt && (
          <motion.div
            ref={detailRef}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <FinancialDataSection
              data={data}
              updateData={updateData}
              initialPanel={selectedPanel}
              title={financialPanelTitle(selectedPanel)}
              description="Casa da vila aberta pelo mapa. Ajuste os dados e o caminho ganha progresso."
            />
          </motion.div>
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

function buildAssistantContext(data: AppData) {
  const plan = buildPayoffPlan(data).slice(0, 5);

  return {
    profileName: data.profile?.name || null,
    monthlyIncome: data.income.monthly,
    incomeKind: data.income.kind,
    payday: data.income.payday,
    monthlyCapacity: paymentCapacity(data),
    strategy: strategyLabel(data.strategy),
    firstGoal: data.onboarding.firstGoal,
    mainConcern: data.onboarding.mainConcern,
    totals: {
      expenses: totalExpenses(data),
      remainingDebt: totalRemaining(data.debts),
      paid: totalPaid(data.debts),
      totalDebt: totalDebt(data.debts)
    },
    expenses: data.expenses.map((expense) => ({
      name: expense.name,
      amount: expense.amount,
      dueDay: expense.dueDay,
      essential: expense.essential
    })),
    debts: data.debts.map((debt) => ({
      name: debt.name,
      creditor: debt.creditor,
      category: debt.category,
      total: debt.total,
      paid: debt.paid,
      remaining: remainingDebt(debt),
      minimumPayment: debt.minimumPayment,
      interestRate: debt.interestRate,
      dueDay: debt.dueDay,
      urgent: debt.urgent,
      notes: debt.notes || ""
    })),
    nextPlan: plan.map((item) => ({
      debt: item.debt.name,
      remaining: item.remaining,
      monthlyAllocated: item.monthlyAllocated,
      finishMonth: formatMonthYear(item.finishDate),
      reason: item.reason
    }))
  };
}

function AssistantViewV2({ data }: { data: AppData }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      text: "Sou o assistente do Organiza+. Quando a chave da OpenAI estiver instalada, respondo com IA real usando seu mapa financeiro. Se a IA estiver indisponível, continuo ajudando em modo local."
    }
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [assistantMode, setAssistantMode] = useState<"local" | "openai" | "error">("local");

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    const localReply = generateLocalAssistantReply(trimmed, data);
    setInput("");
    setThinking(true);
    setMessages((previous) => [...previous, { role: "user", text: trimmed }]);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          context: buildAssistantContext(data)
        })
      });
      const payload = (await response.json().catch(() => null)) as {
        mode?: string;
        reply?: string;
      } | null;
      const realAiReply = response.ok && payload?.mode === "openai" && payload.reply;
      const reply = realAiReply ? payload.reply || localReply : localReply;

      setAssistantMode(realAiReply ? "openai" : payload?.mode === "openai-error" ? "error" : "local");
      setMessages((previous) => [...previous, { role: "assistant", text: reply }]);
    } catch {
      setAssistantMode("error");
      setMessages((previous) => [...previous, { role: "assistant", text: localReply }]);
    } finally {
      setThinking(false);
    }
  }

  const shortcuts = ["Qual dívida pagar primeiro?", "Quanto posso guardar?", "Crie uma mensagem para negociar"];

  return (
    <div className="space-y-4">
      <section className="rounded-[8px] border border-aqua/20 bg-aqua/10 p-4">
        <div className="flex gap-3">
          <Brain className="mt-1 shrink-0 text-aqua" size={22} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black">Assistente contextual</h2>
              <Badge tone={assistantMode === "openai" ? "green" : assistantMode === "error" ? "orange" : "blue"}>
                {assistantMode === "openai"
                  ? "IA real ativa"
                  : assistantMode === "error"
                    ? "Modo local de segurança"
                    : "Pronto para OpenAI"}
              </Badge>
            </div>
            <p className="mt-1 text-sm leading-5 text-ocean/75">
              A chave fica protegida na Vercel. O usuário conversa pelo app, mas a consulta acontece no servidor.
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
              message.role === "assistant" ? "bg-mist text-ocean" : "ml-auto bg-ink text-white"
            )}
          >
            {message.text}
          </div>
        ))}
        {thinking && (
          <div className="max-w-[86%] rounded-[8px] bg-mist px-3 py-2 text-sm font-bold text-ocean/70">
            Pensando no seu plano...
          </div>
        )}
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1 app-scrollbar">
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut}
            type="button"
            disabled={thinking}
            onClick={() => sendMessage(shortcut)}
            className="shrink-0 rounded-[8px] border border-ocean/10 bg-white px-3 py-2 text-xs font-bold text-ocean disabled:opacity-50"
          >
            {shortcut}
          </button>
        ))}
      </div>

      <form
        className="grid grid-cols-[minmax(0,1fr)_56px] gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          sendMessage(input);
        }}
      >
        <input
          className="field min-w-0"
          value={input}
          disabled={thinking}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Pergunte sobre seu plano"
        />
        <button
          type="submit"
          disabled={thinking}
          className="grid h-12 w-14 shrink-0 place-items-center rounded-[8px] bg-ink text-white shadow-soft transition hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Enviar mensagem"
        >
          <ArrowRight size={19} />
        </button>
      </form>
    </div>
  );
}

function FloatingAssistant({
  data,
  open,
  onOpen,
  onClose
}: {
  data: AppData;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      role: "assistant",
      text: "Oi! Sou a IA do Organiza+. Posso analisar seu mapa, explicar prioridades e montar mensagens de negociação."
    }
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [assistantMode, setAssistantMode] = useState<"local" | "openai" | "error">("local");

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    const localReply = generateLocalAssistantReply(trimmed, data);
    setInput("");
    setThinking(true);
    setMessages((previous) => [...previous, { role: "user", text: trimmed }]);

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          context: buildAssistantContext(data)
        })
      });
      const payload = (await response.json().catch(() => null)) as {
        mode?: string;
        reply?: string;
      } | null;
      const realAiReply = response.ok && payload?.mode === "openai" && payload.reply;
      const reply = realAiReply ? payload.reply || localReply : localReply;

      setAssistantMode(realAiReply ? "openai" : payload?.mode === "openai-error" ? "error" : "local");
      setMessages((previous) => [...previous, { role: "assistant", text: reply }]);
    } catch {
      setAssistantMode("error");
      setMessages((previous) => [...previous, { role: "assistant", text: localReply }]);
    } finally {
      setThinking(false);
    }
  }

  const shortcuts = ["O que faço hoje?", "Qual dívida priorizar?", "Mensagem para negociar"];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-x-0 bottom-24 z-[65] mx-auto w-full max-w-[480px] px-3"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.22 }}
          >
            <section className="ml-auto flex max-h-[72vh] w-full max-w-[430px] flex-col overflow-hidden rounded-[8px] border border-ocean/10 bg-white shadow-soft">
              <div className="flex items-center justify-between gap-3 bg-ink px-4 py-3 text-white">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-leaf text-white shadow-glow">
                    <Brain size={20} />
                  </div>
                  <div>
                    <h2 className="font-black leading-tight">IA Organiza+</h2>
                    <p className="text-xs font-semibold text-white/62">
                      {assistantMode === "openai"
                        ? "IA real ativa"
                        : assistantMode === "error"
                          ? "Modo local de segurança"
                          : "Assistente contextual"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/8 text-white"
                  aria-label="Fechar chat da IA"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-cloud p-3 app-scrollbar">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={cn(
                      "max-w-[86%] rounded-[8px] px-3 py-2 text-sm leading-6 shadow-sm",
                      message.role === "assistant" ? "bg-white text-ocean" : "ml-auto bg-leaf text-white"
                    )}
                  >
                    {message.text}
                  </div>
                ))}
                {thinking && (
                  <div className="max-w-[86%] rounded-[8px] bg-white px-3 py-2 text-sm font-bold text-ocean/66 shadow-sm">
                    Pensando no seu plano...
                  </div>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto border-t border-ocean/8 bg-white px-3 py-2 app-scrollbar">
                {shortcuts.map((shortcut) => (
                  <button
                    key={shortcut}
                    type="button"
                    disabled={thinking}
                    onClick={() => sendMessage(shortcut)}
                    className="shrink-0 rounded-full border border-ocean/10 bg-mist px-3 py-2 text-xs font-black text-ocean disabled:opacity-50"
                  >
                    {shortcut}
                  </button>
                ))}
              </div>

              <form
                className="grid grid-cols-[minmax(0,1fr)_52px] gap-2 border-t border-ocean/8 bg-white p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage(input);
                }}
              >
                <input
                  className="field min-w-0 rounded-full"
                  value={input}
                  disabled={thinking}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Digite sua mensagem"
                />
                <button
                  type="submit"
                  disabled={thinking}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white shadow-soft transition hover:bg-ocean disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Enviar mensagem"
                >
                  <ArrowRight size={19} />
                </button>
              </form>
            </section>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] mx-auto w-full max-w-[480px] px-4">
        <button
          type="button"
          onClick={open ? onClose : onOpen}
          className={cn(
            "pointer-events-auto ml-auto flex h-14 items-center justify-center rounded-full bg-leaf text-white shadow-glow ring-4 ring-white transition hover:scale-[1.03]",
            open ? "w-14" : "gap-2 px-4"
          )}
          aria-label={open ? "Fechar IA" : "Abrir IA"}
        >
          {open ? (
            <X size={24} />
          ) : (
            <>
              <Brain size={23} />
              <span className="text-sm font-black">Chat IA</span>
            </>
          )}
        </button>
      </div>
    </>
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
  appInstalled,
  cloudEnabled,
  syncStatus,
  resetBusy,
  onInstall,
  onNavigate,
  onSignOut,
  onResetData
}: {
  data: AppData;
  updateData: (updater: AppData | ((previous: AppData) => AppData)) => void;
  earnedCount: number;
  installAvailable: boolean;
  appInstalled: boolean;
  cloudEnabled: boolean;
  syncStatus: SyncStatus;
  resetBusy: boolean;
  onInstall: () => void;
  onNavigate: (view: ViewKey) => void;
  onSignOut: () => void;
  onResetData: () => void;
}) {
  const journey = calculateJourney(data);
  const supabaseDescription = cloudEnabled
    ? `Conta online ativa (${syncStatus === "saving" ? "salvando agora" : syncStatus === "error" ? "verifique a conexao" : "sincronizada"}).`
    : "Ative as variaveis de ambiente para login e banco online.";

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
          description={
            cloudEnabled
              ? "Sua conta esta online. Alteracoes sao salvas automaticamente na nuvem."
              : "Tudo abaixo se refere ao modo local demonstrativo deste MVP."
          }
        />
        <div className="mt-4 grid gap-3">
          {installAvailable && (
            <AppButton variant="secondary" onClick={onInstall} icon={<Download size={18} />}>
              Como instalar na tela inicial ou PC
            </AppButton>
          )}
          {appInstalled && (
            <div className="rounded-[8px] border border-leaf/20 bg-leaf/10 p-3 text-sm font-bold text-leaf">
              Organiza+ ja esta instalado neste aparelho.
            </div>
          )}
          <AppButton variant="secondary" onClick={() => exportData(data)} icon={<Download size={18} />}>
            Exportar backup
          </AppButton>
          {cloudEnabled && (
            <AppButton variant="secondary" onClick={onSignOut} icon={<Lock size={18} />}>
              Sair da conta
            </AppButton>
          )}
          <AppButton
            variant="danger"
            onClick={onResetData}
            disabled={resetBusy}
            icon={<Trash2 size={18} />}
          >
            {resetBusy ? "Apagando..." : "Apagar tudo e recomeçar"}
          </AppButton>
        </div>
      </section>

      <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
        <SectionTitle eyebrow="Integrações" title="Preparado para evoluir" />
        <div className="mt-4 grid gap-3">
          <IntegrationRow icon={ShieldCheck} title="Supabase" description={supabaseDescription} />
          <IntegrationRow icon={Brain} title="OpenAI" description="Rota de assistente pronta. Sem chave, o app usa respostas demonstrativas locais." />
          <IntegrationRow icon={Bell} title="PWA" description="Instalacao no celular e no PC com botao proprio e instrucoes manuais." />
        </div>
      </section>
    </div>
  );
}

function financialPanelTitle(panel: FinancialPanel) {
  const titles: Record<FinancialPanel, string> = {
    income: "Casa da renda",
    expenses: "Casa dos gastos",
    debts: "Casa das dividas"
  };

  return titles[panel];
}

function FinancialDataSection({
  data,
  updateData,
  initialPanel = "debts",
  title = "Ajustar base financeira",
  description
}: {
  data: AppData;
  updateData: (updater: AppData | ((previous: AppData) => AppData)) => void;
  initialPanel?: FinancialPanel;
  title?: string;
  description?: string;
}) {
  const [panel, setPanel] = useState<FinancialPanel>(initialPanel);

  useEffect(() => {
    setPanel(initialPanel);
  }, [initialPanel]);

  return (
    <section className="rounded-[8px] border border-ocean/8 bg-white p-4 shadow-sm">
      <SectionTitle eyebrow="Dados" title={title} description={description} />
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          ["income", "Renda"],
          ["expenses", "Gastos"],
          ["debts", "Dívidas"]
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPanel(key as FinancialPanel)}
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
              onUpdate={(updatedExpense) =>
                updateData((previous) => ({
                  ...previous,
                  expenses: previous.expenses.map((expense) => (expense.id === updatedExpense.id ? updatedExpense : expense))
                }))
              }
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
              onUpdate={(updatedDebt) =>
                updateData((previous) => ({
                  ...previous,
                  debts: previous.debts.map((debt) => (debt.id === updatedDebt.id ? updatedDebt : debt))
                }))
              }
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

function ExpenseList({
  expenses,
  onRemove,
  onUpdate
}: {
  expenses: Expense[];
  onRemove: (id: string) => void;
  onUpdate: (expense: Expense) => void;
}) {
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
          <button
            type="button"
            onClick={() => {
              const nextAmount = window.prompt("Novo valor do gasto", String(expense.amount));
              if (nextAmount === null) return;
              const amount = moneyToNumber(nextAmount);
              if (amount <= 0) return;
              onUpdate({ ...expense, amount });
            }}
            className="rounded-full bg-white px-3 py-2 text-xs font-black text-ocean shadow-sm"
          >
            Editar
          </button>
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

function DebtEditForm({ debt, onSave }: { debt: Debt; onSave: (debt: Debt) => void }) {
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const total = moneyToNumber(form.get("total"));
        const safeTotal = total > 0 ? total : debt.total;
        const paid = Math.min(safeTotal, Math.max(0, moneyToNumber(form.get("paid"))));

        onSave({
          ...debt,
          name: textValue(form.get("name")) || debt.name,
          creditor: textValue(form.get("creditor")) || debt.creditor,
          category: (form.get("category") || debt.category) as DebtCategory,
          total: safeTotal,
          paid,
          minimumPayment: Math.max(0, moneyToNumber(form.get("minimumPayment"))),
          interestRate: Math.max(0, Number(form.get("interestRate")) || 0),
          dueDay: Math.max(1, Math.min(28, Number(form.get("dueDay")) || debt.dueDay)),
          urgent: form.get("urgent") === "on",
          notes: textValue(form.get("notes"))
        });
      }}
    >
      <input className="field" name="name" defaultValue={debt.name} placeholder="Nome da divida" />
      <input className="field" name="creditor" defaultValue={debt.creditor} placeholder="Credor" />
      <div className="grid grid-cols-2 gap-3">
        <input className="field" name="total" inputMode="decimal" defaultValue={debt.total || ""} placeholder="Total" />
        <input className="field" name="paid" inputMode="decimal" defaultValue={debt.paid || ""} placeholder="Ja pago" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className="field" name="minimumPayment" inputMode="decimal" defaultValue={debt.minimumPayment || ""} placeholder="Parcela" />
        <input className="field" name="interestRate" inputMode="decimal" defaultValue={debt.interestRate || ""} placeholder="Juros %" />
      </div>
      <div className="grid grid-cols-[1fr_88px] gap-3">
        <select className="field" name="category" defaultValue={debt.category}>
          <option value="cartao">Cartao</option>
          <option value="emprestimo">Emprestimo</option>
          <option value="conta">Conta</option>
          <option value="financiamento">Financiamento</option>
          <option value="loja">Loja</option>
          <option value="outro">Outro</option>
        </select>
        <input className="field" name="dueDay" type="number" min={1} max={28} defaultValue={debt.dueDay} placeholder="Dia" />
      </div>
      <label className="flex items-center gap-2 rounded-[8px] bg-white px-3 py-3 text-sm font-bold text-ocean">
        <input name="urgent" type="checkbox" defaultChecked={debt.urgent} className="h-4 w-4 accent-amber" />
        Prioridade urgente
      </label>
      <textarea className="field min-h-20 resize-none" name="notes" defaultValue={debt.notes} placeholder="Observacoes" />
      <AppButton type="submit" variant="secondary" icon={<CheckCircle2 size={18} />}>
        Salvar divida
      </AppButton>
    </form>
  );
}

function DebtList({
  debts,
  onRemove,
  onUpdate
}: {
  debts: Debt[];
  onRemove: (id: string) => void;
  onUpdate: (debt: Debt) => void;
}) {
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
          <button
            type="button"
            onClick={() => {
              const nextPaid = window.prompt("Valor ja pago nesta divida", String(debt.paid));
              if (nextPaid === null) return;
              const paid = Math.min(debt.total, Math.max(0, moneyToNumber(nextPaid)));
              onUpdate({ ...debt, paid });
            }}
            className="rounded-full bg-white px-3 py-2 text-xs font-black text-ocean shadow-sm"
          >
            Editar
          </button>
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
      <div className="grid grid-cols-4 gap-1">
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

function JourneyPathSvg({ path, width, height }: { path: string; width: number; height: number }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id="journey-path-gradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#21B7A6" />
          <stop offset="58%" stopColor="#2BB673" />
          <stop offset="100%" stopColor="#F59E5B" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="rgba(18,51,95,0.08)" strokeLinecap="round" strokeWidth="34" />
      <path d={path} fill="none" stroke="rgba(255,255,255,0.82)" strokeLinecap="round" strokeWidth="22" />
      <motion.path
        d={path}
        fill="none"
        stroke="url(#journey-path-gradient)"
        strokeLinecap="round"
        strokeWidth="10"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.85 }}
      />
    </svg>
  );
}

function VillageDecorations({ level, width, height }: { level: number; width: number; height: number }) {
  const flowerCount = Math.min(30, 6 + Math.floor(level / 2));
  const hasSafe = level >= 1000;

  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: flowerCount }).map((_, index) => {
        const left = 34 + ((index * 89) % Math.max(width - 72, 1));
        const top = 72 + ((index * 131) % Math.max(height - 138, 1));

        return (
          <span key={index} className="absolute grid h-6 w-6 place-items-center" style={{ left, top }}>
            <span className="absolute h-2 w-2 rounded-full bg-amber/75" />
            <span className="absolute h-1.5 w-5 rounded-full bg-leaf/50" />
            <span className="absolute h-5 w-1.5 rounded-full bg-leaf/45" />
          </span>
        );
      })}
      {level >= 8 && <span className="absolute left-12 top-10 h-14 w-14 rounded-full border-4 border-white bg-aqua/12 shadow-sm" />}
      {level >= 14 && <span className="absolute bottom-24 right-14 h-16 w-20 rounded-[18px] border-4 border-white bg-leaf/12 shadow-sm" />}
      {hasSafe && (
        <span className="absolute right-20 top-24 grid h-16 w-16 place-items-center rounded-[16px] border-4 border-amber bg-white shadow-soft">
          <span className="absolute -top-4 h-8 w-10 rounded-t-[16px] border-4 border-amber bg-white" />
          <PiggyBank size={26} className="relative z-10 text-amber" />
        </span>
      )}
    </div>
  );
}

function JourneyStepButton({
  step,
  point,
  active,
  onClick
}: {
  step: JourneyStep;
  point: JourneyPoint;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = step.icon;
  const interactive = Boolean(step.debtId || step.panel || step.target);
  const starCount = step.state === "done" ? Math.min(3, Math.max(1, Math.ceil(step.xp / 120))) : 0;
  const stateLabel: Record<JourneyStepState, string> = {
    done: "Concluído",
    current: "Agora",
    future: "Próximo",
    locked: "Bloqueado"
  };
  const houseClass = {
    ink: "border-ink bg-ink text-white shadow-glow",
    blue: "border-white bg-white text-ocean shadow-soft",
    green: "border-leaf bg-leaf text-white shadow-soft",
    orange: "border-amber bg-amber text-white shadow-soft",
    muted: "border-white bg-white text-ocean/42 shadow-sm"
  }[step.tone];
  const roofClass = {
    ink: "border-ink bg-ocean",
    blue: "border-ocean/20 bg-mist",
    green: "border-leaf bg-leaf/80",
    orange: "border-amber bg-amber/85",
    muted: "border-ocean/10 bg-white"
  }[step.tone];
  const pillClass = {
    done: "bg-leaf text-white",
    current: "bg-amber text-white",
    future: "bg-white text-ocean",
    locked: "bg-ocean/8 text-ocean/48"
  }[step.state];
  const sizeClass = {
    hall: "h-[78px] w-[104px]",
    income: "h-[70px] w-[92px]",
    expenses: "h-[70px] w-[92px]",
    debts: "h-[74px] w-[98px]",
    plan: "h-[70px] w-[92px]",
    goal: "h-[78px] w-[104px]"
  }[step.building];
  const doorClass = step.tone === "blue" || step.tone === "muted" ? "bg-ocean/16" : "bg-white/28";

  return (
    <motion.button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      className={cn(
        "absolute flex w-40 -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center",
        interactive ? "cursor-pointer" : "cursor-default opacity-75"
      )}
      style={{ left: point.x, top: point.y }}
      initial={{ opacity: 0, y: 18, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.38 }}
      whileHover={interactive ? { y: -3 } : undefined}
      whileTap={interactive ? { scale: 0.96 } : undefined}
    >
      <span className="relative flex h-28 w-36 items-end justify-center">
        <span className={cn("absolute top-2 h-16 w-16 rotate-45 rounded-[12px] border-4", roofClass)} />
        <span className={cn("relative grid place-items-center rounded-[14px] border-4", sizeClass, houseClass, active && "ring-4 ring-aqua/25")}>
          <Icon size={24} />
          <span className={cn("absolute bottom-2 h-5 w-4 rounded-t-full", doorClass)} />
          {step.building === "goal" && <span className="absolute right-3 top-3 h-3 w-3 rounded-full bg-amber" />}
        </span>
        {step.state === "done" && (
          <span className="absolute right-2 top-3 grid h-7 w-7 place-items-center rounded-full bg-leaf text-white shadow-sm">
            <CheckCircle2 size={16} />
          </span>
        )}
        {step.state === "locked" && (
          <span className="absolute right-2 top-3 grid h-7 w-7 place-items-center rounded-full bg-ocean/10 text-ocean/45">
            <Lock size={15} />
          </span>
        )}
        {starCount > 0 && (
          <span className="absolute -bottom-1 flex gap-0.5 rounded-full bg-white px-2 py-1 shadow-sm">
            {Array.from({ length: starCount }).map((_, index) => (
              <Star key={index} size={12} className="fill-amber text-amber" />
            ))}
          </span>
        )}
      </span>
      <span className="mt-2 max-w-[138px] text-sm font-black leading-4 text-ink">{step.label}</span>
      <span className="mt-1 max-h-8 max-w-[144px] overflow-hidden text-[11px] leading-4 text-ocean/58">{step.sublabel}</span>
      <span className={cn("mt-2 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide", pillClass)}>
        {step.xp > 0 ? `${step.xp} XP` : stateLabel[step.state]}
      </span>
    </motion.button>
  );
}

function buildJourneyPoints(count: number, width = 520): JourneyPoint[] {
  const xPositions = [width * 0.5, width * 0.28, width * 0.72, width * 0.22, width * 0.78, width * 0.34, width * 0.66, width * 0.48];
  return Array.from({ length: count }, (_, index) => ({
    x: Math.round(xPositions[index % xPositions.length]),
    y: 92 + index * 142
  }));
}

function buildJourneyPath(points: JourneyPoint[]) {
  if (points.length === 0) return "";

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    return `${path} C ${previous.x} ${previous.y + 54}, ${point.x} ${point.y - 54}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function normalizeJourneySteps(steps: JourneyStep[]): JourneyStep[] {
  const currentIndex = steps.findIndex((step) => step.state !== "done" && step.state !== "locked");
  if (currentIndex < 0) return steps;

  return steps.map((step, index) => {
    if (step.state === "done" || step.state === "locked") return step;
    return {
      ...step,
      state: index === currentIndex ? "current" : "future"
    };
  });
}

function buildJourneySteps(data: AppData): JourneyStep[] {
  const plan = buildPayoffPlan(data);
  const hasIncome = data.income.monthly > 0;
  const hasExpenses = data.expenses.length > 0;
  const hasDebts = data.debts.length > 0;
  const hasCapacity = hasDebts && paymentCapacity(data) > 0;
  const allDebtsDone = hasDebts && totalRemaining(data.debts) <= 0;

  const baseSteps: JourneyStep[] = [
    {
      id: "profile",
      label: "Começo",
      sublabel: data.profile?.name ? `Olá, ${data.profile.name}` : "Crie seu perfil",
      icon: Leaf,
      tone: "ink",
      state: data.profile ? "done" : "current",
      xp: data.profile ? 50 : 0,
      building: "hall",
      target: "profile"
    },
    {
      id: "income",
      label: "Renda",
      sublabel: hasIncome ? formatMoney(data.income.monthly) : "Cadastre sua renda",
      icon: WalletCards,
      tone: "green",
      state: hasIncome ? "done" : "current",
      xp: hasIncome ? 60 : 0,
      building: "income",
      panel: "income"
    },
    {
      id: "expenses",
      label: "Gastos",
      sublabel: hasExpenses ? formatMoney(totalExpenses(data)) : "Liste suas contas",
      icon: Home,
      tone: "blue",
      state: hasExpenses ? "done" : "current",
      xp: hasExpenses ? Math.max(40, data.expenses.length * 20) : 0,
      building: "expenses",
      panel: "expenses"
    },
    {
      id: "debts",
      label: "Dívidas",
      sublabel: hasDebts ? formatMoney(totalRemaining(data.debts)) : "Adicione a primeira",
      icon: AlertTriangle,
      tone: hasDebts ? "orange" : "muted",
      state: hasDebts ? "done" : "current",
      xp: hasDebts ? data.debts.length * 50 : 0,
      building: "debts",
      panel: "debts"
    },
    {
      id: "plan",
      label: "Plano",
      sublabel: hasCapacity ? strategyLabel(data.strategy) : "Defina sua capacidade",
      icon: ClipboardCheck,
      tone: "blue",
      state: hasCapacity ? "done" : "current",
      xp: hasCapacity ? 80 : 0,
      building: "plan",
      target: "plan"
    }
  ];

  const firstDebtStep: JourneyStep[] = hasDebts
    ? []
    : [
        {
          id: "first-debt-path",
          label: "Primeira dívida",
          sublabel: "Cadastre para começar",
          icon: Plus,
          tone: "orange",
          state: "current",
          xp: 0,
          building: "debts",
          panel: "debts"
        }
      ];

  const debtSteps: JourneyStep[] = plan.slice(0, 6).map((item, index) => {
    const remaining = remainingDebt(item.debt);
    const done = remaining <= 0;
    return {
      id: `journey-${item.debt.id}`,
      label: item.debt.name,
      sublabel: done ? "Dívida quitada" : `${formatMoney(remaining)} restantes`,
      icon: item.debt.urgent ? AlertTriangle : WalletCards,
      tone: done ? "green" : item.debt.urgent ? "orange" : "blue",
      state: done ? "done" : index === 0 ? "current" : "future",
      xp: done ? 250 : Math.min(120, Math.round(progressRatio([item.debt]) * 120)),
      building: "debts",
      debtId: item.debt.id
    };
  });

  const goalStep: JourneyStep = {
    id: "goal",
    label: "Meta liberada",
    sublabel: data.onboarding.firstGoal || "Seu próximo plano",
    icon: Target,
    tone: allDebtsDone ? "green" : "muted",
    state: allDebtsDone ? "done" : "locked",
    xp: allDebtsDone ? 200 : 0,
    building: "goal",
    target: "plan"
  };

  return normalizeJourneySteps([...baseSteps, ...firstDebtStep, ...debtSteps, goalStep]);
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
  const nodes = [
    { cx: 70, cy: 54, r: 22, fill: "#F59E5B", label: "1", delay: 0.45 },
    { cx: 207, cy: 45, r: 24, fill: "#2BB673", label: "2", delay: 0.55 },
    { cx: 50, cy: 116, r: 20, fill: "#FFFFFF", label: "3", delay: 0.65 },
    { cx: 226, cy: 120, r: 20, fill: "#21B7A6", label: "4", delay: 0.75 },
    { cx: 140, cy: 32, r: 26, fill: "#FFFFFF", label: "+", delay: 0.85 }
  ];

  return (
    <div className="relative mx-auto h-44 w-full max-w-[280px]">
      <motion.svg
        className="h-full w-full overflow-visible"
        viewBox="0 0 280 170"
        initial="hidden"
        animate="visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="tree-preview-trunk" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#21B7A6" />
            <stop offset="100%" stopColor="#2BB673" />
          </linearGradient>
          <filter id="tree-preview-shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#21B7A6" floodOpacity="0.28" />
          </filter>
        </defs>
        <motion.path
          d="M140 156 C138 132 140 104 140 78"
          fill="none"
          stroke="url(#tree-preview-trunk)"
          strokeLinecap="round"
          strokeWidth="9"
          variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
          transition={{ duration: 0.7, delay: 0.12 }}
        />
        <motion.path
          d="M140 94 C116 78 94 63 70 54"
          fill="none"
          stroke="#8BD1BE"
          strokeLinecap="round"
          strokeWidth="6"
          variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
          transition={{ duration: 0.55, delay: 0.25 }}
        />
        <motion.path
          d="M140 86 C162 68 184 53 207 45"
          fill="none"
          stroke="#8BD1BE"
          strokeLinecap="round"
          strokeWidth="6"
          variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
          transition={{ duration: 0.55, delay: 0.32 }}
        />
        <motion.path
          d="M140 121 C112 122 83 119 50 116"
          fill="none"
          stroke="#B7DCCF"
          strokeLinecap="round"
          strokeWidth="5"
          variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
          transition={{ duration: 0.55, delay: 0.39 }}
        />
        <motion.path
          d="M140 121 C169 119 196 119 226 120"
          fill="none"
          stroke="#B7DCCF"
          strokeLinecap="round"
          strokeWidth="5"
          variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
          transition={{ duration: 0.55, delay: 0.46 }}
        />
        <motion.path
          d="M140 155 C121 148 103 149 84 158 M140 155 C159 148 177 149 196 158"
          fill="none"
          stroke="#6BAE91"
          strokeLinecap="round"
          strokeWidth="5"
          variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1 } }}
          transition={{ duration: 0.5, delay: 0.52 }}
        />
        {nodes.map((node) => (
          <motion.g
            key={`${node.cx}-${node.cy}`}
            filter="url(#tree-preview-shadow)"
            initial={{ opacity: 0, scale: 0.65 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.36, delay: node.delay }}
            style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
          >
            <circle cx={node.cx} cy={node.cy} r={node.r} fill={node.fill} />
            <text x={node.cx} y={node.cy + 5} textAnchor="middle" className="fill-ink text-sm font-black">
              {node.label}
            </text>
          </motion.g>
        ))}
      </motion.svg>
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
