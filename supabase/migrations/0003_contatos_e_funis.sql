-- 0003 · Contatos x leads e movimentação entre funis
-- Rode no SQL Editor do Supabase (projeto do CRM). Pode rodar mais de uma vez sem problema.

-- 1) Lead que foi mesclado/vinculado a uma empresa vira contato e sai da lista de leads.
alter type status_lead add value if not exists 'convertido';

-- 2) Contatos vindos de listas de prospecção, frias ou importação guardam de onde vieram e quem cuida.
alter table contatos add column if not exists origem text;
alter table contatos add column if not exists evento text;
alter table contatos add column if not exists dono uuid references perfis (id) on delete set null;
create index if not exists contatos_origem on contatos (origem);
create index if not exists contatos_criado on contatos (criado_em desc);
