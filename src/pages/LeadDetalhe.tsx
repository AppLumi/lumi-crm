import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { STATUS_LEAD, nomeOrigem, cnpjFmt, dataHora, horasUteis, num, relativo, zapLink } from '../lib/formato';
import type { Lead, Plano } from '../lib/tipos';
import { Campo, Carregando, Modal, Nota, Selo } from '../components/ui';
import LinhaDoTempo from '../components/LinhaDoTempo';
import EnviarEmail, { type DestinoEmail } from '../components/EnviarEmail';

interface Evento { id: string; nome: string; origem: string; criado_em: string }

const NOME_EVENTO: Record<string, string> = {
  demo_solicitada: 'Pediu demonstração', presenca_evento: 'Esteve em evento', formulario_contato: 'Preencheu formulário',
  inscricao_evento: 'Inscreveu-se em evento', download_material: 'Baixou material', whatsapp_resposta: 'Respondeu no WhatsApp',
  visita_planos: 'Viu a página de planos', email_clique: 'Clicou em e-mail', visita_site: 'Visitou o site', email_aberto: 'Abriu e-mail',
};

export default function LeadDetalhe() {
  const { id } = useParams<{ id: string }>();
  const ir = useNavigate();
  const { time } = useSessao();
  const { ocupado, executar } = useAcao();
  const [lead, setLead] = useState<Lead | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [email, setEmail] = useState<DestinoEmail | null>(null);
  const [qualificar, setQualificar] = useState(false);
  const [plano, setPlano] = useState<Plano>('premium');
  const [descartar, setDescartar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [tick, setTick] = useState(0);

  const carregar = useCallback(async () => {
    const [l, e] = await Promise.all([
      supabase.from('v_leads').select('*').eq('id', id!).maybeSingle(),
      supabase.from('eventos').select('id, nome, origem, criado_em').eq('lead_id', id!).order('criado_em', { ascending: false }).limit(50),
    ]);
    setLead(l.data as Lead | null);
    setEventos((e.data ?? []) as Evento[]);
  }, [id]);
  useEffect(() => { carregar(); }, [carregar, tick]);

  if (!lead) return <Carregando />;

  const atualizar = (campos: Partial<Lead>, msg?: string) => executar(async () => {
    ok(await supabase.from('leads').update(campos).eq('id', lead.id));
    await carregar();
  }, msg);

  const fazerQualificacao = () => executar(async () => {
    const op = ok(await supabase.rpc('qualificar_lead', { p_lead: lead.id, p_plano: plano })) as string;
    ir(`/oportunidades/${op}`);
  }, 'Oportunidade criada');

  const fazerDescarte = () => executar(async () => {
    if (!motivo.trim()) throw new Error('Diga o motivo, ajuda a melhorar a captação');
    ok(await supabase.from('leads').update({ status: 'descartado', motivo_descarte: motivo.trim() }).eq('id', lead.id));
    setDescartar(false);
    await carregar();
  }, 'Lead descartado');

  const enr = lead.enriquecimento ?? {};
  const zap = zapLink(lead.whatsapp);
  const espera = !lead.primeiro_contato_em ? horasUteis(new Date(lead.criado_em), new Date()) : null;

  return (
    <>
      <div className="migalha"><Link to="/leads">Leads</Link> / {lead.nome}</div>
      <div className="topo">
        <div>
          <h1>{lead.nome}</h1>
          <p>{[lead.cargo, lead.empresa].filter(Boolean).join(' · ') || 'Sem empresa informada'} <Selo cor={STATUS_LEAD[lead.status].cor}>{STATUS_LEAD[lead.status].nome}</Selo></p>
        </div>
        <div className="acoes">
          {lead.email && <button className="btn" onClick={() => setEmail({ para: lead.email!, nome: lead.nome, empresa: lead.empresa, lead_id: lead.id })}>Enviar e-mail</button>}
          {zap && <a className="btn" href={zap} target="_blank" rel="noreferrer">WhatsApp</a>}
          {lead.oportunidade_id
            ? <Link className="btn primario" to={`/oportunidades/${lead.oportunidade_id}`}>Abrir oportunidade</Link>
            : <>
                {lead.status !== 'descartado' && <button className="btn" onClick={() => setDescartar(true)}>Descartar</button>}
                {lead.status !== 'nutricao' && lead.status !== 'descartado' && <button className="btn" onClick={() => atualizar({ status: 'nutricao' }, 'Lead em nutrição')}>Nutrir</button>}
                <button className="btn primario" onClick={() => setQualificar(true)}>Qualificar</button>
              </>}
        </div>
      </div>

      {espera != null && lead.status === 'novo' && (
        <div className={`aviso ${espera > 2 ? 'erro' : 'info'}`}>
          {espera > 2 ? `Esperando o primeiro contato há ${Math.floor(espera)}h úteis (meta: 2h).` : 'Lead novo: a meta é o primeiro contato em até 2h úteis.'}
        </div>
      )}
      {lead.status === 'descartado' && lead.motivo_descarte && <div className="aviso">Descartado: {lead.motivo_descarte}</div>}

      <div className="detalhe">
        <LinhaDoTempo alvo={{ lead_id: lead.id, conta_id: lead.conta_id ?? undefined, oportunidade_id: lead.oportunidade_id ?? undefined }}
          filtro={{ coluna: 'lead_id', valor: lead.id }} atualizar={tick} />

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="cartao">
            <h2>Notas</h2>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Perfil (quem é)</span><Nota valor={lead.nota_perfil} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Interesse (o que fez)</span><Nota valor={lead.nota_interesse} /></div>
            </div>
          </div>

          <div className="cartao">
            <h2>Dados</h2>
            <dl className="dados" style={{ marginTop: 10 }}>
              <dt>E-mail</dt><dd>{lead.email ?? '—'}</dd>
              <dt>WhatsApp</dt><dd>{lead.whatsapp ?? '—'}</dd>
              <dt>Empresa</dt><dd>{lead.empresa ?? '—'}</dd>
              <dt>CNPJ</dt><dd>{cnpjFmt(lead.cnpj)}</dd>
              <dt>Colaboradores</dt><dd>{lead.colaboradores ? num(lead.colaboradores) : enr.porte_informado ? `${enr.porte_informado} (informado no site)` : '—'}</dd>
              <dt>Origem</dt><dd>{nomeOrigem(lead.origem)}{lead.evento ? ` · ${lead.evento}` : ''}</dd>
              {lead.utm_campaign && <><dt>Campanha</dt><dd>{[lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean).join(' / ')}</dd></>}
              {lead.pagina && <><dt>Página</dt><dd style={{ wordBreak: 'break-all' }}>{lead.pagina}</dd></>}
              <dt>Marketing</dt><dd>{lead.aceita_marketing ? <Selo cor="verde">autorizou</Selo> : <Selo>não autorizou</Selo>}</dd>
              <dt>Entrou</dt><dd>{dataHora(lead.criado_em)}</dd>
              <dt>1º contato</dt><dd>{lead.primeiro_contato_em ? dataHora(lead.primeiro_contato_em) : '—'}</dd>
              <dt>Dono</dt>
              <dd>
                <select value={lead.dono ?? ''} onChange={(e) => atualizar({ dono: e.target.value || null }, 'Dono alterado')}>
                  <option value="">Sem dono</option>
                  {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </dd>
            </dl>
            {lead.mensagem && <><h3 style={{ marginTop: 14 }}>Mensagem</h3><p style={{ whiteSpace: 'pre-wrap' }}>{lead.mensagem}</p></>}
          </div>

          {enr.razao_social && (
            <div className="cartao">
              <h2>Cadastro da empresa</h2>
              <dl className="dados" style={{ marginTop: 10 }}>
                {enr.razao_social && <><dt>Razão social</dt><dd>{enr.razao_social}</dd></>}
                {enr.setor && <><dt>Atividade</dt><dd>{enr.cnae} · {enr.setor}</dd></>}
                {enr.porte && <><dt>Porte</dt><dd>{enr.porte}</dd></>}
                {enr.municipio && <><dt>Cidade</dt><dd>{enr.municipio}/{enr.uf}</dd></>}
                {enr.situacao && <><dt>Situação</dt><dd>{enr.situacao}</dd></>}
              </dl>
            </div>
          )}

          <div className="cartao">
            <h2>Sinais de interesse</h2>
            {eventos.length === 0 ? <p className="muted">Nenhum sinal registrado.</p> : (
              <ul className="tempo" style={{ marginTop: 8 }}>
                {eventos.map((e) => (
                  <li key={e.id}><span className="icone">•</span><div>{NOME_EVENTO[e.nome] ?? e.nome}<div className="quando">{relativo(e.criado_em)} · {e.origem}</div></div></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <Modal titulo="Qualificar lead" aberto={qualificar} fechar={() => setQualificar(false)}
        rodape={<><button className="btn" onClick={() => setQualificar(false)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={fazerQualificacao}>Criar oportunidade</button></>}>
        <p>Qualificar cria a conta da empresa (ou usa a que já existe pelo CNPJ), o contato e uma oportunidade no funil.</p>
        <div className="aviso info">Antes de qualificar, confirme que existe uma dor ligada à NR-1 ou à saúde emocional do time e que a empresa tem porte para o Lumi.</div>
        <Campo rotulo="Plano de interesse">
          <select value={plano} onChange={(e) => setPlano(e.target.value as Plano)}>
            <option value="premium">Premium</option>
            <option value="starter">Starter</option>
          </select>
        </Campo>
      </Modal>

      <Modal titulo="Descartar lead" aberto={descartar} fechar={() => setDescartar(false)}
        rodape={<><button className="btn" onClick={() => setDescartar(false)}>Cancelar</button><button className="btn perigo" disabled={ocupado} onClick={fazerDescarte}>Descartar</button></>}>
        <Campo rotulo="Motivo">
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="">Escolha…</option>
            {['Empresa muito pequena', 'Não é empresa (pessoa física)', 'Concorrente ou fornecedor', 'Dados inválidos', 'Sem interesse', 'Duplicado', 'Outro'].map((m) => <option key={m}>{m}</option>)}
          </select>
        </Campo>
      </Modal>

      <EnviarEmail destino={email} fechar={() => setEmail(null)} enviado={() => setTick((t) => t + 1)} />
    </>
  );
}
