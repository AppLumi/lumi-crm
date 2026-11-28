// O webhook de respostas com um banco falso (só registra o que foi gravado) e a API do Resend simulada.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { receber } from '../api/webhooks/resend.js';

const BRUNA = { id: 'p-bruna', nome: 'Bruna Salazar', email: 'bruna@applumi.io', ativo: true };
type Linha = Record<string, unknown>;

function bancoFalso(dados: Record<string, Linha[]>) {
  const gravado: { tabela: string; op: string; valor: unknown }[] = [];
  const from = (tabela: string) => {
    let op = 'select'; let valor: unknown = null;
    const filtros: ((l: Linha) => boolean)[] = [];
    const q: Record<string, unknown> = {};
    const resultado = () => {
      if (op === 'insert') {
        const linhas = (Array.isArray(valor) ? valor : [valor]).map((v, i) => ({ id: `${tabela}-${(dados[tabela]?.length ?? 0) + i + 1}`, ...(v as Linha) }));
        (dados[tabela] ??= []).push(...linhas);
        gravado.push({ tabela, op, valor: linhas.length === 1 ? linhas[0] : linhas });
        return { data: linhas.length === 1 ? linhas[0] : linhas, error: null };
      }
      if (op === 'update') { gravado.push({ tabela, op, valor }); return { data: null, error: null }; }
      return { data: (dados[tabela] ?? []).filter((l) => filtros.every((f) => f(l))), error: null };
    };
    const cadeia = ['select', 'order', 'limit', 'gte', 'not'];
    for (const m of cadeia) q[m] = () => q;
    q.insert = (v: unknown) => { op = 'insert'; valor = v; return q; };
    q.update = (v: unknown) => { op = 'update'; valor = v; return q; };
    q.eq = (c: string, v: unknown) => { filtros.push((l) => l[c] === v); return q; };
    q.is = () => q;
    q.in = (c: string, v: unknown[]) => { filtros.push((l) => v.includes(l[c])); return q; };
    q.ilike = (c: string, v: string) => { const t = v.replace(/%/g, '').toLowerCase(); filtros.push((l) => String(l[c] ?? '').toLowerCase().includes(t)); return q; };
    q.maybeSingle = async () => { const r = resultado(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: null }; };
    q.single = async () => { const r = resultado(); return { data: Array.isArray(r.data) ? r.data[0] : r.data, error: null }; };
    q.then = (ok: (r: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve(resultado()).then(ok, erro);
    return q;
  };
  return { db: { from } as unknown as SupabaseClient, gravado };
}

let enviados: Linha[] = [];
function resendFalso(recebido: Linha) {
  enviados = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === 'POST') { enviados.push(JSON.parse(init.body!)); return new Response(JSON.stringify({ id: 'env_1' })); }
    if (url.endsWith('/attachments')) return new Response(JSON.stringify({ data: [{ filename: 'contrato.pdf', size: 1000, download_url: 'https://exemplo.invalid/a' }] }));
    return new Response(JSON.stringify(recebido));
  }));
}

beforeEach(() => {
  process.env.RESEND_API_KEY = 're_teste';
  process.env.EMAIL_RESPOSTAS_DOMINIO = 'respostas.applumi.io';
});
afterEach(() => vi.unstubAllGlobals());

describe('resposta recebida', () => {
  it('liga ao lead pela conversa, cria tarefa pra quem enviou e avisa com o anexo', async () => {
    const { db, gravado } = bancoFalso({
      perfis: [BRUNA],
      emails: [{ id: 'e1', autor: BRUNA.id, lead_id: 'l1', conta_id: 'c1', message_id: '<m1@resend>', para: 'ana@exemplo.invalid' }],
      leads: [{ id: 'l1', email: 'ana@exemplo.invalid', status: 'novo' }],
    });
    resendFalso({
      from: 'ana@exemplo.invalid', to: ['bruna@respostas.applumi.io'], subject: 'Re: Proposta Lumi',
      text: 'Pode ser quinta.\n\nEm seg., 2 de dez. de 2026, Bruna <bruna@respostas.applumi.io> escreveu:\n> Oi', message_id: '<r1@ex>',
      headers: { From: 'Ana Lima <ana@exemplo.invalid>', 'In-Reply-To': '<m1@resend>' },
      attachments: [{ id: 'a1', filename: 'contrato.pdf', content_type: 'application/pdf', size: 1000 }],
    });
    const r = await receber(db, { email_id: 'rcv_1' });
    expect(r).toMatchObject({ ok: true });
    const reg = gravado.find((g) => g.tabela === 'emails_recebidos' && g.op === 'insert')!.valor as Linha;
    expect(reg).toMatchObject({ de: 'ana@exemplo.invalid', de_nome: 'Ana Lima', resposta: 'Pode ser quinta.', em_resposta_a: 'e1', lead_id: 'l1', responsavel: BRUNA.id, automatico: false });
    const ativ = gravado.filter((g) => g.tabela === 'atividades' && g.op === 'insert').map((g) => g.valor as Linha);
    expect(ativ.map((a) => a.tipo)).toEqual(['email', 'tarefa']);
    expect(ativ[1]).toMatchObject({ responsavel: BRUNA.id, lead_id: 'l1', titulo: 'Responder e-mail de Ana Lima' });
    expect(gravado.some((g) => g.tabela === 'eventos' && (g.valor as Linha).nome === 'email_respondido')).toBe(true);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ to: ['bruna@applumi.io'], attachments: [{ filename: 'contrato.pdf' }] });
  });

  it('resposta automática vai pra linha do tempo, sem tarefa e sem aviso', async () => {
    const { db, gravado } = bancoFalso({ perfis: [BRUNA], emails: [{ id: 'e1', autor: BRUNA.id, lead_id: 'l1', message_id: '<m1@resend>', para: 'ana@exemplo.invalid' }] });
    resendFalso({ from: 'ana@exemplo.invalid', to: ['bruna@respostas.applumi.io'], subject: 'Resposta automática: Proposta', text: 'Estou fora até dia 10.', headers: { 'In-Reply-To': '<m1@resend>' } });
    await receber(db, { email_id: 'rcv_2' });
    const ativ = gravado.filter((g) => g.tabela === 'atividades' && g.op === 'insert').map((g) => g.valor as Linha);
    expect(ativ.map((a) => a.tipo)).toEqual(['email']);
    expect(String(ativ[0].titulo)).toMatch(/^Resposta automática/);
    expect(enviados).toHaveLength(0);
  });

  it('sem conversa, acha pelo último e-mail enviado ao endereço', async () => {
    const { db, gravado } = bancoFalso({ perfis: [BRUNA], emails: [{ id: 'e9', autor: BRUNA.id, conta_id: 'c9', para: 'joao@exemplo.invalid, ana@exemplo.invalid', enviado_em: 'x' }] });
    resendFalso({ from: 'ana@exemplo.invalid', to: ['bruna@respostas.applumi.io'], subject: 'Re: oi', text: 'Oi!' });
    await receber(db, { email_id: 'rcv_3' });
    const reg = gravado.find((g) => g.tabela === 'emails_recebidos')!.valor as Linha;
    expect(reg).toMatchObject({ em_resposta_a: 'e9', conta_id: 'c9', responsavel: BRUNA.id });
  });

  it('desconhecido escrevendo direto pro endereço da Bruna: guarda e avisa, sem tarefa', async () => {
    const { db, gravado } = bancoFalso({ perfis: [BRUNA] });
    resendFalso({ from: 'novo@exemplo.invalid', to: ['bruna@respostas.applumi.io'], subject: 'Contato', text: 'Olá' });
    const r = await receber(db, { email_id: 'rcv_4' });
    expect(r).toMatchObject({ vinculado: false });
    expect(gravado.filter((g) => g.tabela === 'atividades')).toHaveLength(0);
    expect(enviados).toHaveLength(1);
  });

  it('o mesmo e-mail duas vezes não duplica', async () => {
    const { db, gravado } = bancoFalso({ perfis: [BRUNA], emails_recebidos: [{ id: 'x', resend_id: 'rcv_5' }] });
    resendFalso({});
    expect(await receber(db, { email_id: 'rcv_5' })).toMatchObject({ repetido: true });
    expect(gravado).toHaveLength(0);
  });
});
