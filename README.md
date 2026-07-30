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
- Pagina de vendas em `/vendas`, pronta para receber link de checkout.
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

## Pagina de vendas e checkout

A pagina comercial fica em:

```text
/vendas
```

Enquanto o checkout nao estiver conectado, o botao da oferta abre o app de teste. Para ligar Kiwify, Hotmart ou outro checkout, configure:

```bash
NEXT_PUBLIC_CHECKOUT_URL=
```

Depois de adicionar essa variavel na Vercel, faca um novo deploy.

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

Na Vercel, crie essas variaveis em **Environment Variables** e faca um novo deploy.

Importante: a chave da OpenAI deve se chamar `OPENAI_API_KEY`. Nao use `NEXT_PUBLIC_OPENAI_API_KEY`, porque isso enviaria a chave para o navegador.

## Aviso importante

O Organiza+ MVP oferece organizacao pessoal e estimativas demonstrativas. Ele nao substitui orientacao financeira, juridica, contabil ou negociacao oficial com credores.
