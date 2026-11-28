// Utilidades das funções de servidor (Vercel). Chaves só vêm de variáveis de ambiente.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { enderecoResposta } from '../shared/emailRecebido.js';

export const env = (k: string, obrigatoria = true): string => {
  const v = (process.env[k] ?? '').trim();
  if (!v && obrigatoria) throw new Error(`Variável de ambiente ausente: ${k}`);
  return v;
};

let _admin: SupabaseClient | null = null;
export const admin = (): SupabaseClient => {
  if (!_admin) {
    _admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
};

export interface Perfil { id: string; nome: string; email: string; papel: string; aprova_desconto: boolean; ativo: boolean }

/** Exige usuária logada e ativa no time. Responde 401/403 e devolve null quando não. */
export async function exigirTime(req: VercelRequest, res: VercelResponse): Promise<{ user: User; perfil: Perfil } | null> {
  const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ erro: 'Faça login' }); return null; }
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) { res.status(401).json({ erro: 'Sessão inválida' }); return null; }
  const { data: perfil } = await admin().from('perfis').select('*').eq('id', data.user.id).maybeSingle();
  if (!perfil || !perfil.ativo) { res.status(403).json({ erro: 'Sem acesso ao CRM' }); return null; }
  return { user: data.user, perfil: perfil as Perfil };
}

/** CORS para endpoints públicos chamados pelo site (applumi.io). */
export function cors(req: VercelRequest, res: VercelResponse): boolean {
  const permitidas = (process.env.ORIGENS_PERMITIDAS ?? 'https://applumi.io,https://www.applumi.io').split(',').map((s) => s.trim());
  const origem = String(req.headers.origin ?? '');
  if (permitidas.includes(origem)) {
    res.setHeader('Access-Control-Allow-Origin', origem);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

export const texto = (v: unknown, max = 500): string | null => {
  if (v == null) return null;
  const s = String(v).trim().slice(0, max);
  return s || null;
};
export const soDigitos = (v: unknown): string => String(v ?? '').replace(/\D/g, '');
export const emailValido = (v: string | null): v is string => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Lê o corpo cru (para verificar assinaturas de webhook). */
export async function corpoCru(req: VercelRequest): Promise<string> {
  const partes: Buffer[] = [];
  for await (const p of req) partes.push(typeof p === 'string' ? Buffer.from(p) : p);
  return Buffer.concat(partes).toString('utf8');
}

/** Consulta pública de CNPJ (BrasilAPI). Devolve só dados cadastrais da empresa. */
// A BrasilAPI recusa (403) chamadas que se identificam como "node", o padrão do fetch no servidor.
const IDENTIFICACAO = { 'User-Agent': 'LumiCRM/1.0 (+https://crm.applumi.io)', Accept: 'application/json' };

async function buscarJson(url: string, ms = 7000): Promise<Record<string, unknown> | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: IDENTIFICACAO });
    if (!r.ok) { console.warn('cnpj:', url.split('/')[2], r.status); return null; }
    return (await r.json()) as Record<string, unknown>;
  } catch (e) {
    console.warn('cnpj:', url.split('/')[2], (e as Error).message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Dados públicos do CNPJ: BrasilAPI e, se ela falhar, CNPJ.ws. */
export async function consultarCnpj(cnpj: string): Promise<Record<string, unknown> | null> {
  const b = await buscarJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
  if (b) {
    return {
      razao_social: b.razao_social ?? null,
      nome_fantasia: b.nome_fantasia || null,
      cnae: b.cnae_fiscal != null ? String(b.cnae_fiscal) : null,
      setor: b.cnae_fiscal_descricao ?? null,
      porte: b.porte ?? b.descricao_porte ?? null,
      municipio: b.municipio ?? null,
      uf: b.uf ?? null,
      situacao: b.descricao_situacao_cadastral ?? null,
    };
  }
  const w = await buscarJson(`https://publica.cnpj.ws/cnpj/${cnpj}`);
  if (!w) return null;
  const est = (w.estabelecimento ?? {}) as Record<string, unknown>;
  const ativ = (est.atividade_principal ?? {}) as Record<string, unknown>;
  const nome = (o: unknown, campo: string) => (o && typeof o === 'object' ? ((o as Record<string, unknown>)[campo] as string) ?? null : null);
  return {
    razao_social: w.razao_social ?? null,
    nome_fantasia: est.nome_fantasia || null,
    cnae: ativ.id != null ? String(ativ.id) : null,
    setor: ativ.descricao ?? null,
    porte: nome(w.porte, 'descricao'),
    municipio: nome(est.cidade, 'nome'),
    uf: nome(est.estado, 'sigla'),
    situacao: est.situacao_cadastral ?? null,
  };
}

/** Envia e-mail pelo Resend. Devolve o id do envio. */
export async function enviarEmail(m: {
  para: string[]; assunto: string; html: string; texto: string; responderPara?: string; de?: string;
  cabecalhos?: Record<string, string>; anexos?: { filename: string; path: string }[];
}) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: m.de || env('EMAIL_REMETENTE', false) || 'Lumi <comercial@applumi.io>',
      to: m.para, subject: m.assunto, html: m.html, text: m.texto,
      ...(m.responderPara ? { reply_to: m.responderPara } : {}),
      ...(m.cabecalhos && Object.keys(m.cabecalhos).length ? { headers: m.cabecalhos } : {}),
      ...(m.anexos?.length ? { attachments: m.anexos } : {}),
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!r.ok || !j.id) throw new Error(`Resend ${r.status}: ${j.message ?? 'falha no envio'}`);
  return j.id;
}

/** Lê da API do Resend (ex.: e-mail recebido e seus anexos). Devolve null quando falha. */
export async function lerResend<T = Record<string, unknown>>(caminho: string): Promise<T | null> {
  // ler e-mail recebido exige chave com acesso total; a de envio (RESEND_API_KEY) costuma ser só de envio
  const chave = env('RESEND_API_KEY_LEITURA', false) || env('RESEND_API_KEY');
  const r = await fetch(`https://api.resend.com${caminho}`, { headers: { Authorization: `Bearer ${chave}` } });
  if (!r.ok) { console.warn('resend:', caminho.split('/').slice(0, 3).join('/'), r.status); return null; }
  return (await r.json().catch(() => null)) as T | null;
}

/** Para onde vão as respostas de quem envia: o endereço do CRM (se o domínio de respostas estiver configurado). */
export const responderPara = (emailPessoa: string) => enderecoResposta(emailPessoa, env('EMAIL_RESPOSTAS_DOMINIO', false));

/** Envia até 100 e-mails numa chamada (API de lote do Resend). Devolve os ids na mesma ordem. */
export async function enviarLote(msgs: { para: string; assunto: string; html: string; texto: string; de: string; responderPara?: string; cabecalhos?: Record<string, string> }[]): Promise<string[]> {
  for (let tentativa = 0; ; tentativa++) {
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(msgs.map((m) => ({
        from: m.de, to: [m.para], subject: m.assunto, html: m.html, text: m.texto,
        ...(m.responderPara ? { reply_to: m.responderPara } : {}), ...(m.cabecalhos ? { headers: m.cabecalhos } : {}),
      }))),
    });
    if (r.status === 429 && tentativa < 3) { await new Promise((s) => setTimeout(s, 1200 * (tentativa + 1))); continue; }
    const j = (await r.json().catch(() => ({}))) as { data?: { id: string }[]; message?: string };
    if (!r.ok || !Array.isArray(j.data) || j.data.length !== msgs.length) throw new Error(`Resend ${r.status}: ${j.message ?? 'falha no envio em lote'}`);
    return j.data.map((d) => d.id);
  }
}

/** Link de descadastro de um lead, assinado (não dá para descadastrar outra pessoa trocando o id). */
const chaveDescadastro = () => createHash('sha256').update('lumi-crm-descadastro:' + env('SUPABASE_SERVICE_ROLE_KEY')).digest();
export const assinarLead = (leadId: string) => createHmac('sha256', chaveDescadastro()).update(leadId).digest('base64url').slice(0, 24);
export function assinaturaLeadValida(leadId: string, t: string): boolean {
  const a = Buffer.from(assinarLead(leadId)), b = Buffer.from(String(t));
  return a.length === b.length && timingSafeEqual(a, b);
}
export const linkDescadastro = (leadId: string) =>
  `${(env('CRM_URL', false) || 'https://crm.applumi.io').replace(/\/$/, '')}/api/descadastro?l=${leadId}&t=${assinarLead(leadId)}`;

/** Converte o texto simples de um e-mail comercial em HTML limpo (parágrafos e listas). */
export function textoParaHtml(t: string): string {
  const blocos = t.trim().split(/\n{2,}/).map((b) => {
    const linhas = b.split('\n');
    if (linhas.every((l) => /^\s*-\s+/.test(l))) {
      return `<ul style="margin:0 0 16px;padding-left:20px">${linhas.map((l) => `<li>${linkar(esc(l.replace(/^\s*-\s+/, '')))}</li>`).join('')}</ul>`;
    }
    return `<p style="margin:0 0 16px">${linhas.map((l) => linkar(esc(l))).join('<br>')}</p>`;
  });
  return `<div style="font:15px/1.6 Arial,Helvetica,sans-serif;color:#0B1B3F;max-width:600px">${blocos.join('')}</div>`;
}
const linkar = (s: string) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1E4FB8">$1</a>');
