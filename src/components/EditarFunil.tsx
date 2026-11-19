import { useEffect, useState } from 'react';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import type { EtapaFunil, Funil } from '../lib/tipos';
import { MODELOS_FUNIL, TIPOS_CAMPO, TIPOS_ETAPA, chaveDe, slugDe, type CampoFunil, type TipoCampo, type TipoEtapa } from '../../shared/funis';
import { Campo, Modal } from './ui';

interface EtapaEd { id?: string; nome: string; tipo: TipoEtapa; prazo_dias: number | null }
interface CampoEd extends CampoFunil { opcoesTexto: string; nova?: boolean }

const paraEd = (c: CampoFunil): CampoEd => ({ ...c, opcoesTexto: (c.opcoes ?? []).join(', ') });

/** Cria um funil (a partir de um modelo) ou edita etapas, campos e formulário público de um existente. */
export default function EditarFunil({ funil, aberto, fechar, salvo }: { funil: Funil | null; aberto: boolean; fechar: () => void; salvo: (id: string) => void }) {
  const { time, perfil } = useSessao();
  const { ocupado, executar } = useAcao();
  const [modelo, setModelo] = useState('');
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [etapas, setEtapas] = useState<EtapaEd[]>([]);
  const [campos, setCampos] = useState<CampoEd[]>([]);
  const [mostraValor, setMostraValor] = useState(true);
  const [pedeEmpresa, setPedeEmpresa] = useState(true);
  const [publico, setPublico] = useState(false);
  const [slug, setSlug] = useState('');
  const [fTitulo, setFTitulo] = useState('');
  const [fTexto, setFTexto] = useState('');
  const [fObrigado, setFObrigado] = useState('');
  const [avisar, setAvisar] = useState('');
  const [donoPadrao, setDonoPadrao] = useState('');

  const aplicarModelo = (id: string) => {
    const m = MODELOS_FUNIL.find((x) => x.id === id);
    setModelo(id);
    if (!m) return;
    setNome(m.id === 'branco' ? '' : m.nome); setDescricao(m.descricao);
    setEtapas(m.etapas.map((e) => ({ nome: e.nome, tipo: e.tipo, prazo_dias: e.prazo_dias ?? null })));
    setCampos(m.campos.map(paraEd)); setMostraValor(m.mostra_valor); setPedeEmpresa(m.pede_empresa);
    setPublico(!!m.formulario?.publico); setSlug(m.formulario?.slug ?? ''); setFTitulo(m.formulario?.titulo ?? '');
    setFTexto(m.formulario?.texto ?? ''); setFObrigado(m.formulario?.obrigado ?? ''); setAvisar(perfil?.email ?? '');
  };

  useEffect(() => {
    if (!aberto) return;
    if (!funil) { setModelo(''); return; }
    setModelo('editar'); setNome(funil.nome); setDescricao(funil.descricao ?? ''); setCampos((funil.campos ?? []).map(paraEd));
    setMostraValor(funil.mostra_valor); setPedeEmpresa(funil.pede_empresa); setPublico(funil.formulario_publico); setSlug(funil.slug ?? '');
    setFTitulo(funil.formulario_titulo ?? ''); setFTexto(funil.formulario_texto ?? ''); setFObrigado(funil.formulario_obrigado ?? '');
    setAvisar(funil.avisar ?? ''); setDonoPadrao(funil.dono_padrao ?? '');
    supabase.from('funil_etapas').select('*').eq('funil_id', funil.id).order('ordem').then(({ data }) =>
      setEtapas(((data ?? []) as EtapaFunil[]).map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo, prazo_dias: e.prazo_dias }))));
  }, [aberto, funil]);

  const mudaEtapa = (i: number, p: Partial<EtapaEd>) => setEtapas((l) => l.map((e, k) => (k === i ? { ...e, ...p } : e)));
  const moveEtapa = (i: number, d: -1 | 1) => setEtapas((l) => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const mudaCampo = (i: number, p: Partial<CampoEd>) => setCampos((l) => l.map((c, k) => (k === i ? { ...c, ...p } : c)));

  const salvar = () => executar(async () => {
    if (!nome.trim()) throw new Error('Dê um nome ao funil');
    if (etapas.some((e) => !e.nome.trim())) throw new Error('Toda etapa precisa de nome');
    if (!etapas.some((e) => e.tipo === 'aberta')) throw new Error('O funil precisa de ao menos uma etapa em andamento');
    const chaves = new Set<string>();
    const camposOk: CampoFunil[] = campos.map((c) => {
      if (!c.rotulo.trim()) throw new Error('Todo campo precisa de nome');
      let chave = c.nova || !c.chave ? chaveDe(c.rotulo) : c.chave;
      while (chaves.has(chave) || ['nome', 'email', 'whatsapp', 'empresa'].includes(chave)) chave = `${chave}_2`;
      chaves.add(chave);
      const opcoes = c.opcoesTexto.split(',').map((s) => s.trim()).filter(Boolean);
      if ((c.tipo === 'opcoes' || c.tipo === 'multiplas') && !opcoes.length) throw new Error(`Liste as opções de “${c.rotulo}”, separadas por vírgula`);
      return { chave, rotulo: c.rotulo.trim(), tipo: c.tipo, obrigatorio: !!c.obrigatorio, publico: !!c.publico,
        ...(opcoes.length && (c.tipo === 'opcoes' || c.tipo === 'multiplas') ? { opcoes } : {}), ...(c.ajuda ? { ajuda: c.ajuda } : {}) };
    });
    const s = slugDe(slug || nome);
    if (publico && !/^[a-z0-9][a-z0-9-]{2,59}$/.test(s)) throw new Error('O endereço do formulário precisa de ao menos 3 letras ou números');
    const dados = {
      nome: nome.trim(), descricao: descricao.trim() || null, campos: camposOk, mostra_valor: mostraValor, pede_empresa: pedeEmpresa,
      formulario_publico: publico, slug: publico || funil?.slug ? s : null, formulario_titulo: fTitulo.trim() || null, formulario_texto: fTexto.trim() || null,
      formulario_obrigado: fObrigado.trim() || null, avisar: avisar.trim() || null, dono_padrao: donoPadrao || null,
    };
    let id = funil?.id;
    const erroSlug = (m: string) => (/slug|duplicate|unique/i.test(m) ? `Já existe um formulário em /f/${s}. Escolha outro endereço.` : m);
    if (id) {
      const r = await supabase.from('funis').update(dados).eq('id', id);
      if (r.error) throw new Error(erroSlug(r.error.message));
    } else {
      const { data: ult } = await supabase.from('funis').select('ordem').order('ordem', { ascending: false }).limit(1);
      const r = await supabase.from('funis').insert({ ...dados, ordem: ((ult?.[0]?.ordem as number | undefined) ?? 0) + 1 }).select('id').single();
      if (r.error) throw new Error(erroSlug(r.error.message));
      id = r.data.id as string;
    }
    // etapas: remove as que saíram (se estiverem vazias), atualiza e cria
    if (funil) {
      const { data: atuais } = await supabase.from('funil_etapas').select('id, nome').eq('funil_id', id);
      for (const e of (atuais ?? []) as { id: string; nome: string }[]) {
        if (etapas.some((x) => x.id === e.id)) continue;
        const { count } = await supabase.from('funil_cards').select('id', { count: 'exact', head: true }).eq('etapa_id', e.id);
        if (count) throw new Error(`A etapa “${e.nome}” tem ${count} card(s). Mova os cards antes de removê-la.`);
        ok(await supabase.from('funil_etapas').delete().eq('id', e.id));
      }
    }
    for (const [ordem, e] of etapas.entries()) {
      const linha = { nome: e.nome.trim(), tipo: e.tipo, prazo_dias: e.prazo_dias || null, ordem };
      if (e.id) ok(await supabase.from('funil_etapas').update(linha).eq('id', e.id));
      else ok(await supabase.from('funil_etapas').insert({ ...linha, funil_id: id }));
    }
    salvo(id!);
  }, funil ? 'Funil salvo' : 'Funil criado');

  const arquivar = () => executar(async () => {
    if (!funil) return;
    ok(await supabase.from('funis').update({ ativo: !funil.ativo, formulario_publico: false }).eq('id', funil.id));
    salvo(funil.id);
  }, funil?.ativo ? 'Funil arquivado' : 'Funil reativado');

  const escolhendo = !funil && !modelo;
  const rodape = escolhendo ? <button className="btn" onClick={fechar}>Cancelar</button> : (
    <>
      {funil && <button className="btn perigo" disabled={ocupado} onClick={arquivar} style={{ marginRight: 'auto' }}>{funil.ativo ? 'Arquivar funil' : 'Reativar funil'}</button>}
      <button className="btn" onClick={funil ? fechar : () => setModelo('')}>{funil ? 'Cancelar' : 'Voltar'}</button>
      <button className="btn primario" disabled={ocupado} onClick={salvar}>{funil ? 'Salvar' : 'Criar funil'}</button>
    </>
  );

  return (
    <Modal titulo={funil ? `Editar funil · ${funil.nome}` : 'Novo funil'} aberto={aberto} fechar={fechar} largura={820} rodape={rodape}>
      {escolhendo ? (
        <>
          <p className="muted">Comece de um modelo e ajuste etapas e campos depois.</p>
          <div className="grade g2">
            {MODELOS_FUNIL.map((m) => (
              <button key={m.id} className="cartao" style={{ textAlign: 'left', cursor: 'pointer', border: 0, font: 'inherit', color: 'inherit' }} onClick={() => aplicarModelo(m.id)}>
                <h3>{m.nome}</h3>
                <p className="muted" style={{ fontSize: 13, margin: '4px 0 8px' }}>{m.descricao}</p>
                <div style={{ fontSize: 12, color: 'var(--tinta-2)' }}>{m.etapas.map((e) => e.nome).join(' → ')}</div>
                {m.formulario?.publico && <div style={{ fontSize: 12, marginTop: 6 }}>Com formulário público de cadastro</div>}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="linha-campos">
            <Campo rotulo="Nome do funil"><input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Parceiros, B2B Grou, Especialistas" autoFocus /></Campo>
            <Campo rotulo="Dono dos cards novos">
              <select value={donoPadrao} onChange={(e) => setDonoPadrao(e.target.value)}>
                <option value="">Ninguém (escolher depois)</option>
                {time.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </Campo>
          </div>
          <Campo rotulo="Para que serve"><input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto' }} checked={mostraValor} onChange={(e) => setMostraValor(e.target.checked)} />Cards têm valor (R$)</label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto' }} checked={pedeEmpresa} onChange={(e) => setPedeEmpresa(e.target.checked)} />Cards são de empresas</label>
          </div>

          <div>
            <h3 style={{ marginBottom: 6 }}>Etapas</h3>
            <div style={{ display: 'grid', gap: 6 }}>
              {etapas.map((e, i) => (
                <div key={e.id ?? `n${i}`} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="muted" style={{ width: 18, textAlign: 'right' }}>{i + 1}</span>
                  <input style={{ flex: '2 1 180px' }} value={e.nome} onChange={(ev) => mudaEtapa(i, { nome: ev.target.value })} placeholder="Nome da etapa" />
                  <select style={{ flex: '1 1 150px' }} value={e.tipo} onChange={(ev) => mudaEtapa(i, { tipo: ev.target.value as TipoEtapa })}>
                    {Object.entries(TIPOS_ETAPA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input style={{ width: 92 }} inputMode="numeric" placeholder="prazo (d)" title="Dias até o card ficar parado nesta etapa"
                    value={e.prazo_dias ?? ''} onChange={(ev) => mudaEtapa(i, { prazo_dias: Number(ev.target.value.replace(/\D/g, '')) || null })} />
                  <button className="btn pequeno" onClick={() => moveEtapa(i, -1)} disabled={i === 0} aria-label="Subir">↑</button>
                  <button className="btn pequeno" onClick={() => moveEtapa(i, 1)} disabled={i === etapas.length - 1} aria-label="Descer">↓</button>
                  <button className="btn pequeno perigo" onClick={() => setEtapas((l) => l.filter((_, k) => k !== i))} aria-label="Remover etapa">×</button>
                </div>
              ))}
            </div>
            <button className="btn pequeno" style={{ marginTop: 8 }} onClick={() => setEtapas((l) => {
              const fim = l.findIndex((e) => e.tipo !== 'aberta'); const n = [...l];
              n.splice(fim < 0 ? l.length : fim, 0, { nome: '', tipo: 'aberta', prazo_dias: null }); return n;
            })}>+ Etapa</button>
          </div>

          <div>
            <h3 style={{ marginBottom: 6 }}>Campos do card</h3>
            <p className="muted" style={{ fontSize: 13, margin: '0 0 8px' }}>Nome, e-mail, WhatsApp{pedeEmpresa ? ' e empresa' : ''} já vêm em todo card. Acrescente o que este funil precisa saber.</p>
            <div style={{ display: 'grid', gap: 8 }}>
              {campos.map((c, i) => (
                <div key={i} className="cartao" style={{ padding: 10, display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input style={{ flex: '2 1 200px' }} value={c.rotulo} onChange={(e) => mudaCampo(i, { rotulo: e.target.value })} placeholder="Nome do campo (ex.: CRP)" />
                    <select style={{ flex: '1 1 150px' }} value={c.tipo} onChange={(e) => mudaCampo(i, { tipo: e.target.value as TipoCampo })}>
                      {Object.entries(TIPOS_CAMPO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button className="btn pequeno perigo" onClick={() => setCampos((l) => l.filter((_, k) => k !== i))} aria-label="Remover campo">×</button>
                  </div>
                  {(c.tipo === 'opcoes' || c.tipo === 'multiplas') && (
                    <input value={c.opcoesTexto} onChange={(e) => mudaCampo(i, { opcoesTexto: e.target.value })} placeholder="Opções separadas por vírgula" />
                  )}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                    <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto' }} checked={!!c.obrigatorio} onChange={(e) => mudaCampo(i, { obrigatorio: e.target.checked })} />Obrigatório</label>
                    {publico && <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" style={{ width: 'auto' }} checked={!!c.publico} onChange={(e) => mudaCampo(i, { publico: e.target.checked })} />Aparece no formulário público</label>}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn pequeno" style={{ marginTop: 8 }} onClick={() => setCampos((l) => [...l, { chave: '', rotulo: '', tipo: 'texto', publico: publico, opcoesTexto: '', nova: true }])}>+ Campo</button>
          </div>

          <div className="cartao" style={{ display: 'grid', gap: 10 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={publico} onChange={(e) => setPublico(e.target.checked)} />
              Formulário público de cadastro
            </label>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>Uma página aberta (sem login) para as pessoas se cadastrarem. Cada envio vira um card na primeira etapa.</p>
            {publico && (
              <>
                <Campo rotulo="Endereço" ajuda={`Fica em crm.applumi.io/f/${slugDe(slug || nome) || '…'}`}>
                  <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugDe(nome)} />
                </Campo>
                <Campo rotulo="Título da página"><input value={fTitulo} onChange={(e) => setFTitulo(e.target.value)} placeholder={nome} /></Campo>
                <Campo rotulo="Texto de apresentação"><textarea value={fTexto} onChange={(e) => setFTexto(e.target.value)} style={{ minHeight: 70 }} /></Campo>
                <Campo rotulo="Mensagem depois do envio"><input value={fObrigado} onChange={(e) => setFObrigado(e.target.value)} placeholder="Recebemos seu cadastro. Obrigado!" /></Campo>
                <Campo rotulo="Avisar por e-mail a cada cadastro" ajuda="Separe vários e-mails por vírgula"><input value={avisar} onChange={(e) => setAvisar(e.target.value)} /></Campo>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
