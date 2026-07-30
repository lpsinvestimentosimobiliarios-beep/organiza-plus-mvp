import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Lock,
  Map,
  MessageCircle,
  PiggyBank,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  WalletCards
} from "lucide-react";

export const metadata: Metadata = {
  title: "Organiza+ Dívidas | Organize suas dívidas pelo celular",
  description:
    "Página de vendas do Organiza+ Dívidas, o app que transforma contas, gastos e dívidas em um plano visual para acompanhar pelo celular."
};

const checkoutUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL || "/";
const checkoutReady = Boolean(process.env.NEXT_PUBLIC_CHECKOUT_URL);

const benefits = [
  {
    icon: WalletCards,
    title: "Clareza do que você deve",
    text: "Cadastre dívidas, gastos e renda para enxergar sua situação em um único lugar."
  },
  {
    icon: Map,
    title: "Mapa financeiro visual",
    text: "Veja suas dívidas conectadas a um plano, sem depender de planilhas confusas."
  },
  {
    icon: Target,
    title: "Próximo passo simples",
    text: "O app mostra prioridades por urgência, menores dívidas ou juros maiores."
  },
  {
    icon: Trophy,
    title: "Níveis e conquistas",
    text: "Ganhe XP conforme cadastra, paga e conclui etapas do seu plano."
  }
];

const bonuses = [
  "Kit de mensagens para negociar dívidas",
  "Desafio 30 dias no controle",
  "Calendário antiatraso",
  "Guia da primeira reserva",
  "Plano de emergência financeira"
];

const faqs = [
  {
    question: "O Organiza+ limpa meu nome automaticamente?",
    answer:
      "Não. Ele ajuda você a organizar informações, prioridades e rotina de pagamento. Qualquer acordo precisa ser confirmado diretamente com o credor."
  },
  {
    question: "Funciona no celular?",
    answer:
      "Sim. Ele é um PWA: abre pelo navegador e pode ser adicionado à tela inicial do celular como se fosse um app."
  },
  {
    question: "Preciso informar senha de banco?",
    answer:
      "Não. O Organiza+ não pede senha bancária, token, código do cartão ou acesso ao seu banco."
  },
  {
    question: "Tem mensalidade?",
    answer:
      "A primeira oferta foi pensada como acesso de lançamento. No futuro podem existir planos extras, mas a página deixa isso separado."
  }
];

export default function SalesPage() {
  return (
    <main className="min-h-screen bg-cloud text-ink">
      <Hero />
      <ProofBand />
      <ProductSection />
      <HowItWorks />
      <Benefits />
      <Offer />
      <Faq />
      <MobileStickyCta />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-ink text-white sm:min-h-[88svh]">
      <div className="absolute inset-0 hidden sm:block" aria-hidden="true">
        <HeroScene />
      </div>
      <div className="absolute inset-0 hidden bg-ink/72 sm:block" aria-hidden="true" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col px-5 pb-28 pt-5 sm:min-h-[88svh] sm:justify-between sm:px-8 sm:py-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[8px] bg-aqua text-ink">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-base font-black leading-none sm:text-lg">Organiza+</p>
              <p className="text-xs font-bold text-white/68">Dívidas em mapa</p>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-[8px] border border-white/18 px-3 text-xs font-black text-white sm:h-11 sm:px-4 sm:text-sm"
          >
            Entrar no app
            <ArrowRight size={16} />
          </Link>
        </header>

        <div className="max-w-3xl pb-0 pt-14 sm:pb-16 sm:pt-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-[8px] border border-aqua/30 bg-aqua/12 px-3 py-2 text-sm font-black text-aqua">
            <ShieldCheck size={16} />
            Organizador financeiro visual
          </p>
          <h1 className="text-[40px] font-black leading-[1.02] sm:text-7xl sm:leading-[0.98]">
            Organiza+ Dívidas
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/78 sm:text-xl sm:leading-8">
            Veja todas as suas dívidas em um único mapa, descubra o próximo passo e acompanhe sua evolução pelo celular.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <CtaButton />
            <Link
              href="#como-funciona"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] border border-white/18 px-5 text-sm font-black text-white"
            >
              Ver como funciona
              <Map size={17} />
            </Link>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/58">
            Não é consultoria financeira. É uma ferramenta simples para organizar informações, prioridades e progresso.
          </p>
          <HeroPriceCard />
        </div>
      </div>
    </section>
  );
}

function HeroPriceCard() {
  return (
    <div className="mt-6 w-full max-w-md rounded-[8px] border border-white/16 bg-white p-5 text-ink shadow-soft">
      <p className="text-xs font-black uppercase text-aqua">Oferta de lançamento</p>
      <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
        <span className="text-4xl font-black">R$ 37</span>
        <span className="pb-1 text-sm font-bold text-ocean/58">pagamento único inicial</span>
      </div>
      <div className="mt-4 grid gap-2">
        <PriceLine text="Acesso ao Organiza+ Dívidas" />
        <PriceLine text="Mapa financeiro visual" />
        <PriceLine text="Bônus de lançamento inclusos" />
      </div>
      {!checkoutReady && (
        <p className="mt-4 rounded-[8px] border border-amber/30 bg-amber/12 p-3 text-xs font-bold leading-5 text-ocean/72">
          Checkout ainda não conectado. Por enquanto, o botão abre o app para teste interno.
        </p>
      )}
      <CtaButton className="mt-4 w-full" />
      <p className="mt-3 text-center text-xs leading-5 text-ocean/54">
        Acesso simples, valor baixo e garantia para testar com calma.
      </p>
    </div>
  );
}

function HeroScene() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-ink">
      <div className="absolute right-[-120px] top-[120px] h-[620px] w-[360px] rotate-[-8deg] rounded-[34px] border border-white/12 bg-white/8 p-3 shadow-soft sm:right-[6%] sm:top-[92px] sm:h-[720px] sm:w-[410px]">
        <div className="h-full overflow-hidden rounded-[26px] bg-cloud text-ink">
          <div className="bg-ink px-5 pb-5 pt-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-white/60">Hoje</p>
                <p className="text-xl font-black">Bom dia, Ana</p>
              </div>
              <div className="rounded-[8px] bg-leaf px-3 py-2 text-xs font-black text-white">Nível 4</div>
            </div>
            <div className="mt-5 h-3 rounded-full bg-white/12">
              <div className="h-3 w-[42%] rounded-full bg-aqua" />
            </div>
            <p className="mt-2 text-xs text-white/62">42% da jornada concluída</p>
          </div>

          <div className="space-y-3 p-5">
            <PreviewRow icon={ReceiptText} title="Energia" text="Vence amanhã" value="R$ 168" tone="orange" />
            <PreviewRow icon={WalletCards} title="Cartão" text="Prioridade do plano" value="R$ 420" tone="blue" />
            <PreviewRow icon={PiggyBank} title="Reserva" text="Primeiro passo" value="R$ 50" tone="green" />
          </div>

          <div className="mx-5 rounded-[8px] bg-mist p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-black">Mapa financeiro</p>
              <Map size={18} className="text-aqua" />
            </div>
            <div className="relative h-56">
              <Node className="left-[35%] top-[8%] bg-ink text-white" label="Você" />
              <Node className="left-[8%] top-[42%] bg-amber text-ink" label="Gastos" />
              <Node className="right-[8%] top-[40%] bg-aqua text-ink" label="Dívidas" />
              <Node className="left-[38%] bottom-[5%] bg-leaf text-white" label="Plano" />
              <Line className="left-[42%] top-[29%] w-[34%] rotate-[28deg]" />
              <Line className="left-[22%] top-[35%] w-[28%] rotate-[-28deg]" />
              <Line className="left-[45%] top-[62%] w-[28%] rotate-[90deg]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({
  icon: Icon,
  title,
  text,
  value,
  tone
}: {
  icon: typeof ReceiptText;
  title: string;
  text: string;
  value: string;
  tone: "blue" | "green" | "orange";
}) {
  const color = tone === "green" ? "text-leaf" : tone === "orange" ? "text-amber" : "text-aqua";
  return (
    <div className="flex items-center justify-between gap-3 rounded-[8px] bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Icon size={18} className={color} />
        <div>
          <p className="text-sm font-black">{title}</p>
          <p className="text-xs text-ocean/60">{text}</p>
        </div>
      </div>
      <p className="text-sm font-black">{value}</p>
    </div>
  );
}

function Node({ className, label }: { className: string; label: string }) {
  return (
    <div className={`absolute grid h-16 w-16 place-items-center rounded-full text-[11px] font-black shadow-soft ${className}`}>
      {label}
    </div>
  );
}

function Line({ className }: { className: string }) {
  return <div className={`absolute h-1 origin-left rounded-full bg-ocean/18 ${className}`} />;
}

function ProofBand() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-6xl gap-3 px-5 py-4 sm:grid-cols-3 sm:px-8">
        <Proof icon={Lock} title="Sem senha bancária" text="O usuário cadastra apenas o que deseja organizar." />
        <Proof icon={Download} title="Instalável no celular" text="Funciona como PWA em Android, iPhone e PC." />
        <Proof icon={BadgeCheck} title="Dados claros" text="Modo demo e modo online são identificados no app." />
      </div>
    </section>
  );
}

function Proof({ icon: Icon, title, text }: { icon: typeof Lock; title: string; text: string }) {
  return (
    <div className="flex gap-3 rounded-[8px] border border-ocean/10 bg-cloud p-4">
      <Icon size={20} className="mt-0.5 shrink-0 text-aqua" />
      <div>
        <p className="font-black">{title}</p>
        <p className="mt-1 text-sm leading-5 text-ocean/62">{text}</p>
      </div>
    </div>
  );
}

function ProductSection() {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-5 py-14 sm:grid-cols-[0.95fr_1.05fr] sm:px-8 sm:py-20">
      <div>
        <p className="text-sm font-black uppercase text-aqua">O produto</p>
        <h2 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
          Não é planilha. É um mapa para sair do aperto.
        </h2>
        <p className="mt-5 text-base leading-8 text-ocean/68">
          O Organiza+ foi pensado para quem está cansado de contas soltas, parcelas esquecidas e ansiedade na hora de olhar o dinheiro. A pessoa monta sua situação e recebe uma visão simples do que fazer primeiro.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {benefits.map((benefit) => (
          <div key={benefit.title} className="rounded-[8px] border border-ocean/10 bg-white p-5 shadow-sm">
            <benefit.icon size={22} className="text-aqua" />
            <h3 className="mt-4 font-black">{benefit.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ocean/64">{benefit.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "1. Responda o diagnóstico",
      text: "Renda, gastos, dívidas, vencimentos e capacidade mensal."
    },
    {
      title: "2. Veja o mapa",
      text: "O app organiza tudo em uma árvore financeira visual."
    },
    {
      title: "3. Acompanhe o plano",
      text: "Prioridades, calendário, pagamentos, XP e conquistas."
    }
  ];

  return (
    <section id="como-funciona" className="bg-ink py-14 text-white sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-black uppercase text-aqua">Como funciona</p>
          <h2 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
            Em poucos minutos a bagunça vira um caminho.
          </h2>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="rounded-[8px] border border-white/10 bg-white/8 p-5">
              <CheckCircle2 size={22} className="text-leaf" />
              <h3 className="mt-4 font-black">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/64">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="grid gap-8 sm:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-black uppercase text-aqua">Por que chama atenção</p>
          <h2 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
            Ele vende clareza, progresso e alívio.
          </h2>
        </div>
        <div className="grid gap-3">
          <ValueLine icon={Brain} text="Assistente demonstrativo contextual para explicar prioridades." />
          <ValueLine icon={CalendarDays} text="Calendário básico para vencimentos e parcelas." />
          <ValueLine icon={ClipboardCheck} text="Plano com três estratégias: urgências, menores dívidas e juros maiores." />
          <ValueLine icon={Trophy} text="Gamificação com XP, níveis, sequência diária e conquistas." />
          <ValueLine icon={ShieldCheck} text="Avisos claros: sem senha bancária e sem promessa milagrosa." />
        </div>
      </div>
    </section>
  );
}

function ValueLine({ icon: Icon, text }: { icon: typeof Brain; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[8px] bg-white p-4 shadow-sm">
      <Icon size={20} className="mt-0.5 shrink-0 text-aqua" />
      <p className="text-sm font-bold leading-6 text-ocean/76">{text}</p>
    </div>
  );
}

function Offer() {
  return (
    <section id="oferta" className="bg-white py-14 sm:py-20">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:grid-cols-[1fr_0.85fr] sm:px-8">
        <div>
          <p className="text-sm font-black uppercase text-aqua">Oferta de lançamento</p>
          <h2 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">
            Organiza+ Dívidas por um preço fácil de testar.
          </h2>
          <p className="mt-5 text-base leading-8 text-ocean/68">
            A primeira oferta foi pensada para validar compradores reais com um ticket baixo, alto valor percebido e entrega imediata pelo celular.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {bonuses.map((bonus) => (
              <div key={bonus} className="flex items-center gap-3 rounded-[8px] bg-cloud p-3">
                <CheckCircle2 size={18} className="shrink-0 text-leaf" />
                <p className="text-sm font-bold text-ocean/76">{bonus}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[8px] border border-ocean/12 bg-cloud p-5 shadow-soft">
          <p className="text-sm font-black text-ocean/62">Acesso de lançamento</p>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-5xl font-black">R$ 37</span>
            <span className="pb-2 text-sm font-bold text-ocean/58">pagamento único inicial</span>
          </div>
          <div className="mt-5 space-y-3">
            <PriceLine text="App Organiza+ Dívidas" />
            <PriceLine text="Mapa financeiro visual" />
            <PriceLine text="Plano de quitação" />
            <PriceLine text="Bônus de lançamento" />
            <PriceLine text="Garantia de 7 dias" />
          </div>

          {!checkoutReady && (
            <div className="mt-5 rounded-[8px] border border-amber/30 bg-amber/12 p-3 text-sm leading-6 text-ocean/76">
              Checkout ainda não conectado. Por enquanto, o botão abre o app para teste interno.
            </div>
          )}

          <CtaButton className="mt-5 w-full" />
          <p className="mt-3 text-center text-xs leading-5 text-ocean/54">
            Oferta sujeita a ajustes antes do lançamento público.
          </p>
        </div>
      </div>
    </section>
  );
}

function PriceLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle2 size={18} className="text-leaf" />
      <p className="text-sm font-bold text-ocean/74">{text}</p>
    </div>
  );
}

function Faq() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-sm font-black uppercase text-aqua">Perguntas frequentes</p>
      <h2 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">Transparência antes da venda.</h2>
      <div className="mt-8 grid gap-3">
        {faqs.map((faq) => (
          <div key={faq.question} className="rounded-[8px] border border-ocean/10 bg-white p-5 shadow-sm">
            <h3 className="font-black">{faq.question}</h3>
            <p className="mt-2 text-sm leading-6 text-ocean/66">{faq.answer}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-[8px] border border-ocean/10 bg-mist p-5">
        <div className="flex gap-3">
          <MessageCircle size={22} className="shrink-0 text-aqua" />
          <p className="text-sm leading-6 text-ocean/72">
            O Organiza+ oferece organização pessoal, estimativas e acompanhamento. Ele não substitui consultoria financeira, jurídica, contábil ou atendimento oficial de credores.
          </p>
        </div>
      </div>
    </section>
  );
}

function CtaButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href={checkoutUrl}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-[8px] bg-leaf px-5 text-sm font-black text-white shadow-soft transition hover:bg-[#1f9f69] ${className}`}
    >
      {checkoutReady ? "Quero meu acesso" : "Abrir app de teste"}
      <ArrowRight size={17} />
    </Link>
  );
}

function MobileStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ocean/10 bg-white/94 p-3 shadow-soft backdrop-blur sm:hidden">
      <CtaButton className="w-full" />
    </div>
  );
}
