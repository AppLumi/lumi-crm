import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useSessao } from '../lib/sessao';
import { ETAPAS, brl, dataHora, horasUteis, nomeEtapa, primeiroNome, relativo } from '../lib/formato';
import type { Atividade, Lead, Oportunidade } from '../lib/tipos';
import { Carregando, Kpi, Nota, Selo, Vazio } from '../components/ui';

const SLA_HORAS = 2;

export default function Inicio() {
  const { perfil } = useSessao();
  const ir = useNavigate();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [ops, setOps] = useState<Oportunidade[]>([]);
  const [tarefas, setTarefas] = useState<Atividade[]>([]);
  const [aprovacoes, setAprovacoes] = useState(0);

  useEffect(() => {
    if (!perfil) return;
    const fimHoje = new Date(); fimHoje.setHours(23, 59, 59, 999);
    Promise.all([
      supabase.from('v_leads').select('*').in('status', ['novo', 'em_contato']).order('criado_em', { ascending: false }).limit(100),
      supabase.from('v_oportunidades').select('*').not('etapa', 'in', '(ganha,perdida)'),
      supabase.from('atividades').select('*').eq('tipo', 'tarefa').is('concluida_em', null).eq('responsavel', perfil.id)
        .lte('vence_em', fimHoje.toISOString()).order('vence_em').limit(20),
      supabase.from('propostas').select('id', { count: 'exact', head: true }).eq('status', 'aguardando_aprovacao'),
    ]).then(([l, o, t, a]) => {
      setLeads((l.data ?? []) as Lead[]);
      setOps((o.data ?? []) as Oportunidade[]);
      setTarefas((t.data ?? []) as Atividade[]);
      setAprovacoes(a.count ?? 0);
    });
  }, [perfil]);

  if (!leads) return <Carregando />;

  const agora = new Date();
  const semContato = leads.filter((l) => !l.primeiro_contato_em);
  const atrasados = semContato.filter((l) => horasUteis(new Date(l.criado_em), agora) > SLA_HORAS);
  const pipeline = ops.reduce((s, o) => s + Number(o.valor_primeiro_ano ?? 0), 0);
  const ponderado = ops.reduce((s, o) => s + Number(o.valor_primeiro_ano ?? 0) * Number(o.probabilidade), 0);
  const paradas = ops.filter((o) => {
    const prazo = ETAPAS.find((e) => e.id === o.etapa)?.prazo;
    return prazo != null && o.dias_na_etapa > prazo;
  });
  const quentes = [...leads].sort((a, b) => b.nota_perfil + b.nota_interesse - (a.nota_perfil + a.nota_interesse)).slice(0, 6);

  return (
    <>
      <div className="topo">
        <div>
          <h1>Olá, {primeiroNome(perfil?.nome)}</h1>
          <p>{agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Link className="btn primario" to="/leads?novo=1">Novo lead</Link>
      </div>

      <div className="grade g4" style={{ marginBottom: 16 }}>
        <Kpi rotulo="Leads sem 1º contato" valor={semContato.length} alerta={atrasados.length > 0}
          nota={atrasados.length ? `${atrasados.length} passaram de ${SLA_HORAS}h úteis` : `meta: responder em até ${SLA_HORAS}h úteis`} />
        <Kpi rotulo="Pipeline aberto" valor={brl(pipeline)} nota={`${ops.length} oportunidades · 1º ano`} />
        <Kpi rotulo="Previsão ponderada" valor={brl(ponderado)} nota="valor × probabilidade da etapa" />
        <Kpi rotulo="Paradas além do prazo" valor={paradas.length} alerta={paradas.length > 0}
          nota={aprovacoes ? `${aprovacoes} proposta(s) aguardando aprovação` : 'tempo na etapa acima do combinado'} />
      </div>

      <div className="grade g2">
        <div className="cartao">
          <h2>Responder primeiro</h2>
          <p className="muted" style={{ marginTop: 2 }}>Leads novos, do mais antigo sem resposta para o mais recente.</p>
          {semContato.length === 0 ? <Vazio>Nenhum lead esperando.</Vazio> : (
            <table className="tabela"><tbody>
              {[...semContato].reverse().slice(0, 8).map((l) => {
                const h = horasUteis(new Date(l.criado_em), agora);
                return (
                  <tr key={l.id} className="clicavel" onClick={() => ir(`/leads/${l.id}`)}>
                    <td><strong>{l.nome}</strong><div className="muted">{l.empresa ?? '—'}</div></td>
                    <td><Nota valor={l.nota_perfil} titulo="Perfil" /></td>
                    <td className="num">{h > SLA_HORAS ? <Selo cor="vermelho">{relativo(l.criado_em)}</Selo> : <Selo cor="azul">{relativo(l.criado_em)}</Selo>}</td>
                  </tr>
                );
              })}
            </tbody></table>
          )}
        </div>

        <div className="cartao">
          <h2>Minhas tarefas de hoje</h2>
          {tarefas.length === 0 ? <Vazio>Sem tarefas vencendo hoje.</Vazio> : (
            <ul className="tempo">
              {tarefas.map((t) => (
                <li key={t.id}>
                  <span className="icone">☐</span>
                  <div>
                    <Link to={t.oportunidade_id ? `/oportunidades/${t.oportunidade_id}` : t.lead_id ? `/leads/${t.lead_id}` : t.conta_id ? `/contas/${t.conta_id}` : '/tarefas'}>
                      <strong>{t.titulo}</strong>
                    </Link>
                    <div className="quando" style={{ color: t.vence_em && new Date(t.vence_em) < agora ? 'var(--vermelho)' : undefined }}>
                      {dataHora(t.vence_em)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cartao">
          <h2>Leads mais quentes</h2>
          <p className="muted" style={{ marginTop: 2 }}>Perfil (quem é) + interesse (o que fez nos últimos dias).</p>
          {quentes.length === 0 ? <Vazio>Sem leads abertos.</Vazio> : (
            <table className="tabela"><tbody>
              {quentes.map((l) => (
                <tr key={l.id} className="clicavel" onClick={() => ir(`/leads/${l.id}`)}>
                  <td><strong>{l.nome}</strong><div className="muted">{l.empresa ?? '—'}{l.colaboradores ? ` · ${l.colaboradores} colab.` : ''}</div></td>
                  <td><Nota valor={l.nota_perfil} titulo="Perfil" /></td>
                  <td><Nota valor={l.nota_interesse} titulo="Interesse" /></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>

        <div className="cartao">
          <h2>Oportunidades paradas</h2>
          {paradas.length === 0 ? <Vazio>Tudo andando dentro do prazo.</Vazio> : (
            <table className="tabela"><tbody>
              {paradas.slice(0, 8).map((o) => (
                <tr key={o.id} className="clicavel" onClick={() => ir(`/oportunidades/${o.id}`)}>
                  <td><strong>{o.conta_nome}</strong><div className="muted">{o.dono_nome ?? 'sem dono'}</div></td>
                  <td>{nomeEtapa(o.etapa)}</td>
                  <td className="num"><Selo cor="amarelo">{o.dias_na_etapa} dias</Selo></td>
                </tr>
              ))}
            </tbody></table>
          )}
        </div>
      </div>
    </>
  );
}
