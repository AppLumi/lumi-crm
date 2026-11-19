import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { STATUS_LEAD, nomeOrigem, relativo } from '../lib/formato';
import type { Lead, StatusLead } from '../lib/tipos';
import { Campo, Carregando, Modal, Nota, Selo, Vazio } from '../components/ui';
import { cnpjValido, notaPerfil } from '../../shared/pontuacao';
import { lerLista, nomeSuspeito } from '../../shared/importacao';
import DisparoEmail from '../components/DisparoEmail';

const vazio = { nome: '', email: '', whatsapp: '', empresa: '', cnpj: '', cargo: '', colaboradores: '', origem: 'indicacao', evento: '', mensagem: '', aceita_marketing: false };

export default function Leads() {
  const { perfil, time } = useSessao();
  const { ocupado, executar } = useAcao();
  const ir = useNavigate();
  const [params, setParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [status, setStatus] = useState<StatusLead | 'abertos' | 'todos'>('abertos');
  const [busca, setBusca] = useState('');
  const [origem, setOrigem] = useState('');
  const [dono, setDono] = useState('');
  const [ordem, setOrdem] = useState<'recentes' | 'nota'>('recentes');
  const [novo, setNovo] = useState(vazio);
  const [importar, setImportar] = useState(false);
  const [csv, setCsv] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [disparo, setDisparo] = useState<Lead[] | null>(null);

  const carregar = useCallback(async () => {
    let q = supabase.from('v_leads').select('*').order('criado_em', { ascending: false }).limit(1000);
    if (status === 'abertos') q = q.in('status', ['novo', 'em_contato', 'nutricao']);
    else if (status !== 'todos') q = q.eq('status', status);
    const r = await q;
    setLeads((r.data ?? []) as Lead[]);
  }, [status]);
  useEffect(() => { carregar(); }, [carregar]);

  const origens = useMemo(() => [...new Set((leads ?? []).map((l) => l.origem))].sort(), [leads]);
  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    const r = (leads ?? []).filter((l) =>
      (!b || [l.nome, l.email, l.empresa, l.cargo].some((x) => x?.toLowerCase().includes(b)))
      && (!origem || l.origem === origem) && (!dono || (dono === 'sem' ? !l.dono : l.dono === dono)));
    return ordem === 'nota' ? [...r].sort((a, c) => c.nota_perfil + c.nota_interesse - a.nota_perfil - a.nota_interesse) : r;
  }, [leads, busca, origem, dono, ordem]);

  const fecharNovo = () => { params.delete('novo'); setParams(params, { replace: true }); setNovo(vazio); };
  const criar = () => executar(async () => {
    if (!novo.nome.trim() || (!novo.email.trim() && !novo.whatsapp.trim())) throw new Error('Informe nome e e-mail ou WhatsApp');
    const cnpj = novo.cnpj.replace(/\D/g, '');
    if (cnpj && !cnpjValido(cnpj)) throw new Error('CNPJ inválido');
    const colab = Number(novo.colaboradores.replace(/\D/g, '')) || null;
    const whatsapp = novo.whatsapp.replace(/\D/g, '') || null;
    const r = ok(await supabase.from('leads').insert({
      nome: novo.nome.trim(), email: novo.email.trim().toLowerCase() || null, whatsapp, empresa: novo.empresa.trim() || null,
      cnpj: cnpj || null, cargo: novo.cargo.trim() || null, colaboradores: colab, origem: novo.origem, evento: novo.evento.trim() || null,
      mensagem: novo.mensagem.trim() || null, aceita_marketing: novo.aceita_marketing,
      consentimento_em: novo.aceita_marketing ? new Date().toISOString() : null, dono: perfil?.id,
      nota_perfil: notaPerfil({ colaboradores: colab, cargo: novo.cargo, cnpjValido: !!cnpj, temWhatsapp: !!whatsapp }),
    }).select('id').single());
    fecharNovo();
    ir(`/leads/${r!.id}`);
  }, 'Lead criado');

  // importação de lista (evento, feira): lê os títulos da planilha; sem títulos, usa nome;email;whatsapp;empresa;cargo;colaboradores
  const leitura = useMemo(() => lerLista(csv), [csv]);
  const [importados, setImportados] = useState('');
  const importarCsv = () => executar(async () => {
    if (!leitura.linhas.length) throw new Error('Nenhuma linha válida para importar');
    // não duplica quem já está no CRM com o mesmo e-mail
    const emails = [...new Set(leitura.linhas.map((l) => l.email).filter(Boolean))] as string[];
    const existentes = new Set<string>();
    for (let i = 0; i < emails.length; i += 200) {
      const r = ok(await supabase.from('leads').select('email').in('email', emails.slice(i, i + 200)));
      (r ?? []).forEach((x: { email: string | null }) => x.email && existentes.add(x.email.toLowerCase()));
    }
    const vistos = new Set<string>();
    const novos = leitura.linhas.filter((l) => {
      if (!l.email) return true;
      if (existentes.has(l.email) || vistos.has(l.email)) return false;
      vistos.add(l.email); return true;
    });
    const linhas = novos.map((l) => ({ ...l, origem: novo.origem || 'evento', evento: novo.evento || null, dono: perfil?.id,
      nota_perfil: notaPerfil({ colaboradores: l.colaboradores, cargo: l.cargo ?? undefined, temWhatsapp: !!l.whatsapp }) }));
    for (let i = 0; i < linhas.length; i += 200) ok(await supabase.from('leads').insert(linhas.slice(i, i + 200)));
    const rep = leitura.linhas.length - novos.length;
    setImportados(`${novos.length} lead(s) importado(s)${rep ? `, ${rep} já estavam no CRM` : ''}`);
    setImportar(false); setCsv('');
    await carregar();
  }, 'Importação concluída');

  // seleção em massa e exclusão
  const suspeitos = useMemo(() => (leads ?? []).filter((l) => nomeSuspeito(l.nome)), [leads]);
  const alternar = (id: string) => setMarcados((m) => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todosMarcados = lista.length > 0 && lista.every((l) => marcados.has(l.id));
  const marcarTodos = () => setMarcados(todosMarcados ? new Set() : new Set(lista.map((l) => l.id)));
  const excluir = () => executar(async () => {
    const ids = [...marcados];
    for (let i = 0; i < ids.length; i += 200) ok(await supabase.from('leads').delete().in('id', ids.slice(i, i + 200)));
    setMarcados(new Set()); setConfirmarExclusao(false);
    await carregar();
  }, `${marcados.size} lead(s) excluído(s)`);

  return (
    <>
      <div className="topo">
        <div><h1>Leads</h1><p>Toda entrada nova: site, eventos, indicações e listas.</p></div>
        <div className="acoes">
          <button className="btn" onClick={() => setImportar(true)}>Importar lista</button>
          <button className="btn primario" onClick={() => { params.set('novo', '1'); setParams(params); }}>Novo lead</button>
        </div>
      </div>

      <div className="filtros">
        <input placeholder="Buscar nome, e-mail, empresa…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="abertos">Abertos</option>
          {Object.entries(STATUS_LEAD).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
          <option value="todos">Todos</option>
        </select>
        <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value="">Todas as origens</option>
          {origens.map((o) => <option key={o} value={o}>{nomeOrigem(o)}</option>)}
        </select>
        <select value={dono} onChange={(e) => setDono(e.target.value)}>
          <option value="">Qualquer dono</option>
          <option value="sem">Sem dono</option>
          {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)}>
          <option value="recentes">Mais recentes</option>
          <option value="nota">Maior nota</option>
        </select>
        <span className="muted">{lista.length} lead(s)</span>
      </div>

      {importados ? <div className="aviso ok" style={{ marginBottom: 14 }}>{importados}. <button className="btn-texto" onClick={() => setImportados('')}>Fechar</button></div> : null}

      {suspeitos.length > 0 && (
        <div className="aviso erro" style={{ marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 320px' }}><b>{suspeitos.length} lead(s) entraram com as colunas trocadas</b>: o nome ficou com uma data (ex.: "{suspeitos[0].nome}"). Selecione, exclua e importe a planilha de novo.</span>
          <button className="btn pequeno" onClick={() => { setBusca(''); setOrigem(''); setDono(''); setMarcados(new Set(suspeitos.map((l) => l.id))); setConfirmarExclusao(false); }}>Selecionar esses {suspeitos.length}</button>
        </div>
      )}

      {marcados.size > 0 && (
        <div className="aviso info" style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 240px' }}><b>{marcados.size}</b> lead(s) selecionado(s){confirmarExclusao ? '. A exclusão apaga também o histórico desses leads e não dá para desfazer.' : ''}</span>
          {confirmarExclusao
            ? <><button className="btn pequeno" onClick={() => setConfirmarExclusao(false)}>Cancelar</button><button className="btn pequeno perigo" disabled={ocupado} onClick={excluir}>Excluir {marcados.size} de vez</button></>
            : <><button className="btn pequeno" onClick={() => setMarcados(new Set())}>Limpar seleção</button><button className="btn pequeno primario" onClick={() => setDisparo((leads ?? []).filter((l) => marcados.has(l.id)))}>Enviar e-mail para {marcados.size}</button><button className="btn pequeno perigo" onClick={() => setConfirmarExclusao(true)}>Excluir selecionados</button></>}
        </div>
      )}

      {!leads ? <Carregando /> : lista.length === 0 ? <Vazio>Nenhum lead com esses filtros.</Vazio> : (
        <div className="tabela-envolve">
          <table className="tabela">
            <thead><tr><th style={{ width: 34 }}><input type="checkbox" aria-label="Selecionar todos" checked={todosMarcados} onChange={marcarTodos} /></th><th>Nome</th><th>Empresa</th><th>Origem</th><th>Perfil</th><th>Interesse</th><th>Status</th><th>Dono</th><th className="num">Entrou</th></tr></thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.id} className="clicavel" onClick={() => ir(`/leads/${l.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Selecionar ${l.nome}`} checked={marcados.has(l.id)} onChange={() => alternar(l.id)} /></td>
                  <td><strong>{l.nome}</strong><div className="muted">{l.cargo ?? l.email ?? ''}</div></td>
                  <td>{l.empresa ?? '—'}{l.colaboradores ? <div className="muted">{l.colaboradores} colab.</div> : l.enriquecimento?.porte_informado ? <div className="muted">{l.enriquecimento.porte_informado} colab.</div> : null}</td>
                  <td>{nomeOrigem(l.origem)}{l.utm_campaign ? <div className="muted">{l.utm_campaign}</div> : null}</td>
                  <td><Nota valor={l.nota_perfil} /></td>
                  <td><Nota valor={l.nota_interesse} /></td>
                  <td><Selo cor={STATUS_LEAD[l.status].cor}>{STATUS_LEAD[l.status].nome}</Selo></td>
                  <td>{l.dono_nome ?? <span className="muted">—</span>}</td>
                  <td className="num">{relativo(l.criado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {disparo && <DisparoEmail leads={disparo} fechar={() => setDisparo(null)} enviado={() => { setMarcados(new Set()); carregar(); }} />}

      <Modal titulo="Novo lead" aberto={params.get('novo') === '1'} fechar={fecharNovo} largura={640}
        rodape={<><button className="btn" onClick={fecharNovo}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={criar}>Criar lead</button></>}>
        <div className="linha-campos">
          <Campo rotulo="Nome *"><input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} autoFocus /></Campo>
          <Campo rotulo="Cargo"><input value={novo.cargo} onChange={(e) => setNovo({ ...novo, cargo: e.target.value })} /></Campo>
        </div>
        <div className="linha-campos">
          <Campo rotulo="E-mail"><input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></Campo>
          <Campo rotulo="WhatsApp"><input value={novo.whatsapp} onChange={(e) => setNovo({ ...novo, whatsapp: e.target.value })} placeholder="DDD + número" /></Campo>
        </div>
        <div className="linha-campos">
          <Campo rotulo="Empresa"><input value={novo.empresa} onChange={(e) => setNovo({ ...novo, empresa: e.target.value })} /></Campo>
          <Campo rotulo="CNPJ"><input value={novo.cnpj} onChange={(e) => setNovo({ ...novo, cnpj: e.target.value })} /></Campo>
          <Campo rotulo="Colaboradores"><input inputMode="numeric" value={novo.colaboradores} onChange={(e) => setNovo({ ...novo, colaboradores: e.target.value })} /></Campo>
        </div>
        <div className="linha-campos">
          <Campo rotulo="Origem">
            <select value={novo.origem} onChange={(e) => setNovo({ ...novo, origem: e.target.value })}>
              {['indicacao', 'evento', 'linkedin', 'whatsapp', 'prospeccao', 'parceiro', 'site', 'outro'].map((o) => <option key={o} value={o}>{nomeOrigem(o)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Evento ou campanha"><input value={novo.evento} onChange={(e) => setNovo({ ...novo, evento: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Contexto"><textarea value={novo.mensagem} onChange={(e) => setNovo({ ...novo, mensagem: e.target.value })} placeholder="Como chegou, o que pediu…" /></Campo>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={novo.aceita_marketing} onChange={(e) => setNovo({ ...novo, aceita_marketing: e.target.checked })} />
          A pessoa autorizou receber conteúdos do Lumi
        </label>
      </Modal>

      <Modal titulo="Importar lista de leads" aberto={importar} fechar={() => setImportar(false)} largura={700}
        rodape={<><button className="btn" onClick={() => setImportar(false)}>Cancelar</button><button className="btn primario" disabled={ocupado || !leitura.linhas.length} onClick={importarCsv}>Importar {leitura.linhas.length || ''}</button></>}>
        <div className="aviso info">Cole a planilha <b>com a linha de títulos</b> (Nome, E-mail, Celular ou WhatsApp, Empresa, Cargo, Colaboradores): as colunas são achadas pelo título, em qualquer ordem, e as outras são ignoradas. Sem títulos, a ordem é <b>nome; e-mail; WhatsApp; empresa; cargo; colaboradores</b>. Quem já está no CRM com o mesmo e-mail não é duplicado. Só importe quem deu o contato para falar sobre o Lumi.</div>
        <div className="linha-campos">
          <Campo rotulo="Origem">
            <select value={novo.origem} onChange={(e) => setNovo({ ...novo, origem: e.target.value })}>
              {['evento', 'indicacao', 'parceiro', 'linkedin', 'outro'].map((o) => <option key={o} value={o}>{nomeOrigem(o)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Evento ou campanha"><input value={novo.evento} onChange={(e) => setNovo({ ...novo, evento: e.target.value })} placeholder="Ex.: Café NR-1 Curitiba" /></Campo>
        </div>
        <Campo rotulo="Linhas"><textarea value={csv} onChange={(e) => setCsv(e.target.value)} style={{ minHeight: 160, fontFamily: 'monospace', fontSize: 12 }} /></Campo>
        {csv.trim() && (
          <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              {leitura.porTitulo
                ? <>Colunas encontradas: {leitura.colunas.map((c) => `${c.titulo} → ${({ nome: 'nome', email: 'e-mail', whatsapp: 'WhatsApp', empresa: 'empresa', cargo: 'cargo', colaboradores: 'colaboradores' })[c.campo]}`).join(' · ')}</>
                : <>Sem linha de títulos: lendo na ordem nome; e-mail; WhatsApp; empresa; cargo; colaboradores.</>}
              {' '}<b>{leitura.linhas.length}</b> pronta(s) para importar{leitura.puladas.length ? `, ${leitura.puladas.length} pulada(s)` : ''}.
            </div>
            {leitura.linhas.length > 0 && (
              <div className="tabela-envolve">
                <table className="tabela">
                  <thead><tr><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Empresa</th><th>Cargo</th></tr></thead>
                  <tbody>{leitura.linhas.slice(0, 4).map((l, i) => <tr key={i}><td>{l.nome}</td><td>{l.email ?? '—'}</td><td>{l.whatsapp ?? '—'}</td><td>{l.empresa ?? '—'}</td><td>{l.cargo ?? '—'}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            {leitura.puladas.length > 0 && (
              <div className="aviso erro" style={{ fontSize: 13 }}>
                Linhas puladas: {leitura.puladas.slice(0, 4).map((p) => `linha ${p.linha} (${p.motivo})`).join('; ')}{leitura.puladas.length > 4 ? ` e mais ${leitura.puladas.length - 4}` : ''}.
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
