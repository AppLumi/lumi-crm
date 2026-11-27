import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { PAPEIS_CONTATO, brl, cnpjFmt, nomeEtapa, num, zapLink } from '../lib/formato';
import type { Conta, Contato, Oportunidade } from '../lib/tipos';
import { Campo, Carregando, Modal, Selo, Vazio } from '../components/ui';
import LinhaDoTempo from '../components/LinhaDoTempo';
import SalesCoachCartao from '../components/SalesCoachCartao';
import EnviarEmail, { type DestinoEmail } from '../components/EnviarEmail';
import { ESTAGIOS, type DadosCnpj } from './Contas';
import EscolherConta, { type Sugestao } from '../components/EscolherConta';
import NosFunis from '../components/NosFunis';
import MoverParaFunil from '../components/MoverParaFunil';
import { pessoaDeContato, type PessoaFunil } from '../lib/funis';
import { cnpjValido } from '../../shared/pontuacao';
import { contasPorDominio, dominioDoEmail, dominiosDaConta, vincularLeadAConta, type ContaResumo } from '../../shared/empresas';

interface Pessoa { tipo: 'lead' | 'contato'; id: string; nome: string; email: string | null; cargo: string | null; whatsapp: string | null;
  aceita_marketing: boolean; consentimento_em: string | null; contato_id: string | null; conta_id: string | null; conta_nome?: string | null }

const ORDEM_ESTAGIO = ['prospeccao', 'lead', 'ex_cliente', 'oportunidade', 'cliente'];
const literal = (t: string) => t.replace(/[\\%_,()]/g, ' ');

/** Leads e contatos que podem entrar nesta empresa: por domínio (sugestão) ou pela busca. */
async function procurarPessoas(contaId: string, filtro: { dominios?: string[]; busca?: string }): Promise<Pessoa[]> {
  const ou = filtro.busca
    ? [`nome.ilike.%${literal(filtro.busca)}%`, `email.ilike.%${literal(filtro.busca)}%`].join(',')
    : (filtro.dominios ?? []).map((d) => `email.ilike.%@${literal(d)}`).join(',');
  if (!ou) return [];
  const [l, c] = await Promise.all([
    supabase.from('leads').select('id, nome, email, cargo, whatsapp, aceita_marketing, consentimento_em, contato_id, conta_id').or(ou).is('oportunidade_id', null).limit(50),
    supabase.from('contatos').select('id, nome, email, cargo, whatsapp, aceita_marketing, consentimento_em, conta_id, contas(nome)').or(ou).limit(50),
  ]);
  const contatos: Pessoa[] = ((c.data ?? []) as unknown as (Pessoa & { contas: { nome: string } | null })[])
    .filter((x) => x.conta_id !== contaId)
    .map((x) => ({ ...x, tipo: 'contato', contato_id: x.id, conta_nome: x.contas?.nome ?? null }));
  const jaContato = new Set(contatos.map((x) => x.email?.toLowerCase()));
  const leads: Pessoa[] = ((l.data ?? []) as Pessoa[])
    .filter((x) => x.conta_id !== contaId && !jaContato.has(x.email?.toLowerCase()))
    .map((x) => ({ ...x, tipo: 'lead' }));
  const doDominio = (p: Pessoa) => !filtro.dominios || filtro.dominios.includes(dominioDoEmail(p.email) ?? '');
  return [...contatos, ...leads].filter(doDominio);
}

const contatoVazio = { id: '', nome: '', cargo: '', papel: 'outro', email: '', whatsapp: '', linkedin: '', aceita_marketing: false, conta_id: '' as string, conta_nome: '' as string };

export default function ContaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const ir = useNavigate();
  const { perfil, time } = useSessao();
  const { ocupado, executar } = useAcao();
  const [conta, setConta] = useState<Conta | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [ops, setOps] = useState<Oportunidade[]>([]);
  const [contato, setContato] = useState<typeof contatoVazio | null>(null);
  const [email, setEmail] = useState<DestinoEmail | null>(null);
  const [notas, setNotas] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [mesmoDominio, setMesmoDominio] = useState<Pessoa[]>([]);
  const [trazer, setTrazer] = useState(false);
  const [busca, setBusca] = useState('');
  const [achadas, setAchadas] = useState<Pessoa[]>([]);
  const [mesclar, setMesclar] = useState(false);
  const [destino, setDestino] = useState<ContaResumo | null>(null);
  const [parecidas, setParecidas] = useState<Sugestao[]>([]);
  const [editarConta, setEditarConta] = useState<Record<string, string> | null>(null);
  const [trocarEmpresa, setTrocarEmpresa] = useState(false);
  const [paraFunil, setParaFunil] = useState<PessoaFunil[] | null>(null);

  const carregar = useCallback(async () => {
    const [c, ct, o] = await Promise.all([
      supabase.from('contas').select('*').eq('id', id!).maybeSingle(),
      supabase.from('contatos').select('*').eq('conta_id', id!).order('nome'),
      supabase.from('v_oportunidades').select('*').eq('conta_id', id!).order('criado_em', { ascending: false }),
    ]);
    setConta(c.data as Conta | null);
    setContatos((ct.data ?? []) as Contato[]);
    setOps((o.data ?? []) as Oportunidade[]);
    const dominios = dominiosDaConta((c.data as Conta | null)?.site, ((ct.data ?? []) as Contato[]).map((x) => x.email));
    setMesmoDominio(dominios.length ? await procurarPessoas(id!, { dominios }) : []);
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const b = busca.trim();
    if (b.length < 2) { setAchadas([]); return; }
    const t = setTimeout(async () => setAchadas(await procurarPessoas(id!, { busca: b })), 250);
    return () => clearTimeout(t);
  }, [busca, id]);

  if (!conta) return <Carregando />;
  const dominios = dominiosDaConta(conta.site, contatos.map((c) => c.email));
  const resumo: ContaResumo = { id: conta.id, nome: conta.nome, cnpj: conta.cnpj };

  /** Traz uma pessoa para esta empresa: o contato muda de empresa; o lead vira contato daqui. */
  const vincularPessoa = async (p: Pessoa, motivo: string) => {
    if (p.tipo === 'lead') {
      await vincularLeadAConta(supabase, p, resumo, { autor: perfil?.id, motivo, moverContato: true, converter: true });
      return;
    }
    ok(await supabase.from('contatos').update({ conta_id: conta.id }).eq('id', p.id));
    // leads dessa pessoa que ainda não viraram oportunidade acompanham o contato
    await supabase.from('leads').update({ conta_id: conta.id }).eq('contato_id', p.id).is('oportunidade_id', null);
    await supabase.from('atividades').insert({ tipo: 'sistema', titulo: `${p.nome} vinculado(a) a esta empresa`,
      descricao: `${p.conta_nome ? `Veio da empresa ${p.conta_nome}. ` : ''}Motivo: ${motivo}.`, conta_id: conta.id, contato_id: p.id, autor: perfil?.id });
  };
  const trazerUma = (p: Pessoa, motivo: string) => executar(async () => { await vincularPessoa(p, motivo); await carregar(); setTick((t) => t + 1); }, `${p.nome} agora é contato da ${conta.nome}`);
  const trazerTodas = () => executar(async () => {
    for (const p of mesmoDominio) await vincularPessoa(p, `mesmo domínio @${dominioDoEmail(p.email)}`);
    await carregar(); setTick((t) => t + 1);
  }, `${mesmoDominio.length} pessoa(s) vinculada(s)`);

  const abrirMesclar = async () => {
    setDestino(null);
    const s: Sugestao[] = [];
    for (const d of dominios) (await contasPorDominio(supabase, d)).forEach((c) => { if (c.id !== conta.id && !s.some((x) => x.conta.id === c.id)) s.push({ conta: c, motivo: `mesmo domínio @${d}` }); });
    const primeira = conta.nome.trim().split(/\s+/)[0];
    if (primeira && primeira.length >= 3) {
      const { data } = await supabase.from('contas').select('id, nome, cnpj').ilike('nome', `%${literal(primeira)}%`).neq('id', conta.id).limit(5);
      ((data ?? []) as ContaResumo[]).forEach((c) => { if (!s.some((x) => x.conta.id === c.id)) s.push({ conta: c, motivo: 'nome parecido' }); });
    }
    setParecidas(s);
    setMesclar(true);
  };
  /** Mescla ESTA empresa na escolhida: tudo passa para lá e esta deixa de existir. */
  const fazerMescla = () => executar(async () => {
    if (!destino) return;
    const { data: alvo } = await supabase.from('contas').select('*').eq('id', destino.id).single();
    const a = alvo as Conta;
    for (const t of ['contatos', 'leads', 'oportunidades', 'atividades', 'eventos', 'emails'] as const) {
      ok(await supabase.from(t).update({ conta_id: a.id }).eq('conta_id', conta.id));
    }
    await supabase.from('funil_cards').update({ conta_id: a.id }).eq('conta_id', conta.id); // funis próprios (se a migração 0002 já rodou)
    // o destino herda o que não tinha
    const herda: Partial<Conta> = {};
    (['razao_social', 'cnae', 'setor', 'porte', 'colaboradores', 'cidade', 'uf', 'site', 'lumi_cliente_id', 'dono', 'origem'] as const)
      .forEach((k) => { if (a[k] == null && conta[k] != null) (herda as Record<string, unknown>)[k] = conta[k]; });
    if (conta.notas) herda.notas = [a.notas, `(de ${conta.nome}) ${conta.notas}`].filter(Boolean).join('\n\n');
    if (ORDEM_ESTAGIO.indexOf(conta.estagio) > ORDEM_ESTAGIO.indexOf(a.estagio)) herda.estagio = conta.estagio;
    const cnpj = !a.cnpj && conta.cnpj ? conta.cnpj : null;
    if (cnpj) ok(await supabase.from('contas').update({ cnpj: null }).eq('id', conta.id));
    ok(await supabase.from('contas').delete().eq('id', conta.id));
    if (cnpj) herda.cnpj = cnpj;
    if (Object.keys(herda).length) ok(await supabase.from('contas').update(herda).eq('id', a.id));
    await supabase.from('atividades').insert({ tipo: 'sistema', titulo: `Empresa ${conta.nome} mesclada nesta`,
      descricao: `${contatos.length} contato(s) e ${ops.length} oportunidade(s) vieram junto.`, conta_id: a.id, autor: perfil?.id });
    setMesclar(false);
    ir(`/contas/${a.id}`);
  }, `Empresas mescladas em ${destino?.nome ?? ''}`);

  const atualizar = (campos: Partial<Conta>, msg = 'Salvo') => executar(async () => {
    ok(await supabase.from('contas').update(campos).eq('id', conta.id));
    await carregar();
  }, msg);

  const atualizarCnpj = () => executar(async () => {
    if (!conta.cnpj) throw new Error('A conta não tem CNPJ');
    const d = await api<DadosCnpj>(`cnpj?cnpj=${conta.cnpj}`);
    ok(await supabase.from('contas').update({ razao_social: d.razao_social, cnae: d.cnae, setor: d.setor, porte: d.porte, cidade: d.municipio, uf: d.uf }).eq('id', conta.id));
    await carregar();
  }, 'Dados da Receita atualizados');

  const salvarContato = () => executar(async () => {
    if (!contato) return;
    if (!contato.nome.trim()) throw new Error('Informe o nome');
    const dados = {
      conta_id: contato.conta_id || conta.id, nome: contato.nome.trim(), cargo: contato.cargo.trim() || null, papel: contato.papel,
      email: contato.email.trim().toLowerCase() || null, whatsapp: contato.whatsapp.replace(/\D/g, '') || null,
      linkedin: contato.linkedin.trim() || null, aceita_marketing: contato.aceita_marketing,
    };
    if (contato.id) ok(await supabase.from('contatos').update(dados).eq('id', contato.id));
    else {
      if (dados.email) {
        const { data: ja } = await supabase.from('contatos').select('id, conta_id, contas(nome)').ilike('email', dados.email).maybeSingle();
        if (ja) throw new Error(ja.conta_id === conta.id ? 'Esse e-mail já é contato desta empresa' : `Esse e-mail já é contato de ${(ja as unknown as { contas: { nome: string } | null }).contas?.nome ?? 'outra empresa'}. Use “Vincular contato ou lead” para trazer a pessoa para cá`);
      }
      ok(await supabase.from('contatos').insert({ ...dados, consentimento_em: contato.aceita_marketing ? new Date().toISOString() : null }));
    }
    if (contato.id && contato.conta_id && contato.conta_id !== conta.id) {
      await supabase.from('leads').update({ conta_id: contato.conta_id }).eq('contato_id', contato.id).is('oportunidade_id', null);
      await supabase.from('atividades').insert({ tipo: 'sistema', titulo: `${dados.nome} passou para a empresa ${contato.conta_nome}`, conta_id: contato.conta_id, contato_id: contato.id, autor: perfil?.id });
    }
    setContato(null);
    await carregar();
  }, 'Contato salvo');

  const excluirContato = () => executar(async () => {
    if (!contato?.id) return;
    ok(await supabase.from('contatos').delete().eq('id', contato.id));
    setContato(null);
    await carregar();
  }, 'Contato excluído');

  const abrirEdicaoConta = () => setEditarConta({
    nome: conta.nome, razao_social: conta.razao_social ?? '', cnpj: conta.cnpj ?? '', cnae: conta.cnae ?? '', setor: conta.setor ?? '',
    porte: conta.porte ?? '', colaboradores: conta.colaboradores ? String(conta.colaboradores) : '', cidade: conta.cidade ?? '', uf: conta.uf ?? '',
    site: conta.site ?? '', origem: conta.origem ?? '', lumi_cliente_id: conta.lumi_cliente_id ?? '',
  });
  const salvarConta = () => executar(async () => {
    if (!editarConta) return;
    const t = (k: string) => (editarConta[k] ?? '').trim();
    if (!t('nome')) throw new Error('Informe o nome da empresa');
    const cnpj = t('cnpj').replace(/\D/g, '');
    if (cnpj && !cnpjValido(cnpj)) throw new Error('CNPJ inválido');
    if (cnpj && cnpj !== conta.cnpj) {
      const { data: outra } = await supabase.from('contas').select('id, nome').eq('cnpj', cnpj).neq('id', conta.id).maybeSingle();
      if (outra) throw new Error(`Esse CNPJ já é da empresa ${(outra as { nome: string }).nome}. Use “Mesclar empresa” para juntar as duas`);
    }
    ok(await supabase.from('contas').update({
      nome: t('nome'), razao_social: t('razao_social') || null, cnpj: cnpj || null, cnae: t('cnae') || null, setor: t('setor') || null,
      porte: t('porte') || null, colaboradores: Number(t('colaboradores').replace(/\D/g, '')) || null, cidade: t('cidade') || null,
      uf: t('uf').toUpperCase().slice(0, 2) || null, site: t('site') || null, origem: t('origem') || null, lumi_cliente_id: t('lumi_cliente_id') || null,
    }).eq('id', conta.id));
    setEditarConta(null);
    await carregar();
  }, 'Empresa salva');

  const novaOportunidade = () => executar(async () => {
    const r = ok(await supabase.from('oportunidades').insert({ conta_id: conta.id, titulo: `Lumi · ${conta.nome}`, vidas: conta.colaboradores, dono: perfil?.id }).select('id').single());
    if (conta.estagio === 'lead' || conta.estagio === 'prospeccao') await supabase.from('contas').update({ estagio: 'oportunidade' }).eq('id', conta.id);
    ir(`/oportunidades/${r!.id}`);
  }, 'Oportunidade criada');

  return (
    <>
      <div className="migalha"><Link to="/contas">Contas</Link> / {conta.nome}</div>
      <div className="topo">
        <div>
          <h1>{conta.nome}</h1>
          <p>{[conta.setor, conta.cidade && `${conta.cidade}/${conta.uf}`, conta.colaboradores && `${num(conta.colaboradores)} colaboradores`].filter(Boolean).join(' · ')} <Selo cor={ESTAGIOS[conta.estagio].cor}>{ESTAGIOS[conta.estagio].nome}</Selo></p>
        </div>
        <div className="acoes">
          <button className="btn" onClick={abrirMesclar}>Mesclar empresa</button>
          <button className="btn" onClick={() => setContato({ ...contatoVazio })}>Novo contato</button>
          <button className="btn primario" disabled={ocupado} onClick={novaOportunidade}>Nova oportunidade</button>
        </div>
      </div>

      <div className="detalhe">
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="cartao">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h2>Contatos {contatos.length > 0 && <span className="muted" style={{ fontWeight: 400 }}>({contatos.length})</span>}</h2>
              <button className="btn pequeno" onClick={() => { setBusca(''); setTrazer(true); }}>Vincular contato ou lead</button>
            </div>
            {mesmoDominio.length > 0 && (
              <div className="aviso info" style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ flex: '1 1 260px' }}><b>{mesmoDominio.length}</b> pessoa(s) com e-mail {dominios.map((d) => `@${d}`).join(' ou ')} ainda fora desta empresa.</span>
                  <button className="btn pequeno primario" disabled={ocupado} onClick={trazerTodas}>Vincular todas</button>
                </div>
                {mesmoDominio.slice(0, 6).map((p) => (
                  <div key={p.tipo + p.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                    <span style={{ flex: '1 1 220px' }}>{p.nome} · {p.email} <span className="muted">({p.tipo === 'lead' ? 'lead' : p.conta_nome ? `contato de ${p.conta_nome}` : 'contato sem empresa'})</span></span>
                    <button className="btn pequeno" disabled={ocupado} onClick={() => trazerUma(p, `mesmo domínio @${dominioDoEmail(p.email)}`)}>Vincular</button>
                  </div>
                ))}
                {mesmoDominio.length > 6 && <span className="muted" style={{ fontSize: 13 }}>e mais {mesmoDominio.length - 6}.</span>}
              </div>
            )}
            {contatos.length === 0 ? <Vazio>Nenhum contato. Cadastre quem decide e quem usa o painel.</Vazio> : (
              <table className="tabela" style={{ marginTop: 8 }}><tbody>
                {contatos.map((c) => (
                  <tr key={c.id}>
                    <td style={{ minWidth: 0 }}><strong>{c.nome}</strong><div className="muted">{c.cargo ?? ''}</div></td>
                    <td><Selo cor={c.papel === 'decisor' ? 'lima' : ''}>{PAPEIS_CONTATO[c.papel]}</Selo>{c.descadastrado_em && <Selo cor="vermelho">descadastrado</Selo>}</td>
                    <td style={{ wordBreak: 'break-word' }}>{c.email ?? '—'}<div className="muted">{c.whatsapp ?? ''}</div></td>
                    <td className="num"><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                      {c.email && !c.descadastrado_em && <button className="btn pequeno" onClick={() => setEmail({ para: c.email!, nome: c.nome, empresa: conta.nome, contato_id: c.id, conta_id: conta.id })}>E-mail</button>}
                      {zapLink(c.whatsapp) && <a className="btn pequeno" href={zapLink(c.whatsapp)!} target="_blank" rel="noreferrer">WhatsApp</a>}
                      <button className="btn pequeno" onClick={() => setParaFunil([pessoaDeContato({ ...c, conta_nome: conta.nome })])}>Funil</button>
                      <button className="btn pequeno" onClick={() => setContato({ id: c.id, nome: c.nome, cargo: c.cargo ?? '', papel: c.papel, email: c.email ?? '', whatsapp: c.whatsapp ?? '', linkedin: c.linkedin ?? '', aceita_marketing: c.aceita_marketing, conta_id: conta.id, conta_nome: conta.nome })}>Editar</button>
                    </div></td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </div>

          <div className="cartao">
            <h2>Oportunidades</h2>
            {ops.length === 0 ? <Vazio>Nenhuma oportunidade.</Vazio> : (
              <table className="tabela" style={{ marginTop: 8 }}><tbody>
                {ops.map((o) => (
                  <tr key={o.id} className="clicavel" onClick={() => ir(`/oportunidades/${o.id}`)}>
                    <td><strong>{o.titulo}</strong><div className="muted">{o.dono_nome ?? ''}</div></td>
                    <td><Selo cor={o.etapa === 'ganha' ? 'verde' : o.etapa === 'perdida' ? 'vermelho' : 'azul'}>{nomeEtapa(o.etapa)}</Selo></td>
                    <td className="num">{o.valor_mensal ? `${brl(Number(o.valor_mensal))}/mês` : '—'}</td>
                  </tr>
                ))}
              </tbody></table>
            )}
          </div>

          <LinhaDoTempo alvo={{ conta_id: conta.id }} filtro={{ coluna: 'conta_id', valor: conta.id }} atualizar={tick} />
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <div className="cartao">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Cadastro</h2>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {conta.cnpj && <button className="btn pequeno" disabled={ocupado} onClick={atualizarCnpj}>Atualizar da Receita</button>}
                <button className="btn pequeno" onClick={abrirEdicaoConta}>Editar</button>
              </div>
            </div>
            <dl className="dados" style={{ marginTop: 10 }}>
              <dt>CNPJ</dt><dd>{cnpjFmt(conta.cnpj)}</dd>
              <dt>Razão social</dt><dd>{conta.razao_social ?? '—'}</dd>
              <dt>Atividade</dt><dd>{conta.cnae ? `${conta.cnae} · ${conta.setor ?? ''}` : '—'}</dd>
              <dt>Porte</dt><dd>{conta.porte ?? '—'}</dd>
              <dt>Cidade</dt><dd>{conta.cidade ? `${conta.cidade}${conta.uf ? `/${conta.uf}` : ''}` : '—'}</dd>
              <dt>Colaboradores</dt>
              <dd><input inputMode="numeric" defaultValue={conta.colaboradores ?? ''} onBlur={(e) => {
                const v = Number(e.target.value.replace(/\D/g, '')) || null;
                if (v !== conta.colaboradores) atualizar({ colaboradores: v });
              }} /></dd>
              <dt>Site</dt>
              <dd><input defaultValue={conta.site ?? ''} placeholder="acme.com.br" onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== conta.site) atualizar({ site: v });
              }} /></dd>
              <dt>Domínio</dt><dd>{dominios.length ? dominios.map((d) => `@${d}`).join(', ') : <span className="muted">preencha o site para achar as pessoas da empresa pelo e-mail</span>}</dd>
              <dt>Estágio</dt>
              <dd>
                <select value={conta.estagio} onChange={(e) => atualizar({ estagio: e.target.value as Conta['estagio'] })}>
                  {Object.entries(ESTAGIOS).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
                </select>
              </dd>
              <dt>Dono</dt>
              <dd>
                <select value={conta.dono ?? ''} onChange={(e) => atualizar({ dono: e.target.value || null })}>
                  <option value="">Sem dono</option>
                  {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </dd>
              <dt>ID no admin Lumi</dt>
              <dd><input defaultValue={conta.lumi_cliente_id ?? ''} placeholder="preencher na implantação" onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== conta.lumi_cliente_id) atualizar({ lumi_cliente_id: v });
              }} /></dd>
            </dl>
          </div>
          <NosFunis filtro={{ coluna: 'conta_id', valor: conta.id }} base={{ titulo: conta.nome, empresa: conta.nome, conta_id: conta.id }} />
          <SalesCoachCartao contaId={conta.id} />

          <div className="cartao">
            <h2>Notas da conta</h2>
            <textarea style={{ marginTop: 8, minHeight: 120 }} value={notas ?? conta.notas ?? ''} onChange={(e) => setNotas(e.target.value)} placeholder="Contexto que todo o time precisa saber" />
            {notas !== null && notas !== (conta.notas ?? '') && (
              <div className="acoes" style={{ marginTop: 6 }}><button className="btn pequeno primario" onClick={() => { atualizar({ notas: notas.trim() || null }); setNotas(null); }}>Salvar notas</button></div>
            )}
          </div>
        </div>
      </div>

      <Modal titulo={contato?.id ? 'Editar contato' : 'Novo contato'} aberto={!!contato && !trocarEmpresa} fechar={() => setContato(null)}
        rodape={<>{contato?.id && <button className="btn perigo" style={{ marginRight: 'auto' }} disabled={ocupado} onClick={excluirContato}>Excluir contato</button>}<button className="btn" onClick={() => setContato(null)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={salvarContato}>Salvar</button></>}>
        {contato && (
          <>
            <div className="linha-campos">
              <Campo rotulo="Nome"><input value={contato.nome} onChange={(e) => setContato({ ...contato, nome: e.target.value })} /></Campo>
              <Campo rotulo="Cargo"><input value={contato.cargo} onChange={(e) => setContato({ ...contato, cargo: e.target.value })} /></Campo>
            </div>
            <Campo rotulo="Papel na compra">
              <select value={contato.papel} onChange={(e) => setContato({ ...contato, papel: e.target.value })}>
                {Object.entries(PAPEIS_CONTATO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
            <div className="linha-campos">
              <Campo rotulo="E-mail"><input type="email" value={contato.email} onChange={(e) => setContato({ ...contato, email: e.target.value })} /></Campo>
              <Campo rotulo="WhatsApp"><input value={contato.whatsapp} onChange={(e) => setContato({ ...contato, whatsapp: e.target.value })} /></Campo>
            </div>
            <Campo rotulo="LinkedIn"><input value={contato.linkedin} onChange={(e) => setContato({ ...contato, linkedin: e.target.value })} /></Campo>
            {contato.id && (
              <Campo rotulo="Empresa">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ flex: 1 }}>{contato.conta_nome || conta.nome}</span>
                  <button type="button" className="btn pequeno" onClick={() => setTrocarEmpresa(true)}>Trocar empresa</button>
                </div>
              </Campo>
            )}
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={contato.aceita_marketing} onChange={(e) => setContato({ ...contato, aceita_marketing: e.target.checked })} />
              Autorizou receber conteúdos do Lumi
            </label>
          </>
        )}
      </Modal>
      <EnviarEmail destino={email} fechar={() => setEmail(null)} enviado={() => setTick((t) => t + 1)} />
      <EscolherConta titulo={`Empresa de ${contato?.nome ?? ''}`} aberto={trocarEmpresa} fechar={() => setTrocarEmpresa(false)} excluir={contato?.conta_id || conta.id}
        escolher={(c) => { if (contato) setContato({ ...contato, conta_id: c.id, conta_nome: c.nome }); setTrocarEmpresa(false); }} acao="Escolher"
        aviso={<div className="aviso info">O contato passa para a empresa escolhida quando você salvar.</div>} />
      <MoverParaFunil pessoas={paraFunil} fechar={() => setParaFunil(null)} concluido={carregar} />
      <Modal titulo="Editar empresa" aberto={!!editarConta} fechar={() => setEditarConta(null)} largura={700}
        rodape={<><button className="btn" onClick={() => setEditarConta(null)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={salvarConta}>Salvar</button></>}>
        {editarConta && (() => {
          const campo = (k: string, rotulo: string, ph?: string) => (
            <Campo rotulo={rotulo}><input value={editarConta[k] ?? ''} placeholder={ph} onChange={(e) => setEditarConta({ ...editarConta, [k]: e.target.value })} /></Campo>
          );
          return (
            <>
              <div className="linha-campos">{campo('nome', 'Nome')}{campo('razao_social', 'Razão social')}</div>
              <div className="linha-campos">{campo('cnpj', 'CNPJ')}{campo('colaboradores', 'Colaboradores')}{campo('porte', 'Porte')}</div>
              <div className="linha-campos">{campo('cnae', 'CNAE')}{campo('setor', 'Atividade / setor')}</div>
              <div className="linha-campos">{campo('cidade', 'Cidade')}{campo('uf', 'UF')}{campo('site', 'Site', 'acme.com.br')}</div>
              <div className="linha-campos">{campo('origem', 'Origem')}{campo('lumi_cliente_id', 'ID no admin Lumi')}</div>
            </>
          );
        })()}
      </Modal>

      <Modal titulo={`Vincular pessoa à ${conta.nome}`} aberto={trazer} fechar={() => setTrazer(false)} largura={640}>
        <div className="aviso info">Procure um lead ou um contato de outra empresa. Ele passa a ser contato desta empresa, junto com os outros.</div>
        <input placeholder="Nome ou e-mail…" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
        {busca.trim().length >= 2 && (achadas.length === 0 ? <p className="muted" style={{ marginTop: 10 }}>Ninguém encontrado fora desta empresa.</p> : (
          <table className="tabela" style={{ marginTop: 8 }}><tbody>
            {achadas.map((p) => (
              <tr key={p.tipo + p.id}>
                <td><strong>{p.nome}</strong><div className="muted">{[p.email, p.tipo === 'lead' ? 'lead' : p.conta_nome ? `contato de ${p.conta_nome}` : 'contato sem empresa'].filter(Boolean).join(' · ')}</div></td>
                <td className="num"><button className="btn pequeno primario" disabled={ocupado} onClick={() => trazerUma(p, 'vínculo manual')}>Vincular</button></td>
              </tr>
            ))}
          </tbody></table>
        ))}
      </Modal>

      <EscolherConta titulo={`Mesclar ${conta.nome} em outra empresa`} aberto={mesclar && !destino} fechar={() => setMesclar(false)}
        escolher={(c) => setDestino(c)} sugestoes={parecidas} excluir={conta.id} acao="Escolher"
        aviso={<div className="aviso info">Use quando a mesma empresa foi cadastrada duas vezes. Escolha a empresa que fica: contatos, leads, oportunidades e histórico desta vão para ela.</div>} />
      <Modal titulo="Confirmar mescla" aberto={mesclar && !!destino} fechar={() => setDestino(null)}
        rodape={<><button className="btn" onClick={() => setDestino(null)}>Voltar</button><button className="btn primario" disabled={ocupado} onClick={fazerMescla}>Mesclar em {destino?.nome}</button></>}>
        <p><b>{conta.nome}</b> vai ser juntada a <b>{destino?.nome}</b>: {contatos.length} contato(s), {ops.length} oportunidade(s), os leads e todo o histórico passam para lá, e o que {destino?.nome} não tiver preenchido (CNPJ, site, porte…) vem desta.</p>
        <div className="aviso erro">Depois disso, {conta.nome} deixa de existir. Não dá para desfazer.</div>
      </Modal>
    </>
  );
}
