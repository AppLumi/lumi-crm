-- Lumi CRM · fase 1 (base comercial)
-- Rode no SQL Editor do projeto Supabase do Lumi (ou via `supabase db push`).
-- Princípio: o CRM nunca guarda dado de saúde individual. Só dados comerciais e, na fase 2, métricas agregadas por empresa.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type papel_usuario as enum ('socia', 'negocios', 'marketing', 'tecnologia');
create type estagio_conta as enum ('lead', 'oportunidade', 'cliente', 'ex_cliente');
create type papel_compra as enum ('decisor', 'influenciador', 'usuario_painel', 'outro');
create type status_lead as enum ('novo', 'em_contato', 'qualificado', 'nutricao', 'descartado');
create type etapa_oportunidade as enum ('qualificacao', 'diagnostico', 'demo', 'piloto', 'proposta', 'negociacao', 'ganha', 'perdida');
create type plano_lumi as enum ('starter', 'premium');
create type motivo_perda as enum ('preco', 'timing', 'concorrente', 'sem_decisor', 'sem_orcamento', 'sem_resposta', 'outro');
create type status_proposta as enum ('rascunho', 'aguardando_aprovacao', 'aprovada', 'enviada', 'aceita', 'recusada', 'expirada');
create type tipo_atividade as enum ('nota', 'email', 'ligacao', 'reuniao', 'whatsapp', 'tarefa', 'sistema');
create type status_email as enum ('enviando', 'enviado', 'entregue', 'aberto', 'clicado', 'devolvido', 'reclamacao', 'falhou');

-- ---------------------------------------------------------------------------
-- Pessoas do time (espelha auth.users)
-- ---------------------------------------------------------------------------
create table perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email text not null unique,
  papel papel_usuario not null default 'negocios',
  aprova_desconto boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Núcleo comercial
-- ---------------------------------------------------------------------------
create table contas (
  id uuid primary key default gen_random_uuid(),
  cnpj text unique check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  razao_social text,
  nome text not null,
  cnae text,
  setor text,
  porte text,
  colaboradores integer check (colaboradores is null or colaboradores >= 0),
  cidade text,
  uf text,
  site text,
  estagio estagio_conta not null default 'lead',
  dono uuid references perfis (id),
  origem text,
  lumi_cliente_id text, -- id do cliente no admin do Lumi, preenchido na implantação
  notas text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table contatos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references contas (id) on delete cascade,
  nome text not null,
  cargo text,
  papel papel_compra not null default 'outro',
  email text,
  whatsapp text,
  linkedin text,
  aceita_marketing boolean not null default false,
  consentimento_em timestamptz,
  descadastrado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on contatos (conta_id);
create unique index contatos_email_unico on contatos (lower(email)) where email is not null;

create table leads (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  whatsapp text,
  empresa text,
  cnpj text check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  cargo text,
  colaboradores integer,
  mensagem text,
  origem text not null default 'site',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  pagina text,
  evento text,
  aceita_marketing boolean not null default false,
  consentimento_em timestamptz,
  status status_lead not null default 'novo',
  nota_perfil integer not null default 0 check (nota_perfil between 0 and 100),
  dono uuid references perfis (id),
  conta_id uuid references contas (id) on delete set null,
  contato_id uuid references contatos (id) on delete set null,
  oportunidade_id uuid,
  enriquecimento jsonb,
  motivo_descarte text,
  primeiro_contato_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on leads (status);
create index on leads (criado_em desc);
create index on leads (lower(email));

create table oportunidades (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  titulo text not null,
  etapa etapa_oportunidade not null default 'qualificacao',
  etapa_desde timestamptz not null default now(),
  plano plano_lumi not null default 'premium',
  vidas integer check (vidas is null or vidas > 0),
  valor_mensal numeric(12, 2),
  valor_implementacao numeric(12, 2),
  valor_primeiro_ano numeric(12, 2),
  previsao_fechamento date,
  dono uuid references perfis (id),
  -- critérios de saída das etapas
  dor text,
  decisor_id uuid references contatos (id) on delete set null,
  situacao_pgr text,
  criterio_decisao text,
  demo_em timestamptz,
  piloto_escopo text,
  piloto_resultado text,
  condicoes_finais text,
  motivo_perda motivo_perda,
  motivo_perda_detalhe text,
  fechada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on oportunidades (conta_id);
create index on oportunidades (etapa);
alter table leads add constraint leads_oportunidade_fk foreign key (oportunidade_id) references oportunidades (id) on delete set null;

create table propostas (
  id uuid primary key default gen_random_uuid(),
  oportunidade_id uuid not null references oportunidades (id) on delete cascade,
  versao integer not null default 1,
  plano plano_lumi not null,
  vidas integer not null check (vidas > 0),
  preco_vida numeric(10, 2) not null,
  mensal_tabela numeric(12, 2) not null,
  desconto_pct numeric(5, 2) not null default 0 check (desconto_pct between 0 and 100),
  mensal numeric(12, 2) not null,
  implementacao_tabela numeric(12, 2) not null,
  desconto_implementacao_pct numeric(5, 2) not null default 0 check (desconto_implementacao_pct between 0 and 100),
  implementacao numeric(12, 2) not null,
  primeiro_ano numeric(12, 2) not null,
  piso_aplicado boolean not null default false,
  validade date not null default (current_date + 15),
  observacoes text,
  status status_proposta not null default 'rascunho',
  motivo_aprovacao text,
  aprovado_por uuid references perfis (id),
  aprovado_em timestamptz,
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  enviada_em timestamptz,
  visualizada_em timestamptz,
  respondida_em timestamptz,
  criado_por uuid references perfis (id),
  criado_em timestamptz not null default now(),
  unique (oportunidade_id, versao)
);

create table atividades (
  id uuid primary key default gen_random_uuid(),
  tipo tipo_atividade not null,
  titulo text not null,
  descricao text,
  conta_id uuid references contas (id) on delete cascade,
  contato_id uuid references contatos (id) on delete set null,
  lead_id uuid references leads (id) on delete cascade,
  oportunidade_id uuid references oportunidades (id) on delete cascade,
  autor uuid references perfis (id),
  responsavel uuid references perfis (id),
  vence_em timestamptz,
  concluida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on atividades (conta_id, criado_em desc);
create index on atividades (lead_id, criado_em desc);
create index on atividades (oportunidade_id, criado_em desc);
create index on atividades (responsavel, vence_em) where tipo = 'tarefa' and concluida_em is null;

-- sinais de interesse (site, eventos, e-mail, WhatsApp). Nunca dado de saúde.
create table eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  origem text not null default 'site',
  lead_id uuid references leads (id) on delete cascade,
  conta_id uuid references contas (id) on delete cascade,
  propriedades jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index on eventos (lead_id, criado_em desc);
create index on eventos (conta_id, criado_em desc);

create table modelos_email (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'comercial',
  assunto text not null,
  corpo text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table emails (
  id uuid primary key default gen_random_uuid(),
  para text not null,
  assunto text not null,
  corpo text not null,
  modelo_id uuid references modelos_email (id) on delete set null,
  status status_email not null default 'enviando',
  resend_id text unique,
  erro text,
  lead_id uuid references leads (id) on delete set null,
  contato_id uuid references contatos (id) on delete set null,
  conta_id uuid references contas (id) on delete set null,
  oportunidade_id uuid references oportunidades (id) on delete set null,
  autor uuid references perfis (id),
  enviado_em timestamptz,
  entregue_em timestamptz,
  aberto_em timestamptz,
  clicado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- registro de quem viu ou mudou o quê (LGPD)
create table auditoria (
  id bigserial primary key,
  quem uuid,
  acao text not null,
  tabela text not null,
  registro uuid,
  detalhe jsonb,
  em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Funções auxiliares
-- ---------------------------------------------------------------------------
create or replace function tocar_atualizado_em() returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger contas_atualizado before update on contas for each row execute function tocar_atualizado_em();
create trigger contatos_atualizado before update on contatos for each row execute function tocar_atualizado_em();
create trigger leads_atualizado before update on leads for each row execute function tocar_atualizado_em();
create trigger oportunidades_atualizado before update on oportunidades for each row execute function tocar_atualizado_em();

-- quem está logado é do time e está ativo?
create or replace function eh_do_time() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo);
$$;

create or replace function pode_aprovar_desconto() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and ativo and aprova_desconto);
$$;

-- mudança de etapa: registra data, fecha e loga na linha do tempo
create or replace function oportunidade_mudou_etapa() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.etapa is distinct from old.etapa then
    new.etapa_desde := now();
    if new.etapa in ('ganha', 'perdida') then
      new.fechada_em := now();
    else
      new.fechada_em := null;
    end if;
    insert into atividades (tipo, titulo, conta_id, oportunidade_id, autor)
    values ('sistema', 'Etapa: ' || old.etapa || ' → ' || new.etapa, new.conta_id, new.id, auth.uid());
    if new.etapa = 'ganha' then
      update contas set estagio = 'cliente' where id = new.conta_id;
    end if;
  end if;
  return new;
end $$;
create trigger oportunidades_etapa before update on oportunidades for each row execute function oportunidade_mudou_etapa();

-- desconto acima do limite exige aprovação: a proposta não sai de "aguardando_aprovacao" sem quem pode aprovar
create or replace function proposta_regras() returns trigger language plpgsql security definer set search_path = public as $$
declare
  limite numeric := 10;
begin
  if (new.desconto_pct > limite or new.vidas > 5000) and new.status in ('aprovada', 'enviada', 'aceita')
     and new.aprovado_por is null then
    raise exception 'Desconto acima de % %% ou mais de 5.000 vidas: precisa de aprovação de uma sócia', limite;
  end if;
  if new.desconto_pct > 20 then
    raise exception 'Desconto acima de 20%% não é praticado';
  end if;
  if new.desconto_implementacao_pct > 50 then
    raise exception 'Desconto na implementação limitado a 50%%';
  end if;
  if tg_op = 'UPDATE' and new.aprovado_por is distinct from old.aprovado_por and new.aprovado_por is not null then
    if not exists (select 1 from perfis where id = new.aprovado_por and aprova_desconto and ativo) then
      raise exception 'Quem aprova precisa ter permissão de aprovar descontos';
    end if;
    if auth.uid() is not null and new.aprovado_por <> auth.uid() then
      raise exception 'A aprovação é registrada por quem aprova';
    end if;
    new.aprovado_em := now();
  end if;
  return new;
end $$;
create trigger propostas_regras before insert or update on propostas for each row execute function proposta_regras();

-- ---------------------------------------------------------------------------
-- Pontuação de interesse: soma de sinais com meia-vida de 30 dias
-- ---------------------------------------------------------------------------
create or replace function peso_evento(nome text) returns numeric language sql immutable as $$
  select case nome
    when 'demo_solicitada' then 40
    when 'presenca_evento' then 25
    when 'formulario_contato' then 25
    when 'inscricao_evento' then 20
    when 'download_material' then 15
    when 'whatsapp_resposta' then 15
    when 'visita_planos' then 10
    when 'email_clique' then 8
    when 'visita_site' then 3
    when 'email_aberto' then 3
    else 0 end;
$$;

create or replace view v_leads with (security_invoker = true) as
select l.*,
  least(100, round(coalesce((
    select sum(peso_evento(e.nome) * power(0.5, extract(epoch from (now() - e.criado_em)) / (30 * 86400)))
    from eventos e where e.lead_id = l.id), 0)))::int as nota_interesse,
  p.nome as dono_nome
from leads l
left join perfis p on p.id = l.dono;

create or replace view v_oportunidades with (security_invoker = true) as
select o.*, c.nome as conta_nome, c.colaboradores as conta_colaboradores, p.nome as dono_nome,
  case o.etapa
    when 'qualificacao' then 0.10 when 'diagnostico' then 0.20 when 'demo' then 0.35
    when 'piloto' then 0.50 when 'proposta' then 0.60 when 'negociacao' then 0.80
    when 'ganha' then 1 else 0 end as probabilidade,
  extract(day from now() - o.etapa_desde)::int as dias_na_etapa
from oportunidades o
join contas c on c.id = o.conta_id
left join perfis p on p.id = o.dono;

-- ---------------------------------------------------------------------------
-- Qualificar um lead: cria (ou reaproveita) conta, contato e oportunidade numa transação
-- ---------------------------------------------------------------------------
create or replace function qualificar_lead(p_lead uuid, p_plano plano_lumi default 'premium') returns uuid
language plpgsql security definer set search_path = public as $$
declare
  l leads%rowtype;
  v_conta uuid;
  v_contato uuid;
  v_op uuid;
begin
  if not eh_do_time() then raise exception 'sem permissão'; end if;
  select * into l from leads where id = p_lead for update;
  if not found then raise exception 'lead não encontrado'; end if;
  if l.oportunidade_id is not null then return l.oportunidade_id; end if;

  if l.cnpj is not null then select id into v_conta from contas where cnpj = l.cnpj; end if;
  if v_conta is null then
    insert into contas (cnpj, nome, razao_social, colaboradores, cnae, setor, porte, cidade, uf, estagio, dono, origem)
    values (l.cnpj, coalesce(nullif(l.empresa, ''), l.enriquecimento ->> 'nome_fantasia', l.enriquecimento ->> 'razao_social', l.nome),
            l.enriquecimento ->> 'razao_social', l.colaboradores, l.enriquecimento ->> 'cnae', l.enriquecimento ->> 'setor',
            l.enriquecimento ->> 'porte', l.enriquecimento ->> 'municipio', l.enriquecimento ->> 'uf',
            'oportunidade', coalesce(l.dono, auth.uid()), l.origem)
    returning id into v_conta;
  else
    update contas set estagio = case when estagio = 'lead' then 'oportunidade'::estagio_conta else estagio end where id = v_conta;
  end if;

  if l.email is not null then select id into v_contato from contatos where lower(email) = lower(l.email); end if;
  if v_contato is null then
    insert into contatos (conta_id, nome, cargo, email, whatsapp, aceita_marketing, consentimento_em, papel)
    values (v_conta, l.nome, l.cargo, l.email, l.whatsapp, l.aceita_marketing, l.consentimento_em, 'outro')
    returning id into v_contato;
  end if;

  insert into oportunidades (conta_id, titulo, plano, vidas, dono)
  values (v_conta, 'Lumi · ' || coalesce(nullif(l.empresa, ''), l.nome), p_plano, l.colaboradores, coalesce(l.dono, auth.uid()))
  returning id into v_op;

  update leads set status = 'qualificado', conta_id = v_conta, contato_id = v_contato, oportunidade_id = v_op,
    primeiro_contato_em = coalesce(primeiro_contato_em, now())
  where id = p_lead;
  update atividades set conta_id = v_conta, oportunidade_id = v_op where lead_id = p_lead;
  update eventos set conta_id = v_conta where lead_id = p_lead;
  insert into atividades (tipo, titulo, conta_id, lead_id, oportunidade_id, autor)
  values ('sistema', 'Lead qualificado e oportunidade criada', v_conta, p_lead, v_op, auth.uid());
  return v_op;
end $$;

-- ---------------------------------------------------------------------------
-- Segurança por linha: só o time ativo lê e escreve. Captura pública passa pelo servidor (service role).
-- ---------------------------------------------------------------------------
alter table perfis enable row level security;
alter table contas enable row level security;
alter table contatos enable row level security;
alter table leads enable row level security;
alter table oportunidades enable row level security;
alter table propostas enable row level security;
alter table atividades enable row level security;
alter table eventos enable row level security;
alter table modelos_email enable row level security;
alter table emails enable row level security;
alter table auditoria enable row level security;

create policy perfis_leitura on perfis for select to authenticated using (eh_do_time());
create policy perfis_proprio on perfis for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy time_tudo on contas for all to authenticated using (eh_do_time()) with check (eh_do_time());
create policy time_tudo on contatos for all to authenticated using (eh_do_time()) with check (eh_do_time());
create policy time_tudo on leads for all to authenticated using (eh_do_time()) with check (eh_do_time());
create policy time_tudo on oportunidades for all to authenticated using (eh_do_time()) with check (eh_do_time());
create policy time_tudo on propostas for all to authenticated using (eh_do_time()) with check (eh_do_time());
create policy time_tudo on atividades for all to authenticated using (eh_do_time()) with check (eh_do_time());
create policy time_tudo on eventos for all to authenticated using (eh_do_time()) with check (eh_do_time());
create policy time_tudo on modelos_email for all to authenticated using (eh_do_time()) with check (eh_do_time());
create policy time_leitura on emails for select to authenticated using (eh_do_time());
create policy time_leitura on auditoria for select to authenticated using (eh_do_time());

-- impedir que alguém se dê permissão de aprovar desconto ou mude o próprio papel
create or replace function perfis_protege() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and (new.papel is distinct from old.papel or new.aprova_desconto is distinct from old.aprova_desconto
     or new.ativo is distinct from old.ativo or new.email is distinct from old.email) then
    raise exception 'Papel, permissões e e-mail são alterados só pela administração';
  end if;
  return new;
end $$;
create trigger perfis_protecao before update on perfis for each row execute function perfis_protege();

grant execute on function qualificar_lead(uuid, plano_lumi) to authenticated;

-- ---------------------------------------------------------------------------
-- Modelos de e-mail iniciais
-- ---------------------------------------------------------------------------
insert into modelos_email (nome, categoria, assunto, corpo) values
('Primeiro contato', 'comercial', 'Lumi: sobre a NR-1 na {{empresa}}',
 'Olá, {{primeiro_nome}}!

Vi que você se interessou pelo Lumi. Desde maio de 2026 a NR-1 exige que as empresas gerenciem os riscos psicossociais no PGR, e o Lumi faz isso com diagnóstico, pesquisas de pulso e um painel com evidências prontas.

Você teria 30 minutos esta semana para eu entender o momento da {{empresa}} e mostrar como funciona?

Abraço,
{{remetente}}'),
('Após a demo', 'comercial', 'Resumo da nossa conversa sobre o Lumi',
 'Olá, {{primeiro_nome}}!

Obrigada pelo tempo hoje. Como combinamos, seguem os próximos passos:

- [próximo passo 1]
- [próximo passo 2]

Qualquer dúvida, é só responder este e-mail.

Abraço,
{{remetente}}'),
('Envio de proposta', 'comercial', 'Proposta Lumi para a {{empresa}}',
 'Olá, {{primeiro_nome}}!

Segue a proposta do Lumi para a {{empresa}}: {{link_proposta}}

Ela fica válida até {{validade}}. Se fizer sentido, você pode aceitar direto pelo link.

Abraço,
{{remetente}}');
