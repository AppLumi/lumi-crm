-- 0005 · Empresas em prospecção (ainda não são leads)
-- Contas importadas para prospecção fria (ex.: clientes da Grou) ficam no estágio "Prospecção":
-- não converteram nem pediram contato. Ao entrar num funil, viram "Em negociação" como os leads.
-- Rode no SQL Editor do Supabase (projeto do CRM), sozinha, antes das listas. Pode rodar mais de uma vez.
alter type estagio_conta add value if not exists 'prospeccao' before 'lead';
