import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { STATUS_LEAD, nomeOrigem, cnpjFmt, dataHora, horasUteis, num, relativo, zapLink } from '../lib/formato';
import type { Lead } from '../lib/tipos';
import { VENDAS, colocarNoFunil, pessoaDeLead } from '../lib/funis';
import { cnpjValido } from '../../shared/pontuacao';
import { Campo, Carregando, Modal, Nota, Selo } from '../components/ui';
import LinhaDoTempo from '../components/LinhaDoTempo';
import EnviarEmail, { type DestinoEmail } from '../components/EnviarEmail';
import EscolherConta, { type Sugestao } from '../components/EscolherConta';
import NosFunis from '../components/NosFunis';
import { contasPorDominio, dominioDoEmail, vincularLeadAConta, type ContaResumo } from '../../shared/empresas';

interface Evento { id: string; nome: string; origem: string; criado_em: string }

const NOME_EVENTO: Record<string, string> = {
  demo_solicitada: 'Pediu demonstração', presenca_evento: 'Esteve em evento', formulario_contato: 'Preencheu formulário',
  inscricao_evento: 'Inscreveu-se em evento', download_material: 'Baixou material', whatsapp_resposta: 'Respondeu no WhatsApp',
  visita_planos: 'Viu a página de planos', email_clique: 'Clicou em e-mail', visita_site: 'Visitou o site', email_aberto: 'Abriu e-mail',
};

export default function LeadDetalhe() {
  const { id } = useParams<{ id: string }>();
  const ir = useNavigate();
  const { time, perfil } = useSessao();
  const { ocupado, executar } = useAcao();
  const [lead, setLead] = useState<Lead | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [email, setEmail] = useState<DestinoEmail | null>(null);
  const [qualificar, setQualificar] = useState(false);
  const [editar, setEditar] = useState<Record<string, string | boolean> | null>(null);
  const [descartar, setDescartar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [tick, setTick] = useState(0);
  const [conta, setConta] = useState<ContaResumo | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [escolher, setEscolher] = useState(false);

  const carregar = useCallback(async () => {
    const [l, e] = await Promise.all([
      supabase.from('v_leads').select('*').eq('id', id!).maybeSingle(),
      supabase.from('eventos').select('id, nome, origem, criado_em').eq('lead_id', id!).order('criado_em', { ascending: false }).limit(50),
    ]);
    const ld = l.data as Lead | null;
    setLead(ld);
    setEventos((e.data ?? []) as Evento[]);
    if (!ld) return;
    if (ld.conta_id) {
      const c = await supabase.from('contas').select('id, nome, cnpj').eq('id', ld.conta_id).maybeSingle();
      setConta(c.data as ContaResumo | null);
      setSugestoes([]);
    } else {
      setConta(null);
      // empresas prováveis: mesmo CNPJ ou mesmo domínio de e-mail
      const s: Sugestao[] = [];
      if (ld.cnpj) {
        const c = await supabase.from('contas').select('id, nome, cnpj').eq('cnpj', ld.cnpj).maybeSingle();
        if (c.data) s.push({ conta: c.data as ContaResumo, motivo: 'mesmo CNPJ' });
      }
      const dom = dominioDoEmail(ld.email);
      if (dom) (await contasPorDominio(supabase, dom)).forEach((c) => { if (!s.some((x) => x.conta.id === c.id)) s.push({ conta: c, motivo: `mesmo domínio @${dom}` }); });
      setSugestoes(s);
    }
  }, [id]);
  useEffect(() => { carregar(); }, [carregar, tick]);

  if (!lead) return <Carregando />;

  const atualizar = (campos: Partial<Lead>, msg?: string) => executar(async () => {
    ok(await supabase.from('leads').update(campos).eq('id', lead.id));
    await carregar();
  }, msg);

  const vincular = (c: ContaResumo, motivo: string) => executar(async () => {
    await vincularLeadAConta(supabase, lead, c, { autor: perfil?.id, motivo, moverContato: true, converter: true });
    setEscolher(false);
    await carregar();
  }, `Vinculado(a) à empresa ${c.nome}`);

  const desvincular = () => executar(async () => {
    if (lead.contato_id) ok(await supabase.from('contatos').update({ conta_id: null }).eq('id', lead.contato_id));
    ok(await supabase.from('leads').update({ conta_id: null, contato_id: null }).eq('id', lead.id));
    await supabase.from('atividades').insert({ tipo: 'sistema', titulo: `Desvinculado(a) da empresa ${conta?.nome ?? ''}`.trim(), lead_id: lead.id, autor: perfil?.id });
    await carregar();
  }, 'Vínculo desfeito');

  const fazerQualificacao = () => executar(async () => {
    const r = await colocarNoFunil({ id: VENDAS, nome: 'Vendas Lumi' }, pessoaDeLead(lead), perfil?.id ?? null);
    if (r.link) ir(r.link);
    if (!r.ok) throw new Error(r.motivo);
  }, 'Negócio aberto no funil de vendas');

  const abrirEdicao = () => setEditar({
    nome: lead.nome, email: lead.email ?? '', whatsapp: lead.whatsapp ?? '', empresa: lead.empresa ?? '', cnpj: lead.cnpj ?? '',
    cargo: lead.cargo ?? '', colaboradores: lead.colaboradores ? String(lead.colaboradores) : '', origem: lead.origem, evento: lead.evento ?? '',
    mensagem: lead.mensagem ?? '', aceita_marketing: lead.aceita_marketing,
  });
  const salvarEdicao = () => executar(async () => {
    if (!editar) return;
    const t = (k: string) => String(editar[k] ?? '').trim();
    if (!t('nome')) throw new Error('Informe o nome');
    const cnpj = t('cnpj').replace(/\D/g, '');
    if (cnpj && !cnpjValido(cnpj)) throw new Error('CNPJ inválido');
    const marketing = !!editar.aceita_marketing;
    ok(await supabase.from('leads').update({
      nome: t('nome'), email: t('email').toLowerCase() || null, whatsapp: t('whatsapp').replace(/\D/g, '') || null, empresa: t('empresa') || null,
      cnpj: cnpj || null, cargo: t('cargo') || null, colaboradores: Number(t('colaboradores').replace(/\D/g, '')) || null,
      origem: t('origem') || 'outro', evento: t('evento') || null, mensagem: t('mensagem') || null, aceita_marketing: marketing,
      ...(marketing && !lead.aceita_marketing ? { consentimento_em: new Date().toISOString() } : {}),
    }).eq('id', lead.id));
    setEditar(null);
    await carregar();
  }, 'Dados do lead salvos');

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
                <button className="btn primario" onClick={() => setQualificar(true)}>Levar para o funil de vendas</button>
              </>}
        </div>
      </div>

      {espera != null && lead.status === 'novo' && (
        <div className={`aviso ${espera > 2 ? 'erro' : 'info'}`}>
          {espera > 2 ? `Esperando o primeiro contato há ${Math.floor(espera)}h úteis (meta: 2h).` : 'Lead novo: a meta é o primeiro contato em até 2h úteis.'}
        </div>
      )}
      {lead.status === 'descartado' && lead.motivo_descarte && <div className="aviso">Descartado: {lead.motivo_descarte}</div>}
      {lead.status === 'convertido' && <div className="aviso info">Esta pessoa foi mesclada{conta ? <> e agora é contato da <Link to={`/contas/${conta.id}`}>{conta.nome}</Link></> : ''}. Ela não aparece mais na lista de leads.</div>}

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h2>Empresa</h2>
              {!lead.oportunidade_id && <button className="btn pequeno" onClick={() => setEscolher(true)}>{conta ? 'Trocar' : 'Procurar empresa'}</button>}
            </div>
            {conta ? (
              <div style={{ marginTop: 8 }}>
                <Link to={`/contas/${conta.id}`}><strong>{conta.nome}</strong></Link>
                <div className="muted" style={{ fontSize: 13 }}>Esta pessoa aparece entre os contatos da empresa.{!lead.oportunidade_id && <> <button className="btn-texto em-linha" disabled={ocupado} onClick={desvincular}>Desvincular</button></>}</div>
              </div>
            ) : sugestoes.length > 0 ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {sugestoes.map((s) => (
                  <div key={s.conta.id} className="aviso info" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', margin: 0 }}>
                    <span style={{ flex: '1 1 180px' }}>Parece ser da <b>{s.conta.nome}</b> ({s.motivo}).</span>
                    <button className="btn pequeno primario" disabled={ocupado} onClick={() => vincular(s.conta, s.motivo)}>Vincular</button>
                  </div>
                ))}
              </div>
            ) : <p className="muted" style={{ marginTop: 8 }}>Ainda sem empresa. Vincule a uma empresa do CRM ou qualifique para criar uma nova.</p>}
          </div>

          <div className="cartao">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h2>Dados</h2>
              <button className="btn pequeno" onClick={abrirEdicao}>Editar</button>
            </div>
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

          <NosFunis filtro={{ coluna: 'lead_id', valor: lead.id }} base={{ titulo: lead.empresa || lead.nome, nome: lead.nome, email: lead.email, whatsapp: lead.whatsapp,
            empresa: lead.empresa, conta_id: lead.conta_id, contato_id: lead.contato_id, lead_id: lead.id, aceita_marketing: lead.aceita_marketing }} />

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

      <Modal titulo="Levar para o funil de vendas" aberto={qualificar} fechar={() => setQualificar(false)}
        rodape={<><button className="btn" onClick={() => setQualificar(false)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={fazerQualificacao}>Levar para o funil de vendas</button></>}>
        {conta
          ? <p>O negócio será aberto na empresa <b>{conta.nome}</b>, à qual esta pessoa já está vinculada.</p>
          : <p>Cria a empresa (ou usa a que já existe pelo CNPJ), o contato e o negócio na primeira etapa do funil de vendas. O plano e o valor entram depois, na proposta.</p>}
        {!conta && sugestoes.length > 0 && (
          <div className="aviso erro">Esta pessoa parece ser da <b>{sugestoes[0].conta.nome}</b> ({sugestoes[0].motivo}). Vincule antes de qualificar para não criar a empresa em dobro: <button className="btn-texto em-linha" disabled={ocupado} onClick={() => vincular(sugestoes[0].conta, sugestoes[0].motivo)}>vincular agora</button>.</div>
        )}
        <div className="aviso info">Antes de qualificar, confirme que existe uma dor ligada à NR-1 ou à saúde emocional do time e que a empresa tem porte para o Lumi.</div>

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

      <Modal titulo="Editar dados do lead" aberto={!!editar} fechar={() => setEditar(null)} largura={640}
        rodape={<><button className="btn" onClick={() => setEditar(null)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={salvarEdicao}>Salvar</button></>}>
        {editar && (() => {
          const campo = (k: string, rotulo: string, extra?: { tipo?: string; num?: boolean }) => (
            <Campo rotulo={rotulo}><input type={extra?.tipo ?? 'text'} inputMode={extra?.num ? 'numeric' : undefined} value={String(editar[k] ?? '')} onChange={(e) => setEditar({ ...editar, [k]: e.target.value })} /></Campo>
          );
          return (
            <>
              <div className="linha-campos">{campo('nome', 'Nome')}{campo('cargo', 'Cargo')}</div>
              <div className="linha-campos">{campo('email', 'E-mail', { tipo: 'email' })}{campo('whatsapp', 'WhatsApp')}</div>
              <div className="linha-campos">{campo('empresa', 'Empresa')}{campo('cnpj', 'CNPJ')}{campo('colaboradores', 'Colaboradores', { num: true })}</div>
              <div className="linha-campos">
                <Campo rotulo="Origem">
                  <select value={String(editar.origem)} onChange={(e) => setEditar({ ...editar, origem: e.target.value })}>
                    {['site', 'anuncios', 'indicacao', 'evento', 'linkedin', 'whatsapp', 'prospeccao', 'parceiro', 'manual', 'outro'].map((o) => <option key={o} value={o}>{nomeOrigem(o)}</option>)}
                  </select>
                </Campo>
                {campo('evento', 'Evento ou campanha')}
              </div>
              <Campo rotulo="Mensagem / contexto"><textarea value={String(editar.mensagem ?? '')} onChange={(e) => setEditar({ ...editar, mensagem: e.target.value })} /></Campo>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={!!editar.aceita_marketing} onChange={(e) => setEditar({ ...editar, aceita_marketing: e.target.checked })} />
                A pessoa autorizou receber conteúdos do Lumi
              </label>
            </>
          );
        })()}
      </Modal>
      <EnviarEmail destino={email} fechar={() => setEmail(null)} enviado={() => setTick((t) => t + 1)} />
      <EscolherConta titulo={`Empresa de ${lead.nome}`} aberto={escolher} fechar={() => setEscolher(false)} escolher={vincular}
        sugestoes={sugestoes} excluir={conta?.id} ocupado={ocupado}
        aviso={<div className="aviso info">A pessoa entra como contato da empresa escolhida, junto com os outros contatos dela. Se o e-mail já for contato de outra empresa, ele é trazido para esta.</div>} />
    </>
  );
}
