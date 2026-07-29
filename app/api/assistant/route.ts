import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { message, context } = (await request.json()) as {
    message?: string;
    context?: unknown;
  };

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
      input: [
        {
          role: "system",
          content:
            "Voce e o assistente do Organiza+. Responda em portugues do Brasil, com tom acolhedor e sem fazer promessas financeiras. Use os dados do contexto apenas para organizacao pessoal."
        },
        {
          role: "user",
          content: JSON.stringify({ message, context })
        }
      ]
    })
  });

  if (!response.ok) {
    return NextResponse.json(
      {
        mode: "openai-error",
        reply: "Nao consegui consultar a IA agora. O modo local continua disponivel."
      },
      { status: 200 }
    );
  }

  const payload = await response.json();
  const reply =
    payload.output_text ||
    payload.output?.[0]?.content?.[0]?.text ||
    "Recebi sua mensagem, mas nao consegui montar uma resposta completa.";

  return NextResponse.json({ mode: "openai", reply });
}
