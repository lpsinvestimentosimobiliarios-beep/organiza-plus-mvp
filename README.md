# Organiza+ MVP

Aplicativo PWA mobile-first em português do Brasil para ajudar pessoas a organizar dívidas, visualizar uma árvore financeira e acompanhar um plano de quitação.

## O que está implementado

- Tela de abertura com identidade Organiza+.
- Cadastro/login demonstrativo local.
- Onboarding financeiro com renda, gastos, dívidas, capacidade mensal e objetivo.
- Dashboard Hoje com progresso, ações e próximos vencimentos.
- Mapa/árvore financeira interativa com zoom, arraste e detalhe das dívidas.
- Plano de quitação com três estratégias:
  - urgências primeiro;
  - menores dívidas primeiro;
  - juros maiores primeiro.
- Cadastro e remoção de gastos e dívidas.
- Registro rápido de pagamentos.
- Calendário financeiro básico.
- Assistente demonstrativo contextual sem chave externa.
- Jornada com XP, níveis, sequência diária e conquistas.
- Perfil, exportação e limpeza de dados locais.
- Manifesto PWA, ícones e service worker.
- Arquitetura preparada para Supabase e OpenAI.

## Modo demonstrativo

O MVP roda localmente sem chaves externas. Os dados são salvos no `localStorage` do navegador.

Não existem dados simulados escondidos. Os exemplos só aparecem quando o usuário toca em **Carregar exemplo demonstrativo** durante o onboarding.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra:

```text
http://localhost:3000
```

## Criar build de produção

```bash
npm run build
npm run start
```

## Variáveis opcionais

Copie `.env.example` para `.env.local` quando quiser ativar integrações reais.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

Sem `OPENAI_API_KEY`, o assistente usa respostas demonstrativas locais.

## Aviso importante

O Organiza+ MVP oferece organização pessoal e estimativas demonstrativas. Ele não substitui orientação financeira, jurídica, contábil ou negociação oficial com credores.
