-- Respostas por e-mail dentro do CRM.
-- O e-mail sai com "responder para" um endereço do CRM (ex.: bruna@respostas.applumi.io). O Resend recebe a
-- resposta e avisa o webhook, que guarda aqui, põe na linha do tempo, cria a tarefa "responder" e avisa quem enviou.
-- Pode rodar de novo sem quebrar.

-- conversa dos e-mails enviados: Message-ID (vem do webhook do Resend) e, quando é resposta, a quem responde
alter table emails add column if not exists message_id text;
alter table emails add column if not exists card_id uuid references funil_cards (id) on delete set null;
create index if not exists emails_message_id on emails (message_id) where message_id is not null;
create index if not exists emails_para on emails (lower(para), criado_em desc);

create table if not exists emails_recebidos (
  id uuid primary key default gen_random_uuid(),
  resend_id text not null unique,
  de text not null,
  de_nome text,
  para text,
  assunto text,
  texto text,           -- o e-mail inteiro em texto (sem HTML)
  resposta text,        -- só o que a pessoa escreveu, sem o histórico citado
  message_id text,
  referencias text,     -- Message-IDs da conversa (In-Reply-To + References)
  anexos jsonb not null default '[]'::jsonb,
  automatico boolean not null default false,  -- "fora do escritório" e afins: não vira tarefa
  em_resposta_a uuid references emails (id) on delete set null,
  lead_id uuid references leads (id) on delete set null,
  contato_id uuid references contatos (id) on delete set null,
  conta_id uuid references contas (id) on delete set null,
  oportunidade_id uuid references oportunidades (id) on delete set null,
  card_id uuid references funil_cards (id) on delete set null,
  responsavel uuid references perfis (id) on delete set null,
  tarefa_id uuid references atividades (id) on delete set null,
  respondido_em timestamptz,
  arquivado_em timestamptz,
  recebido_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);
create index if not exists emails_recebidos_quando on emails_recebidos (recebido_em desc);
create index if not exists emails_recebidos_pendentes on emails_recebidos (responsavel, recebido_em desc)
  where respondido_em is null and arquivado_em is null and not automatico;

alter table emails add column if not exists responde_a uuid references emails_recebidos (id) on delete set null;
alter table atividades add column if not exists email_recebido_id uuid references emails_recebidos (id) on delete set null;

alter table emails_recebidos enable row level security;
drop policy if exists time_leitura on emails_recebidos;
create policy time_leitura on emails_recebidos for select to authenticated using (eh_do_time());
-- o time só arquiva ou desarquiva pela tela; o resto é escrito pelo servidor
drop policy if exists time_arquiva on emails_recebidos;
create policy time_arquiva on emails_recebidos for update to authenticated using (eh_do_time()) with check (eh_do_time());
revoke update on emails_recebidos from authenticated;
grant select on emails_recebidos to authenticated;
grant update (arquivado_em) on emails_recebidos to authenticated;
