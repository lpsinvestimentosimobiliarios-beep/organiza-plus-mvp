create table if not exists public.purchase_access (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null default '',
  source text not null default 'kiwify',
  status text not null default 'approved',
  product_name text not null default '',
  transaction_id text,
  raw_event jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_access_email_idx
on public.purchase_access (lower(email));

alter table public.purchase_access enable row level security;

-- Sem politica publica: somente o servidor, usando SUPABASE_SERVICE_ROLE_KEY,
-- pode gravar e consultar os e-mails aprovados pela Kiwify.
