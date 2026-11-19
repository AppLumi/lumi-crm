import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ok, supabase } from '../lib/supabase';
import { useAcao } from '../lib/sessao';
import { dataHora } from '../lib/formato';
import type { ModeloEmail } from '../lib/tipos';
import { Campo, Carregando, Kpi, Modal, Selo, Vazio } from '../components/ui';

interface Email {
  id: string; para: string; assunto: string; status: string; erro: string | null; lead_id: string | null; conta_id: string | null;
  oportunidade_id: string | null; enviado_em: string | null; aberto_em: string | null; clicado_em: string | null; criado_em: string;
}

const STATUS: Record<string, { nome: string; cor: string }> = {
  enviando: { nome: 'Enviando', cor: '' }, enviado: { nome: 'Enviado', cor: 'azul' }, entregue: { nome: 'Entregue', cor: 'azul' },
  aberto: { nome: 'Aberto', cor: 'verde' }, clicado: { nome: 'Clicou', cor: 'lima' }, devolvido: { nome: 'Devolvido', cor: 'vermelho' },
  reclamacao: { nome: 'Marcou spam', cor: 'vermelho' }, falhou: { nome: 'Falhou', cor: 'vermelho' },
};
const VARIAVEIS = ['primeiro_nome', 'nome', 'empresa', 'remetente', 'link_proposta', 'validade'];

interface Disparo {
  id: number; em: string; detalhe: { assunto: string; autor: string; recebem: number; enviados?: number; falhas?: number; emails?: string[] };
  stats: { entregues: number; abertos: number; cliques: number; problemas: number };
}

async function carregarDisparos(): Promise<Disparo[]> {
  const { data } = await supabase.from('auditoria').select('id, em, detalhe').eq('acao', 'disparo_email').order('em', { ascending: false }).limit(50);
  const lista = (data ?? []) as Omit<Disparo, 'stats'>[];
  const ids = lista.flatMap((d) => d.detalhe?.emails ?? []);
  const status = new Map<string, { status: string; aberto_em: string | null; clicado_em: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const r = await supabase.from('emails').select('id, status, aberto_em, clicado_em').in('id', ids.slice(i, i + 200));
    (r.data ?? []).forEach((e: { id: string; status: string; aberto_em: string | null; clicado_em: string | null }) => status.set(e.id, e));
  }
  return lista.map((d) => {
    const es = (d.detalhe?.emails ?? []).map((id) => status.get(id)).filter(Boolean) as { status: string; aberto_em: string | null; clicado_em: string | null }[];
    return { ...d, stats: {
      entregues: es.filter((e) => ['entregue', 'aberto', 'clicado'].includes(e.status)).length,
      abertos: es.filter((e) => e.aberto_em).length,
      cliques: es.filter((e) => e.clicado_em).length,
      problemas: es.filter((e) => ['devolvido', 'reclamacao', 'falhou'].includes(e.status)).length,
    } };
  });
}

export default function Emails() {
  const { ocupado, executar } = useAcao();
  const [aba, setAba] = useState<'enviados' | 'disparos' | 'modelos'>('enviados');
  const [disparos, setDisparos] = useState<Disparo[] | null>(null);
  const [emails, setEmails] = useState<Email[] | null>(null);
  const [modelos, setModelos] = useState<ModeloEmail[]>([]);
  const [editar, setEditar] = useState<Partial<ModeloEmail> | null>(null);

  const carregar = useCallback(async () => {
    const [e, m] = await Promise.all([
      supabase.from('emails').select('id, para, assunto, status, erro, lead_id, conta_id, oportunidade_id, enviado_em, aberto_em, clicado_em, criado_em').order('criado_em', { ascending: false }).limit(300),
      supabase.from('modelos_email').select('*').order('nome'),
    ]);
    setEmails((e.data ?? []) as Email[]);
    setModelos((m.data ?? []) as ModeloEmail[]);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { if (aba === 'disparos') carregarDisparos().then(setDisparos); }, [aba]);

  const salvar = () => executar(async () => {
    if (!editar?.nome?.trim() || !editar.assunto?.trim() || !editar.corpo?.trim()) throw new Error('Preencha nome, assunto e texto');
    const dados = { nome: editar.nome.trim(), assunto: editar.assunto.trim(), corpo: editar.corpo, categoria: editar.categoria || 'comercial', ativo: editar.ativo ?? true };
    if (editar.id) ok(await supabase.from('modelos_email').update(dados).eq('id', editar.id));
    else ok(await supabase.from('modelos_email').insert(dados));
    setEditar(null);
    await carregar();
  }, 'Modelo salvo');

  if (!emails) return <Carregando />;
  const enviados = emails.filter((e) => e.enviado_em);
  const taxa = (n: number) => (enviados.length ? `${Math.round((n / enviados.length) * 100)}%` : '—');

  return (
    <>
      <div className="topo">
        <div><h1>E-mails</h1><p>Envios do time, individuais e em massa, com abertura e clique. Respostas chegam no e-mail de quem enviou.</p></div>
        {aba === 'modelos' && <button className="btn primario" onClick={() => setEditar({ ativo: true, categoria: 'comercial' })}>Novo modelo</button>}
      </div>
      <div className="abas">
        <button className={aba === 'enviados' ? 'ativa' : ''} onClick={() => setAba('enviados')}>Enviados</button>
        <button className={aba === 'disparos' ? 'ativa' : ''} onClick={() => setAba('disparos')}>Disparos</button>
        <button className={aba === 'modelos' ? 'ativa' : ''} onClick={() => setAba('modelos')}>Modelos</button>
      </div>

      {aba === 'disparos' ? (
        !disparos ? <Carregando /> : disparos.length === 0
          ? <Vazio>Nenhum disparo ainda. Em Leads, marque as pessoas (por exemplo, filtre por Nutrição e marque todas) e clique em “Enviar e-mail”.</Vazio>
          : (
            <div className="tabela-envolve" style={{ marginTop: 12 }}>
              <table className="tabela">
                <thead><tr><th>Assunto</th><th>Quem enviou</th><th className="num">Enviados</th><th className="num">Entregues</th><th className="num">Abriram</th><th className="num">Clicaram</th><th className="num">Problemas</th><th className="num">Quando</th></tr></thead>
                <tbody>
                  {disparos.map((d) => {
                    const env = d.detalhe.enviados ?? 0;
                    const pct = (n: number) => (env ? ` (${Math.round((n / env) * 100)}%)` : '');
                    return (
                      <tr key={d.id}>
                        <td><strong>{d.detalhe.assunto}</strong>{d.detalhe.enviados == null && <div className="muted">enviando ou interrompido</div>}</td>
                        <td>{d.detalhe.autor}</td>
                        <td className="num">{env}{d.detalhe.falhas ? <div className="muted">{d.detalhe.falhas} falharam</div> : null}</td>
                        <td className="num">{d.stats.entregues}</td>
                        <td className="num">{d.stats.abertos}{pct(d.stats.abertos)}</td>
                        <td className="num">{d.stats.cliques}{pct(d.stats.cliques)}</td>
                        <td className="num">{d.stats.problemas}</td>
                        <td className="num">{dataHora(d.em)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
      ) : aba === 'enviados' ? (
        <>
          <div className="grade g4" style={{ margin: '12px 0 16px' }}>
            <Kpi rotulo="Enviados" valor={enviados.length} nota="últimos 300" />
            <Kpi rotulo="Abertura" valor={taxa(enviados.filter((e) => e.aberto_em).length)} nota="aproximada: alguns leitores bloqueiam" />
            <Kpi rotulo="Clique" valor={taxa(enviados.filter((e) => e.clicado_em).length)} />
            <Kpi rotulo="Problemas" valor={emails.filter((e) => ['devolvido', 'reclamacao', 'falhou'].includes(e.status)).length} />
          </div>
          {emails.length === 0 ? <Vazio>Nenhum e-mail enviado ainda.</Vazio> : (
            <div className="tabela-envolve">
              <table className="tabela">
                <thead><tr><th>Para</th><th>Assunto</th><th>Status</th><th className="num">Enviado</th></tr></thead>
                <tbody>
                  {emails.map((e) => {
                    const link = e.oportunidade_id ? `/oportunidades/${e.oportunidade_id}` : e.lead_id ? `/leads/${e.lead_id}` : e.conta_id ? `/contas/${e.conta_id}` : null;
                    return (
                      <tr key={e.id}>
                        <td>{link ? <Link to={link}>{e.para}</Link> : e.para}</td>
                        <td>{e.assunto}{e.erro && <div className="muted">{e.erro}</div>}</td>
                        <td><Selo cor={STATUS[e.status]?.cor}>{STATUS[e.status]?.nome ?? e.status}</Selo></td>
                        <td className="num">{dataHora(e.enviado_em ?? e.criado_em)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="grade g2" style={{ marginTop: 12 }}>
          {modelos.map((m) => (
            <div className="cartao" key={m.id} style={{ cursor: 'pointer', opacity: m.ativo ? 1 : 0.55 }} onClick={() => setEditar(m)}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><h3>{m.nome}</h3>{!m.ativo && <Selo>inativo</Selo>}</div>
              <div className="muted" style={{ marginTop: 4 }}>{m.assunto}</div>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: 'var(--tinta-2)', maxHeight: 110, overflow: 'hidden' }}>{m.corpo}</p>
            </div>
          ))}
          {modelos.length === 0 && <Vazio>Nenhum modelo.</Vazio>}
        </div>
      )}

      <Modal titulo={editar?.id ? 'Editar modelo' : 'Novo modelo'} aberto={!!editar} fechar={() => setEditar(null)} largura={720}
        rodape={<><button className="btn" onClick={() => setEditar(null)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={salvar}>Salvar</button></>}>
        {editar && (
          <>
            <div className="aviso info">Variáveis: {VARIAVEIS.map((v) => <code key={v} style={{ marginRight: 6 }}>{`{{${v}}}`}</code>)}. Trechos entre [colchetes] precisam ser trocados antes de enviar.</div>
            <div className="linha-campos">
              <Campo rotulo="Nome"><input value={editar.nome ?? ''} onChange={(e) => setEditar({ ...editar, nome: e.target.value })} /></Campo>
              <Campo rotulo="Situação">
                <select value={editar.ativo === false ? 'nao' : 'sim'} onChange={(e) => setEditar({ ...editar, ativo: e.target.value === 'sim' })}>
                  <option value="sim">Ativo</option><option value="nao">Inativo</option>
                </select>
              </Campo>
            </div>
            <Campo rotulo="Assunto"><input value={editar.assunto ?? ''} onChange={(e) => setEditar({ ...editar, assunto: e.target.value })} /></Campo>
            <Campo rotulo="Texto"><textarea value={editar.corpo ?? ''} onChange={(e) => setEditar({ ...editar, corpo: e.target.value })} style={{ minHeight: 260 }} /></Campo>
          </>
        )}
      </Modal>
    </>
  );
}
