import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { ETAPAS, brl, primeiroNome } from '../lib/formato';
import type { Etapa, Oportunidade } from '../lib/tipos';
import { Carregando, Kpi } from '../components/ui';
import MudarEtapa, { moverEtapa, pendencias } from '../components/MudarEtapa';

export default function Funil() {
  const ir = useNavigate();
  const { time } = useSessao();
  const { executar } = useAcao();
  const [ops, setOps] = useState<Oportunidade[] | null>(null);
  const [dono, setDono] = useState('');
  const [verFechadas, setVerFechadas] = useState(false);
  const [sobre, setSobre] = useState<Etapa | null>(null);
  const [mover, setMover] = useState<{ op: Oportunidade; destino: Etapa } | null>(null);

  const carregar = useCallback(async () => {
    const desde = new Date(Date.now() - 90 * 864e5).toISOString();
    const r = await supabase.from('v_oportunidades').select('*').or(`etapa.not.in.(ganha,perdida),fechada_em.gte."${desde}"`).order('etapa_desde');
    setOps((r.data ?? []) as Oportunidade[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const lista = useMemo(() => (ops ?? []).filter((o) => !dono || o.dono === dono), [ops, dono]);
  const abertas = lista.filter((o) => o.etapa !== 'ganha' && o.etapa !== 'perdida');
  const colunas = ETAPAS.filter((e) => verFechadas || (e.id !== 'ganha' && e.id !== 'perdida'));

  const soltar = (destino: Etapa, id: string) => {
    setSobre(null);
    const op = ops?.find((o) => o.id === id);
    if (!op || op.etapa === destino) return;
    if (pendencias(op, destino).length) setMover({ op, destino });
    else executar(async () => { await moverEtapa(op, destino); await carregar(); });
  };

  if (!ops) return <Carregando />;

  return (
    <>
      <div className="topo">
        <div><h1>Funil</h1><p>Arraste as oportunidades entre as etapas. Fichas com borda amarela passaram do prazo da etapa.</p></div>
        <div className="filtros" style={{ margin: 0 }}>
          <select value={dono} onChange={(e) => setDono(e.target.value)}>
            <option value="">Todo o time</option>
            {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={verFechadas} onChange={(e) => setVerFechadas(e.target.checked)} /> Ganhas e perdidas (90 dias)
          </label>
        </div>
      </div>

      <div className="grade g3" style={{ marginBottom: 16 }}>
        <Kpi rotulo="Abertas" valor={abertas.length} />
        <Kpi rotulo="Pipeline (1º ano)" valor={brl(abertas.reduce((s, o) => s + Number(o.valor_primeiro_ano ?? 0), 0))} />
        <Kpi rotulo="Ponderado" valor={brl(abertas.reduce((s, o) => s + Number(o.valor_primeiro_ano ?? 0) * Number(o.probabilidade), 0))} />
      </div>

      <div className="quadro">
        {colunas.map((e) => {
          const fichas = lista.filter((o) => o.etapa === e.id);
          const total = fichas.reduce((s, o) => s + Number(o.valor_mensal ?? 0), 0);
          return (
            <section key={e.id} className={`coluna ${sobre === e.id ? 'sobre' : ''}`}
              onDragOver={(ev) => { ev.preventDefault(); setSobre(e.id); }}
              onDragLeave={() => setSobre((s) => (s === e.id ? null : s))}
              onDrop={(ev) => { ev.preventDefault(); soltar(e.id, ev.dataTransfer.getData('text/plain')); }}>
              <h3>{e.nome} <span>{fichas.length} · {brl(total)}/mês</span></h3>
              {fichas.map((o) => (
                <article key={o.id} className={`ficha ${e.prazo != null && o.dias_na_etapa > e.prazo ? 'parada' : ''}`} draggable
                  onDragStart={(ev) => ev.dataTransfer.setData('text/plain', o.id)} onClick={() => ir(`/oportunidades/${o.id}`)}>
                  <div className="conta">{o.conta_nome}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{o.plano === 'premium' ? 'Premium' : 'Starter'}{o.vidas ? ` · ${o.vidas.toLocaleString('pt-BR')} vidas` : ''}</div>
                  <div className="meta">
                    <span>{o.valor_mensal ? `${brl(Number(o.valor_mensal))}/mês` : 'sem valor'}</span>
                    <span>{primeiroNome(o.dono_nome) || '—'} · {o.dias_na_etapa}d</span>
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>

      <MudarEtapa op={mover?.op ?? null} destino={mover?.destino ?? null} fechar={() => setMover(null)} mudou={carregar} />
    </>
  );
}
