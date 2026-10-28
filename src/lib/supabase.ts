import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configurado = Boolean(url && chave);

export const supabase = createClient(url || 'https://configure.supabase.co', chave || 'configure', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Chama uma função de servidor do CRM levando o token da sessão. */
export async function api<T = unknown>(caminho: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(`/api/${caminho}`, {
    method: opcoes.metodo ?? (opcoes.corpo ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  });
  const j = (await r.json().catch(() => ({}))) as T & { erro?: string };
  if (!r.ok) throw new Error(j.erro ?? `Erro ${r.status}`);
  return j;
}

/** Lança o erro do Supabase com mensagem legível. */
export function ok<T>(resp: { data: T; error: { message: string } | null }): T {
  if (resp.error) throw new Error(resp.error.message);
  return resp.data;
}
