// Utilidades das funções de servidor (Vercel). Chaves só vêm de variáveis de ambiente.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

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
export async function consultarCnpj(cnpj: string): Promise<Record<string, unknown> | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: ctl.signal });
    if (!r.ok) return null;
    const j = (await r.json()) as Record<string, unknown>;
    return {
      razao_social: j.razao_social ?? null,
      nome_fantasia: j.nome_fantasia || null,
      cnae: j.cnae_fiscal != null ? String(j.cnae_fiscal) : null,
      setor: j.cnae_fiscal_descricao ?? null,
      porte: j.porte ?? j.descricao_porte ?? null,
      municipio: j.municipio ?? null,
      uf: j.uf ?? null,
      situacao: j.descricao_situacao_cadastral ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Envia e-mail pelo Resend. Devolve o id do envio. */
export async function enviarEmail(m: { para: string[]; assunto: string; html: string; texto: string; responderPara?: string; de?: string }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: m.de || env('EMAIL_REMETENTE', false) || 'Lumi <comercial@applumi.io>',
      to: m.para, subject: m.assunto, html: m.html, text: m.texto,
      ...(m.responderPara ? { reply_to: m.responderPara } : {}),
    }),
  });
  const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!r.ok || !j.id) throw new Error(`Resend ${r.status}: ${j.message ?? 'falha no envio'}`);
  return j.id;
}

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
