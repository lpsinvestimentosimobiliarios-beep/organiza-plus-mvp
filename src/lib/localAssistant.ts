import type { AppData } from "./types";
import { buildPayoffPlan, paymentCapacity, totalExpenses, totalRemaining } from "./calculations";
import { formatMoney, formatMonthYear } from "./format";

export function generateLocalAssistantReply(message: string, data: AppData) {
  const text = message.toLowerCase();
  const plan = buildPayoffPlan(data);
  const next = plan[0];
  const capacity = paymentCapacity(data);
  const remaining = totalRemaining(data.debts);
  const expenses = totalExpenses(data);

  if (!data.profile) {
    return "Estou em modo demonstrativo local. Crie uma conta para eu usar os dados cadastrados neste aparelho.";
  }

  if (data.debts.length === 0) {
    return `${data.profile.name}, ainda não há dívidas cadastradas. Cadastre a primeira dívida para eu montar um plano visual e calcular prioridades.`;
  }

  if (text.includes("prior") || text.includes("pagar primeiro") || text.includes("qual dívida")) {
    if (!next) {
      return "Todas as dívidas cadastradas estão quitadas. O próximo passo é criar uma reserva e transformar o dinheiro liberado em uma meta.";
    }

    return `Pelo seu plano atual, eu começaria por ${next.debt.name}. Motivo: ${next.reason} Com ${formatMoney(next.monthlyAllocated)} por mês, a previsão demonstrativa de quitação é ${formatMonthYear(next.finishDate)}.`;
  }

  if (text.includes("quanto") || text.includes("guardar") || text.includes("economizar")) {
    return `Sua capacidade mensal cadastrada é ${formatMoney(capacity)}. Depois dos gastos essenciais (${formatMoney(expenses)}), a dívida aberta soma ${formatMoney(remaining)}. Um bom primeiro movimento é proteger esse valor antes de novos parcelamentos.`;
  }

  if (text.includes("negoci") || text.includes("mensagem") || text.includes("credor")) {
    return "Mensagem pronta: Olá, estou reorganizando minha vida financeira e quero regularizar essa dívida. Hoje consigo assumir uma parcela que caiba no meu orçamento. Vocês podem me enviar uma proposta por escrito com valor atualizado, desconto possível e quantidade de parcelas?";
  }

  if (text.includes("emerg") || text.includes("salário") || text.includes("salario")) {
    return "Quando o dinheiro não cobre tudo, priorize moradia, alimentação, energia, água, transporte para trabalhar e saúde. Depois disso, organize contas com risco de corte e só então dívidas sem risco imediato.";
  }

  if (next) {
    return `${data.profile.name}, seu próximo passo mais claro é manter foco em ${next.debt.name}. Seu plano atual usa a estratégia cadastrada, com previsão demonstrativa para ${formatMonthYear(next.finishDate)}. Posso também gerar uma mensagem de negociação ou recalcular com outra estratégia.`;
  }

  return "Seu mapa está em boa direção. Cadastre uma meta pós-dívida para o Organiza+ transformar o dinheiro liberado em uma nova conquista.";
}
