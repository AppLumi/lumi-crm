import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { STATUS_PROPOSTA, brl, data, relativo } from '../lib/formato';
import type { Proposta, StatusProposta } from '../lib/tipos';
import { Carregando, Kpi, Selo, Vazio } from '../components/ui';

type Linha = Proposta & { oportunidades: { titulo: string; contas: { nome: string } | null } | null };

export default function Propostas() {
  const ir = useNavigate();
  const [itens, setItens] = useState<Linha[] | null>(null);
  const [status, setStatus] = useState<StatusProposta | ''>('');

  useEffect(() => {
    let q = supabase.from('propostas').select('*, oportunidades(titulo, contas(nome))').order('criado_em', { ascending: false }).limit(300);
    if (status) q = q.eq('status', status);
    q.then(({ data: d }) => setItens((d ?? []) as Linha[]));
  }, [status]);

  if (!itens) return <Carregando />;
  const conta = (p: Linha) => p.oportunidades?.contas?.nome ?? '—';
  const enviadas = itens.filter((p) => ['enviada', 'aceita', 'recusada', 'expirada'].includes(p.status));
  const aceitas = itens.filter((p) => p.status === 'aceita');

  return (
    <>
      <div className="topo">
        <div><h1>Propostas</h1><p>Todas as versões. Descontos acima de 10% ou contratos com mais de 5.000 vidas passam por uma sócia.</p></div>
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusProposta | '')} style={{ width: 'auto' }}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_PROPOSTA).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
        </select>
      </div>
      {!status && (
        <div className="grade g3" style={{ marginBottom: 16 }}>
          <Kpi rotulo="Aguardando aprovação" valor={itens.filter((p) => p.status === 'aguardando_aprovacao').length} />
          <Kpi rotulo="Enviadas sem resposta" valor={itens.filter((p) => p.status === 'enviada').length} nota={`${itens.filter((p) => p.status === 'enviada' && p.visualizada_em).length} já visualizadas`} />
          <Kpi rotulo="Taxa de aceite" valor={enviadas.length ? `${Math.round((aceitas.length / enviadas.length) * 100)}%` : '—'} nota={`${aceitas.length} de ${enviadas.length} enviadas`} />
        </div>
      )}
      {itens.length === 0 ? <Vazio>Nenhuma proposta.</Vazio> : (
        <div className="tabela-envolve">
          <table className="tabela">
            <thead><tr><th>Conta</th><th>Versão</th><th className="num">Vidas</th><th className="num">Desconto</th><th className="num">Mensal</th><th className="num">1º ano</th><th>Status</th><th>Validade</th></tr></thead>
            <tbody>
              {itens.map((p) => (
                <tr key={p.id} className="clicavel" onClick={() => ir(`/oportunidades/${p.oportunidade_id}`)}>
                  <td><strong>{conta(p)}</strong><div className="muted">{relativo(p.criado_em)}</div></td>
                  <td>v{p.versao} · {p.plano === 'premium' ? 'Premium' : 'Starter'}</td>
                  <td className="num">{p.vidas.toLocaleString('pt-BR')}</td>
                  <td className="num">{Number(p.desconto_pct) ? `${p.desconto_pct}%` : '—'}</td>
                  <td className="num">{brl(Number(p.mensal))}</td>
                  <td className="num">{brl(Number(p.primeiro_ano))}</td>
                  <td><Selo cor={STATUS_PROPOSTA[p.status].cor}>{STATUS_PROPOSTA[p.status].nome}</Selo>{p.visualizada_em && p.status === 'enviada' && <div className="muted">visualizada</div>}</td>
                  <td>{data(p.validade)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
