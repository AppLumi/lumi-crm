import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { nomeEtapa } from '../lib/formato';
import type { Etapa } from '../lib/tipos';
import Icone, { type NomeIcone } from './Icone';

interface Resultado { id: string; grupo: string; titulo: string; sub?: string; icone: NomeIcone; ir: string }

const sem = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Busca global (⌘K / Ctrl K): páginas, ações e registros do CRM num só lugar. */
export default function Comando({ aberto, fechar, atalhos }: {
  aberto: boolean; fechar: () => void; atalhos: { nome: string; para: string; icone: NomeIcone }[];
}) {
  const ir = useNavigate();
  const [q, setQ] = useState('');
  const [registros, setRegistros] = useState<Resultado[]>([]);
  const [sel, setSel] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const rodada = useRef(0);

  useEffect(() => {
    if (!aberto) return;
    setQ(''); setRegistros([]); setSel(0);
    window.setTimeout(() => entrada.current?.focus(), 10);
  }, [aberto]);

  // registros do banco, com pequena espera enquanto a pessoa digita
  useEffect(() => {
    const termo = q.replace(/[%*,()\\"]/g, ' ').trim();
    if (termo.length < 2) { setRegistros([]); setBuscando(false); return; }
    const minha = ++rodada.current;
    setBuscando(true);
    const t = window.setTimeout(async () => {
      const digitos = termo.replace(/\D/g, '');
      const [l, c, o] = await Promise.all([
        supabase.from('leads').select('id, nome, empresa').or(`nome.ilike.*${termo}*,empresa.ilike.*${termo}*,email.ilike.*${termo}*`).order('criado_em', { ascending: false }).limit(5),
        supabase.from('contas').select('id, nome, cidade, uf').or(`nome.ilike.*${termo}*,razao_social.ilike.*${termo}*${digitos.length >= 4 ? `,cnpj.ilike.*${digitos}*` : ''}`).limit(5),
        supabase.from('v_oportunidades').select('id, conta_nome, etapa').ilike('conta_nome', `%${termo}%`).limit(5),
      ]);
      if (minha !== rodada.current) return;
      setRegistros([
        ...((o.data ?? []) as { id: string; conta_nome: string; etapa: Etapa }[]).map((x) => ({ id: x.id, grupo: 'Oportunidades', titulo: x.conta_nome, sub: nomeEtapa(x.etapa), icone: 'funil' as const, ir: `/oportunidades/${x.id}` })),
        ...((l.data ?? []) as { id: string; nome: string; empresa: string | null }[]).map((x) => ({ id: x.id, grupo: 'Leads', titulo: x.nome, sub: x.empresa ?? undefined, icone: 'leads' as const, ir: `/leads/${x.id}` })),
        ...((c.data ?? []) as { id: string; nome: string; cidade: string | null; uf: string | null }[]).map((x) => ({ id: x.id, grupo: 'Contas', titulo: x.nome, sub: x.cidade ? `${x.cidade}/${x.uf}` : undefined, icone: 'contas' as const, ir: `/contas/${x.id}` })),
      ]);
      setBuscando(false);
    }, 180);
    return () => window.clearTimeout(t);
  }, [q]);

  const fixos = useMemo<Resultado[]>(() => {
    const acoes: Resultado[] = [{ id: 'novo-lead', grupo: 'Ações', titulo: 'Novo lead', icone: 'mais', ir: '/leads?novo=1' }];
    const paginas = atalhos.map((a) => ({ id: a.para, grupo: 'Ir para', titulo: a.nome, icone: a.icone, ir: a.para }));
    const t = sem(q.trim());
    return [...acoes, ...paginas].filter((r) => !t || sem(r.titulo).includes(t));
  }, [atalhos, q]);

  const todos = useMemo(() => [...registros, ...fixos], [registros, fixos]);
  useEffect(() => { setSel(0); }, [todos.length]);
  useEffect(() => {
    lista.current?.querySelector('[data-sel="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!aberto) return null;

  const abrir = (r: Resultado) => { fechar(); ir(r.ir); };
  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(todos.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter' && todos[sel]) { e.preventDefault(); abrir(todos[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); fechar(); }
  };

  let grupoAnterior = '';
  return (
    <div className="fundo-comando" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className="comando" role="dialog" aria-modal="true" aria-label="Buscar no CRM">
        <div className="comando-busca">
          <Icone nome="busca" />
          <input ref={entrada} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={teclas}
            placeholder="Buscar leads, empresas, oportunidades ou ir para…" aria-label="Buscar" />
          {buscando ? <span className="girando" aria-label="Buscando" /> : <kbd>esc</kbd>}
        </div>
        <div className="comando-lista" ref={lista} role="listbox">
          {todos.length === 0 && <div className="vazio">Nada encontrado para “{q}”.</div>}
          {todos.map((r, i) => {
            const titulo = r.grupo !== grupoAnterior ? r.grupo : null;
            grupoAnterior = r.grupo;
            return (
              <div key={`${r.grupo}-${r.id}`}>
                {titulo && <div className="comando-grupo">{titulo}</div>}
                <button className="comando-item" data-sel={i === sel} role="option" aria-selected={i === sel}
                  onMouseMove={() => setSel(i)} onClick={() => abrir(r)}>
                  <span className="bolha"><Icone nome={r.icone} tamanho={17} /></span>
                  <span className="textos"><strong>{r.titulo}</strong>{r.sub && <small>{r.sub}</small>}</span>
                  <span className="enter"><Icone nome="seta" tamanho={15} /></span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="comando-rodape"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>esc</kbd> fechar</span></div>
      </div>
    </div>
  );
}
