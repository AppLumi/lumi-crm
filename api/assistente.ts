// POST /api/assistente — assistente do time comercial dentro do CRM.
// Conversa sobre o Lumi (app, painel, admin, especialistas), NR-1, preços e venda; treina, faz roleplay de cliente
// e monta relatórios com os números do CRM, que podem ser guardados na tela Relatórios.
// O histórico fica no navegador; cada chamada manda a conversa (só texto) e o modo.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { admin, exigirTime, texto } from './_lib.js';
import { CONHECIMENTO } from './_conhecimento.js';

type Json = Record<string, unknown>;
const MODELO = 'claude-opus-5-5';
const MAX_VOLTAS = 6;

const BASE = `Você é o assistente do time comercial do Lumi, dentro do CRM do Lumi (crm.applumi.io). Quem fala com você é alguém do time (vendas, sócias, marketing). Responda em português do Brasil, direto e prático.

O que você faz:
- Tira dúvidas sobre o Lumi: o aplicativo do colaborador, o painel da empresa, o admin, os especialistas, preços, implantação, privacidade.
- Explica a NR-1 e os riscos psicossociais e ajuda a argumentar com clientes.
- Treina o time: explica, faz perguntas de fixação, corrige respostas, sugere como falar.
- Faz roleplay: interpreta um cliente para a pessoa praticar a venda.
- Monta relatórios com os números do CRM, usando as ferramentas, e guarda o relatório quando pedirem.

Regras:
- Use só o que está na base de conhecimento abaixo, nos dados das ferramentas e no que a pessoa disser. Se não souber, diga que não sabe e sugira onde conferir. Nunca invente números, clientes, depoimentos, funcionalidades ou prazos.
- Nunca prometa o que a base diz que o Lumi ainda não faz.
- A marca é masculina: sempre "o Lumi", "do Lumi", "no Lumi". A assistente de IA do aplicativo é "a Luz".
- Nada de promessa clínica: o Lumi não cura, não trata e não diagnostica doença.
- Sobre a NR-1 no STF e a fiscalização, diga a data em que a base conferiu a informação e recomende conferir se houver novidade depois dela.
- Dados do CRM: prefira números agregados; mostre nomes de empresas e pessoas só quando ajudarem a pergunta. Não exponha e-mails ou telefones sem necessidade.
- Você não envia e-mails nem mensagens. Pode escrever rascunhos para a pessoa enviar pelo CRM.
- Formato: Markdown simples (títulos curtos, listas, tabelas quando houver números). Respostas curtas por padrão; relatórios completos quando pedirem.

Base de conhecimento do Lumi:
`;

const MODOS: Record<string, string> = {
  conversa: 'Modo: conversa livre. Responda à pergunta da pessoa.',
  treino: 'Modo: treino. Ensine em pequenos blocos e, ao fim de cada bloco, faça uma pergunta de fixação. Quando a pessoa responder, diga o que acertou, o que faltou e a resposta modelo. Se ela não disser o tema, ofereça 4 temas (produto, NR-1, preços e proposta, objeções) e deixe ela escolher.',
  roleplay: 'Modo: roleplay. Você interpreta o cliente descrito abaixo, em primeira pessoa, com objeções realistas para o perfil e sem facilitar demais. Não saia do personagem nem dê dicas durante a simulação. Quando a pessoa escrever "fim" ou pedir feedback, saia do personagem e dê um feedback curto: nota de 0 a 10, o que funcionou, o que melhorar (com frases que ela poderia ter dito) e se a reunião seria marcada.',
  relatorio: 'Modo: relatório. Use as ferramentas para buscar os números do CRM antes de escrever. Monte um relatório em Markdown com título, período, principais números em tabela, leitura do que eles mostram e próximos passos. Ao terminar, pergunte se deve guardar em Relatórios; se a pessoa já pediu para guardar ou enviar para os relatórios, chame salvar_relatorio.',
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'resumo_crm',
    description: 'Números agregados do CRM num período: leads por status e origem, funil de vendas por etapa (quantidade e valor mensal), negócios ganhos e perdidos com motivos, propostas, e-mails, atividades por tipo e por pessoa, contatos por lista e origem, cards por funil e etapa, e os negócios abertos mais recentes. Use antes de responder qualquer pergunta sobre números ou de montar relatório.',
    input_schema: { type: 'object', properties: { dias: { type: 'integer', description: 'Período em dias, contando até hoje (1 a 365).' } }, required: ['dias'], additionalProperties: false },
    strict: true,
  },
  {
    name: 'buscar_crm',
    description: 'Procura no CRM por nome: empresas (estágio, porte, dono), negócios (etapa, valor, dono), contatos (cargo, empresa, lista) ou leads (status, origem). Até 10 resultados.',
    input_schema: {
      type: 'object',
      properties: { tipo: { type: 'string', enum: ['empresa', 'negocio', 'contato', 'lead'] }, termo: { type: 'string', description: 'Parte do nome a procurar.' } },
      required: ['tipo', 'termo'], additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'salvar_relatorio',
    description: 'Guarda um relatório na tela Relatórios do CRM, para o time consultar depois. Use só quando a pessoa pedir para guardar, salvar ou enviar para os relatórios.',
    input_schema: {
      type: 'object',
      properties: { titulo: { type: 'string', description: 'Título curto do relatório.' }, conteudo: { type: 'string', description: 'O relatório completo em Markdown.' } },
      required: ['titulo', 'conteudo'], additionalProperties: false,
    },
    strict: true,
  },
];

/** Busca todas as linhas (o Supabase devolve no máximo 1.000 por vez). */
async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>, limite = 50000): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; de < limite; de += 1000) {
    const { data, error } = await consulta(de, de + 999);
    if (error) throw new Error(error.message);
    const linhas = (data ?? []) as T[];
    out.push(...linhas);
    if (linhas.length < 1000) break;
  }
  return out;
}
const conta = <T>(linhas: T[], chave: (l: T) => string | null | undefined) =>
  linhas.reduce<Record<string, number>>((m, l) => { const k = chave(l) || '(vazio)'; m[k] = (m[k] ?? 0) + 1; return m; }, {});

async function resumoCrm(db: SupabaseClient, dias: number): Promise<Json> {
  const d = Math.min(365, Math.max(1, Math.round(dias)));
  const desde = new Date(Date.now() - d * 864e5).toISOString();
  const [perfis, leads, ops, propostas, emails, atividades, contatos, cards] = await Promise.all([
    db.from('perfis').select('id, nome').then((r) => (r.data ?? []) as { id: string; nome: string }[]),
    todas<{ status: string; origem: string | null }>((a, b) => db.from('leads').select('status, origem').gte('criado_em', desde).range(a, b)),
    todas<{ titulo: string; etapa: string; valor_mensal: number | null; vidas: number | null; dono: string | null; motivo_perda: string | null; fechada_em: string | null; etapa_desde: string; criado_em: string }>(
      (a, b) => db.from('oportunidades').select('titulo, etapa, valor_mensal, vidas, dono, motivo_perda, fechada_em, etapa_desde, criado_em').order('criado_em', { ascending: false }).range(a, b)),
    todas<{ status: string; mensal: number | null }>((a, b) => db.from('propostas').select('status, mensal').gte('criado_em', desde).range(a, b)),
    todas<{ status: string; aberto_em: string | null }>((a, b) => db.from('emails').select('status, aberto_em').gte('criado_em', desde).range(a, b)),
    todas<{ tipo: string; autor: string | null; titulo: string }>((a, b) => db.from('atividades').select('tipo, autor, titulo').gte('criado_em', desde).range(a, b)),
    todas<{ origem: string | null; evento: string | null }>((a, b) => db.from('contatos').select('origem, evento').range(a, b)),
    todas<{ funil_id: string; etapa_nome: string | null }>((a, b) => db.from('v_funil_cards').select('funil_id, etapa_nome').is('fechado_em', null).range(a, b)).catch(() => []),
  ]);
  const funis = cards.length ? ((await db.from('funis').select('id, nome')).data ?? []) as { id: string; nome: string }[] : [];
  const nome = (id: string | null) => perfis.find((p) => p.id === id)?.nome ?? 'sem dono';
  const abertos = ops.filter((o) => !['ganha', 'perdida'].includes(o.etapa));
  const porEtapa: Record<string, { negocios: number; valor_mensal: number }> = {};
  for (const o of abertos) { const e = (porEtapa[o.etapa] ??= { negocios: 0, valor_mensal: 0 }); e.negocios++; e.valor_mensal += Number(o.valor_mensal ?? 0); }
  const fechados = ops.filter((o) => o.fechada_em && o.fechada_em >= desde);
  const ganhos = fechados.filter((o) => o.etapa === 'ganha'), perdidos = fechados.filter((o) => o.etapa === 'perdida');
  return {
    periodo: { dias: d, desde: desde.slice(0, 10), ate: new Date().toISOString().slice(0, 10) },
    leads_no_periodo: { total: leads.length, por_status: conta(leads, (l) => l.status), por_origem: conta(leads, (l) => l.origem) },
    funil_de_vendas_aberto: { total: abertos.length, por_etapa: porEtapa, valor_mensal_total: abertos.reduce((s, o) => s + Number(o.valor_mensal ?? 0), 0) },
    fechados_no_periodo: {
      ganhos: ganhos.length, valor_mensal_ganho: ganhos.reduce((s, o) => s + Number(o.valor_mensal ?? 0), 0),
      perdidos: perdidos.length, motivos_de_perda: conta(perdidos, (o) => o.motivo_perda),
    },
    propostas_no_periodo: { total: propostas.length, por_status: conta(propostas, (p) => p.status) },
    emails_no_periodo: { total: emails.length, por_status: conta(emails, (e) => e.status), abertos: emails.filter((e) => e.aberto_em).length },
    atividades_no_periodo: {
      total: atividades.length, por_tipo: conta(atividades, (a) => a.tipo), por_pessoa: conta(atividades, (a) => nome(a.autor)),
      passos_de_cadencia: conta(atividades.filter((a) => a.titulo.startsWith('Cadência · ')), (a) => a.titulo.replace(/^Cadência · /, '').replace(/ \(dia \d+\).*$/, '')),
    },
    contatos: { total: contatos.length, por_lista: conta(contatos.filter((c) => c.evento), (c) => c.evento), por_origem: conta(contatos, (c) => c.origem) },
    cards_abertos_dos_funis: conta(cards, (c) => `${funis.find((f) => f.id === c.funil_id)?.nome ?? 'funil'} · ${c.etapa_nome ?? '?'}`),
    negocios_abertos_recentes: abertos.slice(0, 25).map((o) => ({
      titulo: o.titulo, etapa: o.etapa, vidas: o.vidas, valor_mensal: o.valor_mensal, dono: nome(o.dono),
      dias_na_etapa: Math.floor((Date.now() - Date.parse(o.etapa_desde)) / 864e5),
    })),
  };
}

const literal = (s: string) => s.replace(/[\\%_,()]/g, ' ').trim();

async function buscarCrm(db: SupabaseClient, tipo: string, termo: string): Promise<Json> {
  const t = literal(termo).slice(0, 80);
  if (t.length < 2) return { erro: 'Termo curto demais' };
  if (tipo === 'empresa') {
    const { data } = await db.from('contas').select('nome, estagio, porte, colaboradores, setor, cidade, uf, origem').ilike('nome', `%${t}%`).limit(10);
    return { empresas: data ?? [] };
  }
  if (tipo === 'negocio') {
    const { data } = await db.from('v_oportunidades').select('titulo, etapa, plano, vidas, valor_mensal, previsao_fechamento, etapa_desde, dono_nome, conta_nome').ilike('titulo', `%${t}%`).limit(10);
    return { negocios: data ?? [] };
  }
  if (tipo === 'contato') {
    const { data } = await db.from('contatos').select('nome, cargo, papel, origem, evento, contas(nome)').ilike('nome', `%${t}%`).limit(10);
    return { contatos: data ?? [] };
  }
  const { data } = await db.from('leads').select('nome, empresa, cargo, status, origem, colaboradores, criado_em').or(`nome.ilike.%${t}%,empresa.ilike.%${t}%`).limit(10);
  return { leads: data ?? [] };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });
  const quem = await exigirTime(req, res);
  if (!quem) return;
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ erro: 'O assistente ainda não foi ligado: falta a chave ANTHROPIC_API_KEY nas variáveis da Vercel.' });

  const b = (req.body ?? {}) as Json;
  const modo = MODOS[String(b.modo ?? '')] ? String(b.modo) : 'conversa';
  const persona = texto(b.persona, 600);
  const historico = (Array.isArray(b.mensagens) ? b.mensagens : []).slice(-40)
    .map((m) => m as Json)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 20000) }));
  while (historico.length && historico[0].role !== 'user') historico.shift();
  if (!historico.length || historico[historico.length - 1].role !== 'user') return res.status(400).json({ erro: 'Mande uma mensagem' });

  const db = admin();
  const client = new Anthropic();
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
  // a base fica num bloco fixo (cacheado); o modo e a data vêm depois do ponto de cache
  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: BASE + CONHECIMENTO, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `${MODOS[modo]}${modo === 'roleplay' ? `\nCliente a interpretar: ${persona || 'gerente de RH de uma empresa de 300 pessoas, cliente da Grou (usa PDA), que ainda não fez o diagnóstico psicossocial da NR-1 e tem pouco orçamento.'}` : ''}\nHoje é ${hoje}. Quem está falando: ${quem.perfil.nome}.` },
  ];
  const messages: Anthropic.MessageParam[] = historico;
  let salvo: { id: string; titulo: string } | null = null;

  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const r = await client.beta.messages.create({
        model: MODELO,
        max_tokens: 16000,
        output_config: { effort: modo === 'relatorio' ? 'high' : 'medium' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system,
        tools: modo === 'roleplay' ? undefined : TOOLS,
        messages,
      });

      if (r.stop_reason === 'refusal') return res.status(200).json({ texto: 'Não consigo ajudar com esse pedido. Tente reformular.', relatorio: salvo });
      const usos = r.content.filter((c): c is Anthropic.Beta.BetaToolUseBlock => c.type === 'tool_use');
      if (r.stop_reason !== 'tool_use' || !usos.length) {
        const resposta = r.content.filter((c): c is Anthropic.Beta.BetaTextBlock => c.type === 'text').map((c) => c.text).join('\n\n').trim();
        return res.status(200).json({ texto: resposta || '(sem resposta)', relatorio: salvo, cortado: r.stop_reason === 'max_tokens' });
      }
      messages.push({ role: 'assistant', content: r.content as Anthropic.ContentBlockParam[] });
      const resultados: Anthropic.ToolResultBlockParam[] = [];
      for (const u of usos) {
        const inp = (u.input ?? {}) as Json;
        try {
          let saida: Json;
          if (u.name === 'resumo_crm') saida = await resumoCrm(db, Number(inp.dias) || 30);
          else if (u.name === 'buscar_crm') saida = await buscarCrm(db, String(inp.tipo ?? ''), String(inp.termo ?? ''));
          else if (u.name === 'salvar_relatorio') {
            const titulo = texto(inp.titulo, 200), conteudo = texto(inp.conteudo, 100000);
            if (!titulo || !conteudo) throw new Error('Relatório sem título ou conteúdo');
            const ultimo = historico.filter((m) => m.role === 'user').at(-1)?.content ?? null;
            const { data, error } = await db.from('relatorios_assistente').insert({ titulo, conteudo, pedido: ultimo?.slice(0, 2000) ?? null, criado_por: quem.perfil.id }).select('id').single();
            if (error) throw new Error(/relatorios_assistente/.test(error.message) ? 'Falta rodar a migração 0006 no Supabase do CRM' : error.message);
            salvo = { id: (data as { id: string }).id, titulo };
            saida = { ok: true, mensagem: 'Relatório guardado na tela Relatórios.' };
          } else throw new Error(`Ferramenta desconhecida: ${u.name}`);
          resultados.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(saida) });
        } catch (e) {
          resultados.push({ type: 'tool_result', tool_use_id: u.id, content: (e as Error).message, is_error: true });
        }
      }
      messages.push({ role: 'user', content: resultados });
    }
    return res.status(200).json({ texto: 'Precisei de passos demais para responder. Tente uma pergunta mais específica.', relatorio: salvo });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ erro: 'Muitas perguntas seguidas. Espere um minuto e tente de novo.' });
    if (e instanceof Anthropic.AuthenticationError) return res.status(503).json({ erro: 'A chave ANTHROPIC_API_KEY da Vercel não foi aceita.' });
    if (e instanceof Anthropic.APIError) { console.error('assistente:', e.status, e.message); return res.status(502).json({ erro: 'O assistente está indisponível agora. Tente de novo em instantes.' }); }
    console.error('assistente:', (e as Error).message);
    return res.status(500).json({ erro: 'Erro no assistente' });
  }
}
