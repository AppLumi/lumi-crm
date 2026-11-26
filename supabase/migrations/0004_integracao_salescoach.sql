-- 0004 · Integração com o Sales Coach
-- O Sales Coach liga as reuniões (agenda da equipe) a negócios, empresas e contatos do CRM e grava o resultado
-- de cada análise: campos, uma nota com o resumo e uma tarefa com o próximo passo.
-- Rode no SQL Editor do Supabase (projeto do CRM). Pode rodar mais de uma vez.

-- Tokens de acesso (só o hash fica guardado; o token aparece uma vez, na hora de gerar)
create table if not exists integracao_tokens (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  prefixo text not null,
  hash text not null unique,
  criado_por uuid references perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  usado_em timestamptz,
  revogado_em timestamptz
);
alter table integracao_tokens enable row level security;
drop policy if exists time_le on integracao_tokens;
create policy time_le on integracao_tokens for select to authenticated using (eh_do_time());

-- Campos que o Sales Coach preenche (nota, temperatura, próximo passo…), criados pelo próprio Sales Coach
create table if not exists salescoach_campos (
  key text primary key,
  label text not null,
  type text not null default 'text',
  options jsonb,
  criado_em timestamptz not null default now()
);
alter table salescoach_campos enable row level security;
drop policy if exists time_le on salescoach_campos;
create policy time_le on salescoach_campos for select to authenticated using (eh_do_time());

-- Valores dos campos, no negócio ou na empresa
alter table oportunidades add column if not exists sales_coach jsonb not null default '{}'::jsonb;
alter table contas add column if not exists sales_coach jsonb not null default '{}'::jsonb;
