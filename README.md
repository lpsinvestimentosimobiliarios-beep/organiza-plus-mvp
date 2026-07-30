# Organiza+ MVP

Aplicativo PWA mobile-first em portugues do Brasil para ajudar pessoas a organizar dividas, visualizar uma arvore financeira e acompanhar um plano de quitacao.

## O que esta implementado

- Tela de abertura com identidade Organiza+.
- Cadastro/login local demonstrativo quando o Supabase nao esta configurado.
- Cadastro/login online com Supabase quando as variaveis de ambiente estao ativas.
- Onboarding financeiro com renda, gastos, dividas, capacidade mensal e objetivo.
- Dashboard Hoje com progresso, acoes e proximos vencimentos.
- Mapa/arvore financeira interativa com zoom, arraste e detalhe das dividas.
- Plano de quitacao com tres estrategias:
  - urgencias primeiro;
  - menores dividas primeiro;
  - juros maiores primeiro.
- Cadastro e remocao de gastos e dividas.
- Registro rapido de pagamentos.
- Calendario financeiro basico.
- Assistente demonstrativo contextual sem chave externa.
- Jornada com XP, niveis, sequencia diaria e conquistas.
- Perfil, exportacao, limpeza de dados e saida da conta online.
- Manifesto PWA, icones e service worker.
- Arquitetura preparada para Supabase e OpenAI.

## Modo local

O MVP roda localmente sem chaves externas. Nesse modo, os dados ficam salvos no navegador usando `localStorage`.

Nao existem dados simulados escondidos. Os exemplos so aparecem quando o usuario toca em **Carregar exemplo demonstrativo** durante o onboarding.

## Modo online com Supabase

Para ativar conta online e banco em nuvem, configure estas variaveis no ambiente:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

No Supabase, rode o arquivo `organiza-plus-supabase-schema.sql` no SQL Editor para criar as tabelas e politicas de seguranca.

Depois de adicionar as variaveis na Vercel, faca um novo deploy para as mudancas entrarem no site publicado.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra:

```text
http://localhost:3000
```

## Criar build de producao

```bash
npm run build
npm run start
```

## OpenAI opcional

O app ja funciona sem chave da OpenAI. Sem `OPENAI_API_KEY`, o assistente usa respostas demonstrativas locais.

Quando quiser ativar IA real no backend:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
```

## Aviso importante

O Organiza+ MVP oferece organizacao pessoal e estimativas demonstrativas. Ele nao substitui orientacao financeira, juridica, contabil ou negociacao oficial com credores.
