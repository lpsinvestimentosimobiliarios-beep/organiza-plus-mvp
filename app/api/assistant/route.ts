import { NextResponse } from "next/server";

type AssistantResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
};

export async function POST(request: Request) {
  const { message, context } = (await request.json()) as {
    message?: string;
    context?: unknown;
  };

  const userMessage = String(message || "").trim().slice(0, 1200);

  if (!userMessage) {
    return NextResponse.json({
      mode: "local-demo",
      reply: "Escreva uma pergunta para eu ajudar com seu plano."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      mode: "local-demo",
      reply:
        "Modo demonstrativo local ativo. Configure OPENAI_API_KEY para ativar respostas reais pela API da OpenAI."
    });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions:
        "Você é o assistente do Organiza+. Responda em português do Brasil, com tom acolhedor, direto e sem julgamento. Ajude o usuário a organizar dívidas, prioridades, rotina financeira e próximos passos. Não faça promessas de resultado, não diga que é consultoria financeira, não recomende empréstimos como solução principal e não peça senhas bancárias. Use os dados do contexto apenas para organização pessoal.",
      input: JSON.stringify({ message: userMessage, context })
    })
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        mode: "openai-error",
        reply: "Não consegui consultar a IA agora. O modo local continua disponível."
      },
      { status: 200 }
    );
  }

  const payload = (await response.json()) as AssistantResponse;
  const reply =
    payload.output_text ||
    payload.output?.[0]?.content?.[0]?.text ||
    "Recebi sua mensagem, mas não consegui montar uma resposta completa.";

  return NextResponse.json({ mode: "openai", reply });
}
