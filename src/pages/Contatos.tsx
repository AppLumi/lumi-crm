import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { PAPEIS_CONTATO, nomeOrigem, relativo, zapLink } from '../lib/formato';
import type { Contato } from '../lib/tipos';
import { Campo, Carregando, Modal, Selo, Vazio } from '../components/ui';
import { lerLista } from '../../shared/importacao';
import { dominioDoEmail, type ContaResumo } from '../../shared/empresas';
import EscolherConta from '../components/EscolherConta';
import MoverParaFunil from '../components/MoverParaFunil';
import { pessoaDeContato, type PessoaFunil } from '../lib/funis';
import { empresaPara, inserirContatos } from '../lib/contatos';

type Linha = Contato & { contas: { nome: string } | null };
const ORIGENS_CONTATO = ['prospeccao', 'prospeccao_clientes_grou', 'lista_fria', 'importacao', 'evento', 'linkedin', 'indicacao', 'parceiro', 'manual', 'outro'];
const vazio = { id: '', nome: '', cargo: '', papel: 'outro', email: '', whatsapp: '', linkedin: '', aceita_marketing: false, origem: 'manual', evento: '', dono: '', conta_id: '', conta_nome: '' };

export default function Contatos() {
  const { perfil, time } = useSessao();
  const { ocupado, executar } = useAcao();
  const [params, setParams] = useSearchParams();
  const [contatos, setContatos] = useState<Linha[] | null>(null);
  const [busca, setBusca] = useState('');
  const [origem, setOrigem] = useState('');
  const [listaF, setListaF] = useState(params.get('lista') ?? '');
  const [empresa, setEmpresa] = useState<'' | 'com' | 'sem'>('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [paraFunil, setParaFunil] = useState<PessoaFunil[] | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [form, setForm] = useState<typeof vazio | null>(null);
  const [trocarEmpresa, setTrocarEmpresa] = useState(false);
  const [csv, setCsv] = useState('');
  const [imp, setImp] = useState({ origem: 'prospeccao', evento: '' });
  const [resultado, setResultado] = useState('');

  const carregar = useCallback(async () => {
    // o Supabase devolve no máximo 1.000 linhas por vez: busca em páginas (listas importadas passam disso)
    const todos: Linha[] = [];
    for (let de = 0; de < 50000; de += 1000) {
      const r = await supabase.from('contatos').select('*, contas(nome)').order('criado_em', { ascending: false }).order('id').range(de, de + 999);
      if (r.error) break;
      todos.push(...((r.data ?? []) as Linha[]));
      if ((r.data ?? []).length < 1000) break;
    }
    setContatos(todos);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const listas = useMemo(() => [...new Set((contatos ?? []).map((c) => c.evento).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })) as string[], [contatos]);
  const origens = useMemo(() => [...new Set((contatos ?? []).map((c) => c.origem).filter(Boolean))].sort() as string[], [contatos]);
  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return (contatos ?? []).filter((c) => (!b || [c.nome, c.email, c.cargo, c.contas?.nome].some((x) => x?.toLowerCase().includes(b)))
      && (!origem || c.origem === origem) && (!listaF || c.evento === listaF) && (!empresa || (empresa === 'com' ? !!c.conta_id : !c.conta_id)));
  }, [contatos, busca, origem, listaF, empresa]);

  const alternar = (id: string) => setMarcados((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todos = lista.length > 0 && lista.every((c) => marcados.has(c.id));
  const selecionados = (contatos ?? []).filter((c) => marcados.has(c.id));

  const excluir = () => executar(async () => {
    const ids = [...marcados];
    for (let i = 0; i < ids.length; i += 200) ok(await supabase.from('contatos').delete().in('id', ids.slice(i, i + 200)));
    setMarcados(new Set()); setConfirmarExclusao(false);
    await carregar();
  }, `${marcados.size} contato(s) excluído(s)`);

  // ----- importação de listas (prospecção, frias): entram como contatos, não como leads -----
  const leitura = useMemo(() => lerLista(csv), [csv]);
  const importarAberto = params.get('importar') === '1';
  const fecharImportar = () => { params.delete('importar'); setParams(params, { replace: true }); };
  const importar = () => executar(async () => {
    if (!leitura.linhas.length) throw new Error('Nenhuma linha válida para importar');
    const emails = [...new Set(leitura.linhas.map((l) => l.email).filter(Boolean))] as string[];
    const existentes = new Set<string>();
    for (let i = 0; i < emails.length; i += 200) {
      const r = ok(await supabase.from('contatos').select('email').in('email', emails.slice(i, i + 200)));
      (r ?? []).forEach((x: { email: string | null }) => x.email && existentes.add(x.email.toLowerCase()));
    }
    const vistos = new Set<string>();
    const novas = leitura.linhas.filter((l) => {
      if (!l.email) return true;
      if (existentes.has(l.email) || vistos.has(l.email)) return false;
      vistos.add(l.email); return true;
    });
    const cache = new Map<string, string | null>();
    const linhas: Record<string, unknown>[] = [];
    for (const l of novas) {
      const contaId = await empresaPara({ empresa: l.empresa, email: l.email, colaboradores: l.colaboradores, origem: imp.origem, dono: perfil?.id }, cache);
      linhas.push({ conta_id: contaId, nome: l.nome, cargo: l.cargo ?? null, email: l.email ?? null, whatsapp: l.whatsapp ?? null, papel: 'outro',
        aceita_marketing: false, origem: imp.origem, evento: imp.evento.trim() || null, dono: perfil?.id ?? null });
    }
    let criados = 0;
    for (let i = 0; i < linhas.length; i += 200) criados += (await inserirContatos(linhas.slice(i, i + 200))).length;
    const rep = leitura.linhas.length - novas.length;
    const empresas = new Set([...cache.values()].filter(Boolean)).size;
    setResultado(`${criados} contato(s) importado(s) em ${empresas} empresa(s)${rep ? `, ${rep} já estavam no CRM` : ''}`);
    setCsv(''); fecharImportar();
    await carregar();
  }, 'Importação concluída');

  // ----- novo / editar contato -----
  const abrir = (c?: Linha) => setForm(c ? {
    id: c.id, nome: c.nome, cargo: c.cargo ?? '', papel: c.papel, email: c.email ?? '', whatsapp: c.whatsapp ?? '', linkedin: c.linkedin ?? '',
    aceita_marketing: c.aceita_marketing, origem: c.origem ?? 'manual', evento: c.evento ?? '', dono: c.dono ?? '', conta_id: c.conta_id ?? '', conta_nome: c.contas?.nome ?? '',
  } : { ...vazio, dono: perfil?.id ?? '' });
  const salvar = () => executar(async () => {
    if (!form) return;
    if (!form.nome.trim()) throw new Error('Informe o nome');
    const email = form.email.trim().toLowerCase() || null;
    if (email) {
      const { data: ja } = await supabase.from('contatos').select('id').ilike('email', email).neq('id', form.id || '00000000-0000-0000-0000-000000000000').maybeSingle();
      if (ja) throw new Error('Já existe um contato com esse e-mail');
    }
    const dados: Record<string, unknown> = {
      conta_id: form.conta_id || null, nome: form.nome.trim(), cargo: form.cargo.trim() || null, papel: form.papel, email,
      whatsapp: form.whatsapp.replace(/\D/g, '') || null, linkedin: form.linkedin.trim() || null, aceita_marketing: form.aceita_marketing,
      origem: form.origem || null, evento: form.evento.trim() || null, dono: form.dono || null,
    };
    if (form.id) {
      const r = await supabase.from('contatos').update(dados).eq('id', form.id);
      if (r.error) {
        if (!/origem|evento|dono/.test(r.error.message)) throw new Error(r.error.message);
        const { origem: _o, evento: _e, dono: _d, ...resto } = dados;
        ok(await supabase.from('contatos').update(resto).eq('id', form.id));
      }
    } else await inserirContatos([{ ...dados, consentimento_em: form.aceita_marketing ? new Date().toISOString() : null }]);
    setForm(null);
    await carregar();
  }, 'Contato salvo');
  const excluirUm = () => executar(async () => {
    if (!form?.id) return;
    ok(await supabase.from('contatos').delete().eq('id', form.id));
    setForm(null);
    await carregar();
  }, 'Contato excluído');

  return (
    <>
      <div className="topo">
        <div><h1>Contatos</h1><p>Pessoas das empresas: listas de prospecção, frias e importadas. Leads são só quem converteu ou foi cadastrado como lead.</p></div>
        <div className="acoes">
          <button className="btn" onClick={() => { params.set('importar', '1'); setParams(params); }}>Importar lista</button>
          <button className="btn primario" onClick={() => abrir()}>Novo contato</button>
        </div>
      </div>

      <div className="filtros">
        <input placeholder="Buscar nome, e-mail, cargo, empresa…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value="">Todas as origens</option>
          {origens.map((o) => <option key={o} value={o}>{nomeOrigem(o)}</option>)}
        </select>
        <select value={listaF} onChange={(e) => setListaF(e.target.value)}>
          <option value="">Todas as listas</option>
          {listas.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={empresa} onChange={(e) => setEmpresa(e.target.value as typeof empresa)}>
          <option value="">Com ou sem empresa</option>
          <option value="com">Com empresa</option>
          <option value="sem">Sem empresa</option>
        </select>
        <span className="muted">{lista.length} contato(s)</span>
      </div>

      {resultado && <div className="aviso ok" style={{ marginBottom: 14 }}>{resultado}. <button className="btn-texto" onClick={() => setResultado('')}>Fechar</button></div>}

      {marcados.size > 0 && (
        <div className="aviso info" style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 240px' }}><b>{marcados.size}</b> contato(s) selecionado(s){confirmarExclusao ? '. Não dá para desfazer.' : ''}</span>
          {confirmarExclusao
            ? <><button className="btn pequeno" onClick={() => setConfirmarExclusao(false)}>Cancelar</button><button className="btn pequeno perigo" disabled={ocupado} onClick={excluir}>Excluir {marcados.size} de vez</button></>
            : <><button className="btn pequeno" onClick={() => setMarcados(new Set())}>Limpar seleção</button>
                <button className="btn pequeno primario" onClick={() => setParaFunil(selecionados.map((c) => pessoaDeContato({ ...c, conta_nome: c.contas?.nome })))}>Colocar num funil</button>
                <button className="btn pequeno perigo" onClick={() => setConfirmarExclusao(true)}>Excluir</button></>}
        </div>
      )}

      {!contatos ? <Carregando /> : lista.length === 0 ? <Vazio>Nenhum contato com esses filtros. Importe uma lista de prospecção ou cadastre um contato.</Vazio> : (
        <div className="tabela-envolve">
          <table className="tabela">
            <thead><tr><th style={{ width: 34 }}><input type="checkbox" aria-label="Selecionar todos" checked={todos} onChange={() => setMarcados(todos ? new Set() : new Set(lista.map((c) => c.id)))} /></th>
              <th>Nome</th><th>Empresa</th><th>Contato</th><th>Origem</th><th className="num">Entrou</th></tr></thead>
            <tbody>
              {lista.slice(0, 500).map((c) => (
                <tr key={c.id} className="clicavel" onClick={() => abrir(c)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${c.nome}`} checked={marcados.has(c.id)} onChange={() => alternar(c.id)} /></td>
                  <td><strong>{c.nome}</strong><div className="muted">{c.cargo ?? ''}</div>{c.papel !== 'outro' && <Selo cor={c.papel === 'decisor' ? 'lima' : ''}>{PAPEIS_CONTATO[c.papel]}</Selo>}</td>
                  <td onClick={(e) => e.stopPropagation()}>{c.conta_id ? <Link to={`/contas/${c.conta_id}`}>{c.contas?.nome}</Link> : <span className="muted">sem empresa</span>}</td>
                  <td style={{ wordBreak: 'break-word' }}>{c.email ?? '—'}<div className="muted">{c.whatsapp ?? ''}</div>{c.descadastrado_em && <Selo cor="vermelho">descadastrado</Selo>}</td>
                  <td>{nomeOrigem(c.origem)}{c.evento ? <div className="muted">{c.evento}</div> : null}</td>
                  <td className="num">{c.criado_em ? relativo(c.criado_em) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lista.length > 500 && <p className="muted" style={{ padding: 12 }}>Mostrando 500 de {lista.length}. Use a busca ou os filtros.</p>}
        </div>
      )}

      <MoverParaFunil pessoas={paraFunil} fechar={() => setParaFunil(null)} concluido={() => setMarcados(new Set())} />

      <Modal titulo={form?.id ? 'Editar contato' : 'Novo contato'} aberto={!!form && !trocarEmpresa} fechar={() => setForm(null)} largura={640}
        rodape={<>{form?.id && <button className="btn perigo" style={{ marginRight: 'auto' }} disabled={ocupado} onClick={excluirUm}>Excluir</button>}
          {form?.id && <button className="btn" onClick={() => { const c = contatos?.find((x) => x.id === form.id); if (c) { setForm(null); setParaFunil([pessoaDeContato({ ...c, conta_nome: c.contas?.nome })]); } }}>Colocar num funil</button>}
          <button className="btn" onClick={() => setForm(null)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={salvar}>Salvar</button></>}>
        {form && (
          <>
            <div className="linha-campos">
              <Campo rotulo="Nome *"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoFocus={!form.id} /></Campo>
              <Campo rotulo="Cargo"><input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} /></Campo>
            </div>
            <div className="linha-campos">
              <Campo rotulo="E-mail"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Campo>
              <Campo rotulo="WhatsApp"><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Campo>
            </div>
            <div className="linha-campos">
              <Campo rotulo="LinkedIn"><input value={form.linkedin} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} /></Campo>
              <Campo rotulo="Papel na compra">
                <select value={form.papel} onChange={(e) => setForm({ ...form, papel: e.target.value })}>
                  {Object.entries(PAPEIS_CONTATO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Campo>
            </div>
            <Campo rotulo="Empresa">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ flex: 1 }}>{form.conta_nome || <span className="muted">sem empresa</span>}{form.email && !form.conta_id && dominioDoEmail(form.email) ? <span className="muted"> (dica: @{dominioDoEmail(form.email)})</span> : null}</span>
                <button type="button" className="btn pequeno" onClick={() => setTrocarEmpresa(true)}>{form.conta_id ? 'Trocar empresa' : 'Escolher empresa'}</button>
                {form.conta_id && <button type="button" className="btn pequeno" onClick={() => setForm({ ...form, conta_id: '', conta_nome: '' })}>Tirar da empresa</button>}
              </div>
            </Campo>
            <div className="linha-campos">
              <Campo rotulo="Origem">
                <select value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })}>
                  {ORIGENS_CONTATO.map((o) => <option key={o} value={o}>{nomeOrigem(o)}</option>)}
                </select>
              </Campo>
              <Campo rotulo="Lista, evento ou campanha"><input value={form.evento} onChange={(e) => setForm({ ...form, evento: e.target.value })} /></Campo>
              <Campo rotulo="Dono">
                <select value={form.dono} onChange={(e) => setForm({ ...form, dono: e.target.value })}>
                  <option value="">Sem dono</option>
                  {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </Campo>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.aceita_marketing} onChange={(e) => setForm({ ...form, aceita_marketing: e.target.checked })} />
              Autorizou receber conteúdos do Lumi
            </label>
            {form.id && zapLink(form.whatsapp) && <p style={{ marginTop: 10 }}><a href={zapLink(form.whatsapp)!} target="_blank" rel="noreferrer">Abrir WhatsApp</a></p>}
          </>
        )}
      </Modal>
      <EscolherConta titulo={`Empresa de ${form?.nome || 'contato'}`} aberto={trocarEmpresa} fechar={() => setTrocarEmpresa(false)} excluir={form?.conta_id || undefined} acao="Escolher"
        escolher={(c: ContaResumo) => { if (form) setForm({ ...form, conta_id: c.id, conta_nome: c.nome }); setTrocarEmpresa(false); }}
        aviso={<div className="aviso info">O contato passa para a empresa escolhida quando você salvar.</div>} />

      <Modal titulo="Importar lista de contatos" aberto={importarAberto} fechar={fecharImportar} largura={700}
        rodape={<><button className="btn" onClick={fecharImportar}>Cancelar</button><button className="btn primario" disabled={ocupado || !leitura.linhas.length} onClick={importar}>Importar {leitura.linhas.length || ''}</button></>}>
        <div className="aviso info">Listas de prospecção, frias ou de eventos entram como <b>contatos</b> (não como leads). Cole a planilha <b>com a linha de títulos</b> (Nome, E-mail, Celular ou WhatsApp, Empresa, Cargo, Colaboradores). Cada pessoa fica na sua empresa: a que já existe no CRM (mesmo nome ou domínio do e-mail) ou uma nova. Quem já é contato com o mesmo e-mail não é duplicado.</div>
        <div className="linha-campos">
          <Campo rotulo="Origem">
            <select value={imp.origem} onChange={(e) => setImp({ ...imp, origem: e.target.value })}>
              {ORIGENS_CONTATO.filter((o) => o !== 'manual').map((o) => <option key={o} value={o}>{nomeOrigem(o)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Nome da lista ou evento"><input value={imp.evento} onChange={(e) => setImp({ ...imp, evento: e.target.value })} placeholder="Ex.: Lista RH indústrias RS" /></Campo>
        </div>
        <Campo rotulo="Linhas"><textarea value={csv} onChange={(e) => setCsv(e.target.value)} style={{ minHeight: 160, fontFamily: 'monospace', fontSize: 12 }} /></Campo>
        {csv.trim() && (
          <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
            <div className="muted" style={{ fontSize: 13 }}><b>{leitura.linhas.length}</b> pronta(s) para importar{leitura.puladas.length ? `, ${leitura.puladas.length} pulada(s)` : ''}.</div>
            {leitura.linhas.length > 0 && (
              <div className="tabela-envolve">
                <table className="tabela">
                  <thead><tr><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Empresa</th><th>Cargo</th></tr></thead>
                  <tbody>{leitura.linhas.slice(0, 4).map((l, i) => <tr key={i}><td>{l.nome}</td><td>{l.email ?? '—'}</td><td>{l.whatsapp ?? '—'}</td><td>{l.empresa ?? '—'}</td><td>{l.cargo ?? '—'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {leitura.puladas.length > 0 && <div className="aviso erro" style={{ fontSize: 13 }}>Linhas puladas: {leitura.puladas.slice(0, 4).map((p) => `linha ${p.linha} (${p.motivo})`).join('; ')}{leitura.puladas.length > 4 ? ` e mais ${leitura.puladas.length - 4}` : ''}.</div>}
          </div>
        )}
      </Modal>
    </>
  );
}
