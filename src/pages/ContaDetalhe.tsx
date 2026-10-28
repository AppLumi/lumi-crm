import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { PAPEIS_CONTATO, brl, cnpjFmt, nomeEtapa, num, zapLink } from '../lib/formato';
import type { Conta, Contato, Oportunidade } from '../lib/tipos';
import { Campo, Carregando, Modal, Selo, Vazio } from '../components/ui';
import LinhaDoTempo from '../components/LinhaDoTempo';
import EnviarEmail, { type DestinoEmail } from '../components/EnviarEmail';
import { ESTAGIOS, type DadosCnpj } from './Contas';

const contatoVazio = { id: '', nome: '', cargo: '', papel: 'outro', email: '', whatsapp: '', linkedin: '', aceita_marketing: false };

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

  const carregar = useCallback(async () => {
    const [c, ct, o] = await Promise.all([
      supabase.from('contas').select('*').eq('id', id!).maybeSingle(),
      supabase.from('contatos').select('*').eq('conta_id', id!).order('nome'),
      supabase.from('v_oportunidades').select('*').eq('conta_id', id!).order('criado_em', { ascending: false }),
    ]);
    setConta(c.data as Conta | null);
    setContatos((ct.data ?? []) as Contato[]);
    setOps((o.data ?? []) as Oportunidade[]);
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  if (!conta) return <Carregando />;

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
      conta_id: conta.id, nome: contato.nome.trim(), cargo: contato.cargo.trim() || null, papel: contato.papel,
      email: contato.email.trim().toLowerCase() || null, whatsapp: contato.whatsapp.replace(/\D/g, '') || null,
      linkedin: contato.linkedin.trim() || null, aceita_marketing: contato.aceita_marketing,
    };
    if (contato.id) ok(await supabase.from('contatos').update(dados).eq('id', contato.id));
    else ok(await supabase.from('contatos').insert({ ...dados, consentimento_em: contato.aceita_marketing ? new Date().toISOString() : null }));
    setContato(null);
    await carregar();
  }, 'Contato salvo');

  const novaOportunidade = () => executar(async () => {
    const r = ok(await supabase.from('oportunidades').insert({ conta_id: conta.id, titulo: `Lumi · ${conta.nome}`, vidas: conta.colaboradores, dono: perfil?.id }).select('id').single());
    if (conta.estagio === 'lead') await supabase.from('contas').update({ estagio: 'oportunidade' }).eq('id', conta.id);
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
          <button className="btn" onClick={() => setContato({ ...contatoVazio })}>Novo contato</button>
          <button className="btn primario" disabled={ocupado} onClick={novaOportunidade}>Nova oportunidade</button>
        </div>
      </div>

      <div className="detalhe">
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="cartao">
            <h2>Contatos</h2>
            {contatos.length === 0 ? <Vazio>Nenhum contato. Cadastre quem decide e quem usa o painel.</Vazio> : (
              <table className="tabela" style={{ marginTop: 8 }}><tbody>
                {contatos.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.nome}</strong><div className="muted">{c.cargo ?? ''}</div></td>
                    <td><Selo cor={c.papel === 'decisor' ? 'lima' : ''}>{PAPEIS_CONTATO[c.papel]}</Selo>{c.descadastrado_em && <Selo cor="vermelho">descadastrado</Selo>}</td>
                    <td>{c.email ?? '—'}<div className="muted">{c.whatsapp ?? ''}</div></td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      {c.email && !c.descadastrado_em && <button className="btn pequeno" onClick={() => setEmail({ para: c.email!, nome: c.nome, empresa: conta.nome, contato_id: c.id, conta_id: conta.id })}>E-mail</button>}
                      {zapLink(c.whatsapp) && <a className="btn pequeno" href={zapLink(c.whatsapp)!} target="_blank" rel="noreferrer">WhatsApp</a>}
                      <button className="btn pequeno" onClick={() => setContato({ id: c.id, nome: c.nome, cargo: c.cargo ?? '', papel: c.papel, email: c.email ?? '', whatsapp: c.whatsapp ?? '', linkedin: c.linkedin ?? '', aceita_marketing: c.aceita_marketing })}>Editar</button>
                    </td>
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
              {conta.cnpj && <button className="btn pequeno" disabled={ocupado} onClick={atualizarCnpj}>Atualizar da Receita</button>}
            </div>
            <dl className="dados" style={{ marginTop: 10 }}>
              <dt>CNPJ</dt><dd>{cnpjFmt(conta.cnpj)}</dd>
              <dt>Razão social</dt><dd>{conta.razao_social ?? '—'}</dd>
              <dt>Atividade</dt><dd>{conta.cnae ? `${conta.cnae} · ${conta.setor ?? ''}` : '—'}</dd>
              <dt>Porte</dt><dd>{conta.porte ?? '—'}</dd>
              <dt>Colaboradores</dt>
              <dd><input inputMode="numeric" defaultValue={conta.colaboradores ?? ''} onBlur={(e) => {
                const v = Number(e.target.value.replace(/\D/g, '')) || null;
                if (v !== conta.colaboradores) atualizar({ colaboradores: v });
              }} /></dd>
              <dt>Site</dt><dd>{conta.site ? <a href={conta.site.startsWith('http') ? conta.site : `https://${conta.site}`} target="_blank" rel="noreferrer">{conta.site}</a> : '—'}</dd>
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
          <div className="cartao">
            <h2>Notas da conta</h2>
            <textarea style={{ marginTop: 8, minHeight: 120 }} value={notas ?? conta.notas ?? ''} onChange={(e) => setNotas(e.target.value)} placeholder="Contexto que todo o time precisa saber" />
            {notas !== null && notas !== (conta.notas ?? '') && (
              <div className="acoes" style={{ marginTop: 6 }}><button className="btn pequeno primario" onClick={() => { atualizar({ notas: notas.trim() || null }); setNotas(null); }}>Salvar notas</button></div>
            )}
          </div>
        </div>
      </div>

      <Modal titulo={contato?.id ? 'Editar contato' : 'Novo contato'} aberto={!!contato} fechar={() => setContato(null)}
        rodape={<><button className="btn" onClick={() => setContato(null)}>Cancelar</button><button className="btn primario" disabled={ocupado} onClick={salvarContato}>Salvar</button></>}>
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
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={contato.aceita_marketing} onChange={(e) => setContato({ ...contato, aceita_marketing: e.target.checked })} />
              Autorizou receber conteúdos do Lumi
            </label>
          </>
        )}
      </Modal>
      <EnviarEmail destino={email} fechar={() => setEmail(null)} enviado={() => setTick((t) => t + 1)} />
    </>
  );
}
