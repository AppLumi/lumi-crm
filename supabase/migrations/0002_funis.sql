-- Lumi CRM · funis personalizados
-- Funis além do de vendas do Lumi: parceiros, outros negócios B2B, credenciamento de especialistas de telepsicologia…
-- Cada funil tem etapas próprias, campos próprios e, se quiser, um formulário público de cadastro.
-- Rode no SQL Editor do projeto Supabase do Lumi depois da 0001. Pode rodar de novo sem problema.

do $$ begin
  create type tipo_etapa_funil as enum ('aberta', 'ganha', 'perdida');
exception when duplicate_object then null; end $$;

create table if not exists funis (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  -- campos próprios do funil: [{chave, rotulo, tipo, obrigatorio, publico, opcoes, ajuda}]
  campos jsonb not null default '[]'::jsonb check (jsonb_typeof(campos) = 'array'),
  mostra_valor boolean not null default true,
  pede_empresa boolean not null default true,
  -- formulário público em /f/<slug> (ex.: cadastro de especialistas)
  slug text unique check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  formulario_publico boolean not null default false,
  formulario_titulo text,
  formulario_texto text,
  formulario_obrigado text,
  avisar text,               -- e-mails que recebem aviso de cadastro novo, separados por vírgula
  dono_padrao uuid references perfis (id) on delete set null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists funil_etapas (
  id uuid primary key default gen_random_uuid(),
  funil_id uuid not null references funis (id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  tipo tipo_etapa_funil not null default 'aberta',
  prazo_dias integer check (prazo_dias is null or prazo_dias > 0),
  criado_em timestamptz not null default now()
);
create index if not exists funil_etapas_funil on funil_etapas (funil_id, ordem);

create table if not exists funil_cards (
  id uuid primary key default gen_random_uuid(),
  funil_id uuid not null references funis (id) on delete cascade,
  etapa_id uuid not null references funil_etapas (id) on delete restrict,
  titulo text not null,
  nome text,
  email text,
  whatsapp text,
  empresa text,
  conta_id uuid references contas (id) on delete set null,
  contato_id uuid references contatos (id) on delete set null,
  lead_id uuid references leads (id) on delete set null,
  valor numeric(14, 2) check (valor is null or valor >= 0),
  dono uuid references perfis (id) on delete set null,
  dados jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object'),
  origem text not null default 'manual',
  aceita_marketing boolean not null default false,
  consentimento_em timestamptz,
  etapa_desde timestamptz not null default now(),
  fechado_em timestamptz,
  motivo_perda text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists funil_cards_funil on funil_cards (funil_id, etapa_id);
create index if not exists funil_cards_conta on funil_cards (conta_id);
create index if not exists funil_cards_lead on funil_cards (lead_id);
create index if not exists funil_cards_email on funil_cards (funil_id, lower(email));

-- histórico do card na mesma linha do tempo de leads, contas e oportunidades
alter table atividades add column if not exists card_id uuid references funil_cards (id) on delete cascade;
create index if not exists atividades_card on atividades (card_id, criado_em desc);

drop trigger if exists funis_atualizado on funis;
create trigger funis_atualizado before update on funis for each row execute function tocar_atualizado_em();
drop trigger if exists funil_cards_atualizado on funil_cards;
create trigger funil_cards_atualizado before update on funil_cards for each row execute function tocar_atualizado_em();

-- a etapa precisa ser do mesmo funil; mudar de etapa reinicia o relógio e fecha/reabre o card
create or replace function funil_card_etapa() returns trigger language plpgsql as $$
declare v_tipo tipo_etapa_funil;
begin
  select tipo into v_tipo from funil_etapas where id = new.etapa_id and funil_id = new.funil_id;
  if not found then raise exception 'A etapa não é deste funil'; end if;
  if tg_op = 'INSERT' or new.etapa_id is distinct from old.etapa_id then
    new.etapa_desde := now();
    new.fechado_em := case when v_tipo = 'aberta' then null else now() end;
    if v_tipo <> 'perdida' then new.motivo_perda := null; end if;
  end if;
  return new;
end $$;
drop trigger if exists funil_cards_etapa on funil_cards;
create trigger funil_cards_etapa before insert or update on funil_cards for each row execute function funil_card_etapa();

create or replace view v_funil_cards with (security_invoker = true) as
select c.*, e.nome as etapa_nome, e.tipo as etapa_tipo, e.ordem as etapa_ordem, p.nome as dono_nome, ct.nome as conta_nome,
  extract(day from now() - c.etapa_desde)::int as dias_na_etapa
from funil_cards c
join funil_etapas e on e.id = c.etapa_id
left join perfis p on p.id = c.dono
left join contas ct on ct.id = c.conta_id;

alter table funis enable row level security;
alter table funil_etapas enable row level security;
alter table funil_cards enable row level security;
drop policy if exists time_tudo on funis;
create policy time_tudo on funis for all to authenticated using (eh_do_time()) with check (eh_do_time());
drop policy if exists time_tudo on funil_etapas;
create policy time_tudo on funil_etapas for all to authenticated using (eh_do_time()) with check (eh_do_time());
drop policy if exists time_tudo on funil_cards;
create policy time_tudo on funil_cards for all to authenticated using (eh_do_time()) with check (eh_do_time());
