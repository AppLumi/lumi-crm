import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { ETAPAS, MOTIVOS_PERDA, STATUS_PROPOSTA, brl, data, dataHora, linkProposta, nomeEtapa } from '../lib/formato';
import type { Contato, Etapa, Oportunidade, Proposta } from '../lib/tipos';
import { Carregando, Selo, Vazio } from '../components/ui';
import LinhaDoTempo from '../components/LinhaDoTempo';
import MudarEtapa, { moverEtapa, pendencias } from '../components/MudarEtapa';
import GeradorProposta from '../components/GeradorProposta';
import EnviarEmail, { type DestinoEmail } from '../components/EnviarEmail';

const CAMPOS: { k: keyof Oportunidade; rotulo: string; tipo?: 'data' | 'datahora' }[] = [
  { k: 'dor', rotulo: 'Dor principal' },
  { k: 'situacao_pgr', rotulo: 'PGR e riscos psicossociais hoje' },
  { k: 'criterio_decisao', rotulo: 'Como decidem (critérios, prazos, quem assina)' },
  { k: 'demo_em', rotulo: 'Demonstração', tipo: 'datahora' },
  { k: 'piloto_escopo', rotulo: 'Escopo do piloto' },
  { k: 'piloto_resultado', rotulo: 'Resultado do piloto' },
  { k: 'condicoes_finais', rotulo: 'Condições fechadas' },
  { k: 'previsao_fechamento', rotulo: 'Previsão de fechamento', tipo: 'data' },
];

export default function OportunidadeDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { perfil, time } = useSessao();
  const { ocupado, executar } = useAcao();
  const [op, setOp] = useState<Oportunidade | null>(null);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [mover, setMover] = useState<Etapa | null>(null);
  const [gerar, setGerar] = useState(false);
  const [email, setEmail] = useState<DestinoEmail | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [tick, setTick] = useState(0);

  const carregar = useCallback(async () => {
    const o = await supabase.from('v_oportunidades').select('*').eq('id', id!).maybeSingle();
    const opr = o.data as Oportunidade | null;
    setOp(opr);
    if (!opr) return;
    const [p, c] = await Promise.all([
      supabase.from('propostas').select('*').eq('oportunidade_id', opr.id).order('versao', { ascending: false }),
      supabase.from('contatos').select('*').eq('conta_id', opr.conta_id).order('nome'),
    ]);
    setPropostas((p.data ?? []) as Proposta[]);
    setContatos((c.data ?? []) as Contato[]);
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!op) return <Carregando />;
  const recarregar = () => { carregar(); setTick((t) => t + 1); };

  const irPara = (destino: Etapa) => {
    if (destino === op.etapa) return;
    if (pendencias(op, destino).length) setMover(destino);
    else executar(async () => { await moverEtapa(op, destino); recarregar(); }, `Movida para ${nomeEtapa(destino)}`);
  };

  const salvarCampo = (k: string, tipo?: string) => executar(async () => {
    const v = valor.trim();
    ok(await supabase.from('oportunidades').update({ [k]: v ? (tipo === 'datahora' ? new Date(v).toISOString() : v) : null }).eq('id', op.id));
    setEditando(null);
    await carregar();
  });
  const atualizar = (campos: Record<string, unknown>) => executar(async () => {
    ok(await supabase.from('oportunidades').update(campos).eq('id', op.id));
    await carregar();
  }, 'Salvo');

  const aprovar = (p: Proposta) => executar(async () => {
    ok(await supabase.from('propostas').update({ status: 'aprovada', aprovado_por: perfil?.id }).eq('id', p.id));
    await supabase.from('atividades').insert({ tipo: 'sistema', titulo: `Proposta v${p.versao} aprovada por ${perfil?.nome}`, conta_id: op.conta_id, oportunidade_id: op.id, autor: perfil?.id });
    recarregar();
  }, 'Proposta aprovada');

  const enviar = (p: Proposta) => executar(async () => {
    if (p.status === 'aprovada') {
      ok(await supabase.from('propostas').update({ status: 'enviada', enviada_em: new Date().toISOString() }).eq('id', p.id));
      if (['qualificacao', 'diagnostico', 'demo', 'piloto'].includes(op.etapa)) await supabase.from('oportunidades').update({ etapa: 'proposta' }).eq('id', op.id);
    }
    await navigator.clipboard?.writeText(linkProposta(p.token)).catch(() => undefined);
    const decisor = contatos.find((c) => c.id === op.decisor_id) ?? contatos.find((c) => c.email);
    if (decisor?.email) {
      setEmail({
        para: decisor.email, nome: decisor.nome, empresa: op.conta_nome, contato_id: decisor.id, conta_id: op.conta_id, oportunidade_id: op.id,
        extras: { link_proposta: linkProposta(p.token), validade: data(p.validade) },
      });
    }
    recarregar();
  }, 'Link da proposta copiado');

  const decisor = contatos.find((c) => c.id === op.decisor_id);
  const fechada = op.etapa === 'ganha' || op.etapa === 'perdida';

  return (
    <>
      <div className="migalha"><Link to="/funil">Funil</Link> / <Link to={`/contas/${op.conta_id}`}>{op.conta_nome}</Link></div>
      <div className="topo">
        <div>
          <h1>{op.titulo}</h1>
          <p>
            {op.plano === 'premium' ? 'Premium' : 'Starter'}{op.vidas ? ` · ${op.vidas.toLocaleString('pt-BR')} vidas` : ''}
            {' · '}{op.valor_mensal ? `${brl(Number(op.valor_mensal))}/mês` : 'sem proposta'}
            {' · '}{op.dias_na_etapa} dia(s) em {nomeEtapa(op.etapa)}
          </p>
        </div>
        <div className="acoes">
          {!fechada && <button className="btn" onClick={() => irPara('perdida')}>Marcar como perdida</button>}
          {!fechada && <button className="btn destaque" onClick={() => irPara('ganha')}>Marcar como ganha</button>}
          {fechada && <button className="btn" onClick={() => atualizar({ etapa: 'negociacao', motivo_perda: null })}>Reabrir</button>}
        </div>
      </div>

      <div className="abas" style={{ marginBottom: 16 }}>
        {ETAPAS.filter((e) => e.id !== 'perdida' && e.id !== 'ganha').map((e) => (
          <button key={e.id} className={op.etapa === e.id ? 'ativa' : ''} onClick={() => irPara(e.id)} disabled={fechada}>{e.nome}</button>
        ))}
        {op.etapa === 'ganha' && <Selo cor="verde">Ganha em {data(op.fechada_em)}</Selo>}
        {op.etapa === 'perdida' && <Selo cor="vermelho">Perdida: {MOTIVOS_PERDA[op.motivo_perda ?? 'outro']}{op.motivo_perda_detalhe ? ` · ${op.motivo_perda_detalhe}` : ''}</Selo>}
      </div>

      <div className="detalhe">
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="cartao">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Propostas</h2>
              {!fechada && <button className="btn primario pequeno" onClick={() => setGerar(true)}>Nova proposta</button>}
            </div>
            {propostas.length === 0 ? <Vazio>Nenhuma proposta ainda. A calculadora usa a tabela do site e as regras de desconto.</Vazio> : (
              <table className="tabela" style={{ marginTop: 8 }}>
                <thead><tr><th>Versão</th><th className="num">Mensal</th><th className="num">1º ano</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {propostas.map((p) => (
                    <tr key={p.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>v{p.versao} · {p.plano === 'premium' ? 'Premium' : 'Starter'}<div className="muted">{p.vidas.toLocaleString('pt-BR')} vidas{p.desconto_pct > 0 ? ` · ${p.desconto_pct}% off` : ''}</div></td>
                      <td className="num">{brl(Number(p.mensal))}</td>
                      <td className="num">{brl(Number(p.primeiro_ano))}</td>
                      <td>
                        <Selo cor={STATUS_PROPOSTA[p.status].cor}>{STATUS_PROPOSTA[p.status].nome}</Selo>
                        {p.visualizada_em && <div className="muted">vista {dataHora(p.visualizada_em)}</div>}
                        {p.status === 'aguardando_aprovacao' && p.motivo_aprovacao && <div className="muted">“{p.motivo_aprovacao}”</div>}
                      </td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        {p.status === 'aguardando_aprovacao' && perfil?.aprova_desconto && <button className="btn pequeno destaque" disabled={ocupado} onClick={() => aprovar(p)}>Aprovar</button>}
                        {(p.status === 'aprovada' || p.status === 'enviada') && <button className="btn pequeno" disabled={ocupado} onClick={() => enviar(p)}>{p.status === 'aprovada' ? 'Enviar' : 'Reenviar'}</button>}
                        {['aprovada', 'enviada', 'aceita', 'recusada'].includes(p.status) && <a className="btn pequeno" href={`/p/${p.token}`} target="_blank" rel="noreferrer">Ver</a>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <LinhaDoTempo alvo={{ oportunidade_id: op.id, conta_id: op.conta_id }} filtro={{ coluna: 'oportunidade_id', valor: op.id }} atualizar={tick} />
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="cartao">
            <h2>Negócio</h2>
            <dl className="dados" style={{ marginTop: 10 }}>
              <dt>Conta</dt><dd><Link to={`/contas/${op.conta_id}`}>{op.conta_nome}</Link></dd>
              <dt>Decisor</dt>
              <dd>
                <select value={op.decisor_id ?? ''} onChange={(e) => atualizar({ decisor_id: e.target.value || null })}>
                  <option value="">{contatos.length ? 'Escolha…' : 'Cadastre contatos na conta'}</option>
                  {contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.cargo ? ` · ${c.cargo}` : ''}</option>)}
                </select>
                {decisor?.email && <div className="muted">{decisor.email}</div>}
              </dd>
              <dt>Dono</dt>
              <dd>
                <select value={op.dono ?? ''} onChange={(e) => atualizar({ dono: e.target.value || null })}>
                  <option value="">Sem dono</option>
                  {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </dd>
              <dt>Probabilidade</dt><dd>{Math.round(Number(op.probabilidade) * 100)}% (pela etapa)</dd>
              <dt>Primeiro ano</dt><dd>{brl(op.valor_primeiro_ano)}</dd>
            </dl>
          </div>

          <div className="cartao">
            <h2>Qualificação</h2>
            <p className="muted" style={{ marginTop: 2 }}>Clique para editar. São os critérios de saída das etapas.</p>
            {CAMPOS.map(({ k, rotulo, tipo }) => {
              const v = op[k] as string | null;
              const mostrar = tipo === 'datahora' ? dataHora(v) : tipo === 'data' ? data(v) : v;
              return (
                <div key={k} style={{ marginTop: 10 }}>
                  <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{rotulo}</div>
                  {editando === k ? (
                    <div>
                      {tipo ? <input type={tipo === 'data' ? 'date' : 'datetime-local'} value={valor} onChange={(e) => setValor(e.target.value)} />
                        : <textarea value={valor} onChange={(e) => setValor(e.target.value)} autoFocus />}
                      <div className="acoes" style={{ marginTop: 6 }}>
                        <button className="btn pequeno" onClick={() => setEditando(null)}>Cancelar</button>
                        <button className="btn pequeno primario" disabled={ocupado} onClick={() => salvarCampo(k, tipo)}>Salvar</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ cursor: 'pointer', whiteSpace: 'pre-wrap', minHeight: 20 }} onClick={() => {
                      setEditando(k);
                      setValor(v ? (tipo === 'datahora' ? new Date(new Date(v).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : v) : '');
                    }}>
                      {v ? mostrar : <span className="muted">— adicionar</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <MudarEtapa op={op} destino={mover} fechar={() => setMover(null)} mudou={recarregar} />
      {gerar && <GeradorProposta op={op} versoes={propostas} aberto={gerar} fechar={() => setGerar(false)} criada={recarregar} />}
      <EnviarEmail destino={email} fechar={() => setEmail(null)} enviado={recarregar} />
    </>
  );
}
