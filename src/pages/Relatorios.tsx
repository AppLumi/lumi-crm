import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ETAPAS, MOTIVOS_PERDA, brl, horasUteis, nomeOrigem } from '../lib/formato';
import type { Lead, Oportunidade } from '../lib/tipos';
import { Barras, Carregando, Kpi } from '../components/ui';

const PERIODOS = [{ d: 30, nome: 'Últimos 30 dias' }, { d: 90, nome: 'Últimos 90 dias' }, { d: 365, nome: 'Últimos 12 meses' }];

const agrupar = <T,>(itens: T[], chave: (i: T) => string, valor: (i: T) => number = () => 1) => {
  const m = new Map<string, number>();
  for (const i of itens) m.set(chave(i), (m.get(chave(i)) ?? 0) + valor(i));
  return [...m.entries()].map(([rotulo, v]) => ({ rotulo, valor: v })).sort((a, b) => b.valor - a.valor);
};
const mediana = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export default function Relatorios() {
  const [dias, setDias] = useState(90);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [ops, setOps] = useState<Oportunidade[]>([]);

  useEffect(() => {
    const desde = new Date(Date.now() - dias * 864e5).toISOString();
    setLeads(null);
    Promise.all([
      supabase.from('leads').select('id, origem, utm_campaign, evento, status, criado_em, primeiro_contato_em, oportunidade_id').gte('criado_em', desde).limit(5000),
      supabase.from('v_oportunidades').select('*').or(`criado_em.gte."${desde}",fechada_em.gte."${desde}",etapa.not.in.(ganha,perdida)`).limit(5000),
    ]).then(([l, o]) => { setLeads((l.data ?? []) as Lead[]); setOps((o.data ?? []) as Oportunidade[]); });
  }, [dias]);

  if (!leads) return <Carregando />;

  const desde = Date.now() - dias * 864e5;
  const qualificados = leads.filter((l) => l.oportunidade_id);
  const tempos = leads.filter((l) => l.primeiro_contato_em).map((l) => horasUteis(new Date(l.criado_em), new Date(l.primeiro_contato_em!)));
  const medTempo = mediana(tempos);
  const fechadas = ops.filter((o) => o.fechada_em && new Date(o.fechada_em).getTime() >= desde);
  const ganhas = fechadas.filter((o) => o.etapa === 'ganha');
  const perdidas = fechadas.filter((o) => o.etapa === 'perdida');
  const ciclo = mediana(ganhas.map((o) => (new Date(o.fechada_em!).getTime() - new Date(o.criado_em).getTime()) / 864e5));
  const abertas = ops.filter((o) => o.etapa !== 'ganha' && o.etapa !== 'perdida');
  const conversaoOrigem = agrupar(leads, (l) => l.origem).map((g) => {
    const doGrupo = leads.filter((l) => l.origem === g.rotulo);
    return { rotulo: `${nomeOrigem(g.rotulo)} (${doGrupo.length})`, valor: Math.round((doGrupo.filter((l) => l.oportunidade_id).length / doGrupo.length) * 100) };
  });

  return (
    <>
      <div className="topo">
        <div><h1>Relatórios</h1><p>Aquisição e vendas. Os pesos da pontuação são revistos após 90 dias de dados.</p></div>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))} style={{ width: 'auto' }}>
          {PERIODOS.map((p) => <option key={p.d} value={p.d}>{p.nome}</option>)}
        </select>
      </div>

      <h2 style={{ margin: '4px 0 10px' }}>Aquisição</h2>
      <div className="grade g4" style={{ marginBottom: 16 }}>
        <Kpi rotulo="Leads" valor={leads.length} />
        <Kpi rotulo="Qualificados" valor={qualificados.length} nota={leads.length ? `${Math.round((qualificados.length / leads.length) * 100)}% dos leads` : undefined} />
        <Kpi rotulo="1º contato (mediana)" valor={medTempo == null ? '—' : `${medTempo.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h úteis`} alerta={medTempo != null && medTempo > 2} nota="meta: até 2h úteis" />
        <Kpi rotulo="Descartados" valor={leads.filter((l) => l.status === 'descartado').length} />
      </div>
      <div className="grade g2" style={{ marginBottom: 24 }}>
        <div className="cartao"><h3>Leads por origem</h3><Barras itens={agrupar(leads, (l) => nomeOrigem(l.origem))} /></div>
        <div className="cartao"><h3>Conversão em oportunidade por origem (%)</h3><Barras itens={conversaoOrigem} formato={(v) => `${v}%`} /></div>
        <div className="cartao"><h3>Leads por campanha ou evento</h3><Barras itens={agrupar(leads.filter((l) => l.utm_campaign || l.evento), (l) => l.utm_campaign ?? l.evento ?? '').slice(0, 10)} /></div>
        <div className="cartao"><h3>Leads por mês</h3><Barras itens={agrupar(leads, (l) => l.criado_em.slice(0, 7)).sort((a, b) => a.rotulo.localeCompare(b.rotulo))} /></div>
      </div>

      <h2 style={{ margin: '4px 0 10px' }}>Vendas</h2>
      <div className="grade g4" style={{ marginBottom: 16 }}>
        <Kpi rotulo="Ganhas" valor={ganhas.length} nota={`${brl(ganhas.reduce((s, o) => s + Number(o.valor_mensal ?? 0), 0))}/mês novos`} />
        <Kpi rotulo="Taxa de ganho" valor={fechadas.length ? `${Math.round((ganhas.length / fechadas.length) * 100)}%` : '—'} nota={`${ganhas.length} de ${fechadas.length} fechadas`} />
        <Kpi rotulo="Ciclo de venda (mediana)" valor={ciclo == null ? '—' : `${Math.round(ciclo)} dias`} />
        <Kpi rotulo="Ticket médio" valor={ganhas.length ? brl(ganhas.reduce((s, o) => s + Number(o.valor_mensal ?? 0), 0) / ganhas.length) : '—'} nota="mensal" />
      </div>
      <div className="grade g2">
        <div className="cartao"><h3>Pipeline aberto por etapa (1º ano)</h3>
          <Barras itens={ETAPAS.filter((e) => e.prazo != null).map((e) => ({ rotulo: e.nome, valor: abertas.filter((o) => o.etapa === e.id).reduce((s, o) => s + Number(o.valor_primeiro_ano ?? 0), 0) }))} formato={(v) => brl(v)} />
        </div>
        <div className="cartao"><h3>Motivos de perda</h3><Barras itens={agrupar(perdidas, (o) => MOTIVOS_PERDA[o.motivo_perda ?? 'outro'])} /></div>
        <div className="cartao"><h3>Ganhas por plano</h3><Barras itens={agrupar(ganhas, (o) => (o.plano === 'premium' ? 'Premium' : 'Starter'))} /></div>
        <div className="cartao"><h3>Tempo médio em cada etapa (abertas, dias)</h3>
          <Barras itens={ETAPAS.filter((e) => e.prazo != null).map((e) => {
            const n = abertas.filter((o) => o.etapa === e.id);
            return { rotulo: `${e.nome} (meta ${e.prazo})`, valor: n.length ? Math.round(n.reduce((s, o) => s + o.dias_na_etapa, 0) / n.length) : 0 };
          })} />
        </div>
      </div>
    </>
  );
}
