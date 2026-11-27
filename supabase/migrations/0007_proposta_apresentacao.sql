-- Proposta do Lumi com apresentação e serviços adicionais (workshop NR-1).
-- slides: chaves dos slides escolhidos (null = proposta antiga, sem apresentação)
-- servicos: itens adicionais [{chave, nome, unidade, quantidade, valor_unitario, valor_total, detalhe}]
alter table propostas add column if not exists slides text[];
alter table propostas add column if not exists servicos jsonb not null default '[]'::jsonb;
alter table propostas add column if not exists servicos_total numeric(12,2) not null default 0;

do $$ begin
  alter table propostas add constraint propostas_servicos_lista check (jsonb_typeof(servicos) = 'array');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table propostas add constraint propostas_servicos_total_positivo check (servicos_total >= 0);
exception when duplicate_object then null; end $$;
