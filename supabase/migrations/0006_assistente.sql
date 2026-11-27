-- 0006 · Assistente do CRM
-- Relatórios que o assistente monta a pedido do time e que ficam guardados na tela Relatórios.
-- Rode no SQL Editor do Supabase (projeto do CRM). Pode rodar mais de uma vez.
create table if not exists relatorios_assistente (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  conteudo text not null,
  pedido text,
  criado_por uuid references perfis (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists relatorios_assistente_criado on relatorios_assistente (criado_em desc);
alter table relatorios_assistente enable row level security;
drop policy if exists time_le on relatorios_assistente;
create policy time_le on relatorios_assistente for select to authenticated using (eh_do_time());
drop policy if exists time_apaga on relatorios_assistente;
create policy time_apaga on relatorios_assistente for delete to authenticated using (eh_do_time());
drop policy if exists time_insere on relatorios_assistente;
create policy time_insere on relatorios_assistente for insert to authenticated with check (eh_do_time() and criado_por = auth.uid());
