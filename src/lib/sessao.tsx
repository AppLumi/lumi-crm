import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Perfil } from './tipos';

interface Ctx {
  sessao: Session | null;
  perfil: Perfil | null;
  time: Perfil[];
  carregando: boolean;
  aviso: (msg: string, erro?: boolean) => void;
  sair: () => Promise<void>;
}

const SessaoCtx = createContext<Ctx | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [time, setTime] = useState<Perfil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [toast, setToast] = useState<{ msg: string; erro: boolean } | null>(null);

  const carregarPerfil = useCallback(async (s: Session | null) => {
    if (!s) { setPerfil(null); setTime([]); setCarregando(false); return; }
    const { data } = await supabase.from('perfis').select('*').order('nome');
    const lista = (data ?? []) as Perfil[];
    setTime(lista.filter((p) => p.ativo));
    setPerfil(lista.find((p) => p.id === s.user.id) ?? null);
    setCarregando(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSessao(data.session); carregarPerfil(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setSessao(s); carregarPerfil(s); });
    return () => data.subscription.unsubscribe();
  }, [carregarPerfil]);

  const aviso = useCallback((msg: string, erro = false) => {
    setToast({ msg, erro });
    window.setTimeout(() => setToast(null), erro ? 6000 : 3500);
  }, []);

  const sair = useCallback(async () => { await supabase.auth.signOut(); }, []);

  return (
    <SessaoCtx.Provider value={{ sessao, perfil, time, carregando, aviso, sair }}>
      {children}
      {toast && <div className={`toast ${toast.erro ? 'erro' : ''}`} role="status">{toast.msg}</div>}
    </SessaoCtx.Provider>
  );
}

export function useSessao(): Ctx {
  const c = useContext(SessaoCtx);
  if (!c) throw new Error('useSessao fora do provider');
  return c;
}

/** Envolve uma ação assíncrona: mostra erro em aviso e devolve se deu certo. */
export function useAcao() {
  const { aviso } = useSessao();
  const [ocupado, setOcupado] = useState(false);
  const executar = useCallback(async (fn: () => Promise<unknown>, sucesso?: string) => {
    setOcupado(true);
    try {
      await fn();
      if (sucesso) aviso(sucesso);
      return true;
    } catch (e) {
      aviso((e as Error).message, true);
      return false;
    } finally {
      setOcupado(false);
    }
  }, [aviso]);
  return { ocupado, executar };
}
