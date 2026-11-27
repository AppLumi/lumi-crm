import { Fragment, useMemo, useState } from 'react';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { brl } from '../lib/formato';
import type { Oportunidade, Plano, Proposta } from '../lib/tipos';
import { calcular, faixaDe, rotuloFaixa, LIMITE_DESCONTO, LIMITE_DESCONTO_IMPLEMENTACAO, LIMITE_DESCONTO_SEM_APROVACAO } from '../../shared/precos';
import { SERVICOS, itemServico, montarSlides, slidesEscolhiveis, totalServicos, type ItemServico } from '../../shared/propostaLumi';
import type { DadosApresentacao } from './ApresentacaoProposta';
import PreviaProposta from './PreviaProposta';
import { Campo, Modal } from './ui';

interface ServicoForm { ativo: boolean; quantidade: string; valor: string; detalhe: string }
const numero = (s: string) => Number(s.trim().replace(/\./g, '').replace(',', '.'));

/** Calculadora com a tabela do site e as regras de desconto, serviços adicionais e os slides da apresentação. Gera uma nova versão. */
export default function GeradorProposta({ op, versoes, aberto, fechar, criada }: {
  op: Oportunidade; versoes: Proposta[]; aberto: boolean; fechar: () => void; criada: () => void;
}) {
  const { perfil, time } = useSessao();
  const { ocupado, executar } = useAcao();
  const [plano, setPlano] = useState<Plano>(op.plano);
  const [vidas, setVidas] = useState(String(op.vidas ?? ''));
  const [desc, setDesc] = useState('0');
  const [descImpl, setDescImpl] = useState('0');
  const [obs, setObs] = useState('');
  const [motivo, setMotivo] = useState('');
  const [validade, setValidade] = useState(() => new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10));
  const [serv, setServ] = useState<Record<string, ServicoForm>>(() => Object.fromEntries(SERVICOS.map((s) => [s.chave, { ativo: false, quantidade: '1', valor: '', detalhe: '' }])));
  const [escolha, setEscolha] = useState<Record<string, boolean>>({});
  const [previa, setPrevia] = useState<DadosApresentacao | null>(null);

  const calc = useMemo(() => {
    try {
      return { r: calcular(plano, Number(vidas), Number(desc.replace(',', '.')) || 0, Number(descImpl.replace(',', '.')) || 0), erro: '' };
    } catch (e) { return { r: null, erro: (e as Error).message }; }
  }, [plano, vidas, desc, descImpl]);
  const r = calc.r;
  const proxima = r && r.pertoDaProximaFaixa ? faixaDe(r.faixa.max + 1) : null;

  const itens = useMemo(() => {
    const lista: ItemServico[] = [];
    for (const s of SERVICOS) {
      const f = serv[s.chave];
      if (!f?.ativo) continue;
      try { lista.push(itemServico(s.chave, Number(f.quantidade), numero(f.valor), f.detalhe)); }
      catch (e) { return { lista, erro: (e as Error).message }; }
    }
    return { lista, erro: '' };
  }, [serv]);
  const chavesServ = SERVICOS.filter((s) => serv[s.chave]?.ativo).map((s) => s.chave);
  const slides = montarSlides(plano, chavesServ, escolha);
  const escolhiveis = slidesEscolhiveis(plano, chavesServ);
  const totalServ = totalServicos(itens.lista);
  const versao = Math.max(0, ...versoes.map((v) => v.versao)) + 1;
  const mudarServ = (chave: string, x: Partial<ServicoForm>) => setServ((s) => ({ ...s, [chave]: { ...s[chave], ...x } }));

  const verPrevia = () => {
    if (!r) return;
    const dono = time.find((t) => t.id === op.dono) ?? perfil;
    setPrevia({
      empresa: op.conta_nome, versao, plano, vidas: r.vidas, preco_vida: r.precoVida, mensal_tabela: r.mensalTabela,
      desconto_pct: r.descontoPct, mensal: r.mensal, implementacao_tabela: r.implementacaoTabela, desconto_implementacao_pct: r.descontoImplementacaoPct,
      implementacao: r.implementacao, primeiro_ano: r.primeiroAno, validade, observacoes: obs.trim() || null, criado_em: new Date().toISOString(),
      slides, servicos: itens.lista, servicos_total: totalServ, responsavel: dono ? { nome: dono.nome, email: dono.email } : null,
    });
  };

  const salvar = () => executar(async () => {
    if (!r) throw new Error(calc.erro || 'Revise os valores');
    if (itens.erro) throw new Error(itens.erro);
    if (r.precisaAprovacao && !motivo.trim()) throw new Error('Explique o motivo do desconto para a aprovação');
    const { error } = await supabase.from('propostas').insert({
      oportunidade_id: op.id, versao, plano, vidas: r.vidas, preco_vida: r.precoVida, mensal_tabela: r.mensalTabela,
      desconto_pct: r.descontoPct, mensal: r.mensal, implementacao_tabela: r.implementacaoTabela,
      desconto_implementacao_pct: r.descontoImplementacaoPct, implementacao: r.implementacao, primeiro_ano: r.primeiroAno,
      piso_aplicado: r.pisoAplicado, validade, observacoes: obs.trim() || null,
      status: r.precisaAprovacao ? 'aguardando_aprovacao' : 'aprovada', motivo_aprovacao: r.precisaAprovacao ? motivo.trim() : null,
      criado_por: perfil?.id, slides, servicos: itens.lista, servicos_total: totalServ,
    });
    if (error) throw new Error(/slides|servicos/.test(error.message) ? 'Falta rodar a migração 0007 no Supabase do CRM.' : error.message);
    ok(await supabase.from('oportunidades').update({ plano, vidas: r.vidas, valor_mensal: r.mensal, valor_implementacao: r.implementacao, valor_primeiro_ano: r.primeiroAno + totalServ }).eq('id', op.id));
    await supabase.from('atividades').insert({
      tipo: 'sistema', titulo: `Proposta v${versao} criada: ${brl(r.mensal)}/mês${totalServ > 0 ? ` + ${itens.lista.map((i) => i.nome).join(', ')} (${brl(totalServ)})` : ''}`,
      conta_id: op.conta_id, oportunidade_id: op.id, autor: perfil?.id,
    });
    criada();
    fechar();
  }, r?.precisaAprovacao ? 'Proposta enviada para aprovação de uma sócia' : 'Proposta criada');

  return (
    <>
      <Modal titulo="Nova proposta" aberto={aberto} fechar={fechar} largura={920}
        rodape={<>
          <button className="btn" onClick={fechar}>Cancelar</button>
          <button className="btn" disabled={!r || !!itens.erro} onClick={verPrevia}>Ver como o cliente vê</button>
          <button className="btn primario" disabled={ocupado || !r || !!itens.erro} onClick={salvar}>{r?.precisaAprovacao ? 'Pedir aprovação' : 'Criar proposta'}</button>
        </>}>
        <div className="grade g2">
          <div>
            <div className="linha-campos">
              <Campo rotulo="Plano">
                <select value={plano} onChange={(e) => setPlano(e.target.value as Plano)}>
                  <option value="premium">Premium</option>
                  <option value="starter">Starter</option>
                </select>
              </Campo>
              <Campo rotulo="Vidas (colaboradores)"><input inputMode="numeric" value={vidas} onChange={(e) => setVidas(e.target.value.replace(/\D/g, ''))} /></Campo>
            </div>
            <div className="linha-campos">
              <Campo rotulo="Desconto na mensalidade (%)" ajuda={`Até ${LIMITE_DESCONTO_SEM_APROVACAO}% sem aprovação · máximo ${LIMITE_DESCONTO}%`}>
                <input inputMode="decimal" value={desc} onChange={(e) => setDesc(e.target.value)} />
              </Campo>
              <Campo rotulo="Desconto na implementação (%)" ajuda={`Até ${LIMITE_DESCONTO_IMPLEMENTACAO}% (pilotos e contratos de 24 meses)`}>
                <input inputMode="decimal" value={descImpl} onChange={(e) => setDescImpl(e.target.value)} />
              </Campo>
            </div>
            <Campo rotulo="Válida até"><input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></Campo>

            <h3 style={{ margin: '18px 0 8px' }}>Serviços adicionais</h3>
            {SERVICOS.map((s) => {
              const f = serv[s.chave];
              return (
                <div key={s.chave} className="cartao" style={{ padding: 12, marginBottom: 10 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input type="checkbox" checked={f.ativo} onChange={(e) => mudarServ(s.chave, { ativo: e.target.checked })} style={{ marginTop: 3, width: 'auto' }} />
                    <span><b>{s.nome}</b><div className="muted">{s.resumo}</div></span>
                  </label>
                  {f.ativo && (
                    <div style={{ marginTop: 10 }}>
                      <div className="linha-campos">
                        <Campo rotulo={`Quantidade de ${s.unidade[1]}`}><input inputMode="numeric" value={f.quantidade} onChange={(e) => mudarServ(s.chave, { quantidade: e.target.value.replace(/\D/g, '') })} /></Campo>
                        <Campo rotulo={`Valor por ${s.unidade[0]} (R$)`}><input inputMode="decimal" placeholder="ex.: 8.500" value={f.valor} onChange={(e) => mudarServ(s.chave, { valor: e.target.value })} /></Campo>
                      </div>
                      <Campo rotulo="Detalhe para o cliente (opcional)" ajuda="Ex.: até 25 líderes por turma, online.">
                        <input value={f.detalhe} onChange={(e) => mudarServ(s.chave, { detalhe: e.target.value })} />
                      </Campo>
                    </div>
                  )}
                </div>
              );
            })}

            <Campo rotulo="Observações para o cliente" ajuda="Aparece na proposta. Ex.: escopo do piloto, condições de pagamento.">
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} />
            </Campo>
            {r?.precisaAprovacao && (
              <Campo rotulo="Por que este desconto? (para a sócia que aprova)">
                <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              </Campo>
            )}
          </div>

          <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
            <div className="cartao" style={{ background: '#fafbfd' }}>
              {!r ? <div className="aviso erro">{calc.erro || 'Informe as vidas'}</div> : (
                <>
                  <div className="muted">Faixa {rotuloFaixa(r.faixa)} · {brl(r.precoVida)} por vida/mês</div>
                  <div className="preco-grande" style={{ marginTop: 6 }}>{brl(r.mensal)}<span className="muted" style={{ fontSize: 14 }}>/mês</span></div>
                  <dl className="dados" style={{ marginTop: 12 }}>
                    <dt>Mensal de tabela</dt><dd>{brl(r.mensalTabela)}</dd>
                    {r.descontoPct > 0 && <><dt>Desconto</dt><dd>{r.descontoPct}% (−{brl(r.mensalTabela - r.mensal)})</dd></>}
                    <dt>Implementação</dt><dd>{brl(r.implementacao)}{r.descontoImplementacaoPct > 0 && <span className="muted"> (tabela {brl(r.implementacaoTabela)})</span>}</dd>
                    <dt>Lumi no 1º ano</dt><dd>{brl(r.primeiroAno)}</dd>
                    {itens.lista.map((i) => <Fragment key={i.chave}><dt>Workshop ({i.quantidade} {i.unidade})</dt><dd>{brl(i.valor_total)}</dd></Fragment>)}
                    <dt>Total no 1º ano</dt><dd><strong>{brl(r.primeiroAno + totalServ)}</strong></dd>
                  </dl>
                  {itens.erro && <div className="aviso erro" style={{ marginTop: 12 }}>{itens.erro}</div>}
                  {r.pisoAplicado && <div className="aviso info" style={{ marginTop: 12 }}>Piso entre faixas aplicado: o valor não fica abaixo do teto da faixa anterior.</div>}
                  {proxima && <div className="aviso" style={{ marginTop: 12 }}>Perto da próxima faixa ({rotuloFaixa(proxima)}). Confira o número de vidas com o cliente.</div>}
                  {r.precisaAprovacao && <div className="aviso erro" style={{ marginTop: 12 }}>Precisa de aprovação de uma sócia: {r.motivosAprovacao.join(' e ')}.</div>}
                </>
              )}
            </div>

            <div className="cartao">
              <h3 style={{ margin: 0 }}>Apresentação no link</h3>
              <p className="muted" style={{ margin: '4px 0 10px' }}>Capa e investimento sempre entram. {slides.length} slides no total.</p>
              <div style={{ display: 'grid', gap: 6 }}>
                {escolhiveis.map((s) => (
                  <label key={s.chave} style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={slides.includes(s.chave)} onChange={(e) => setEscolha((x) => ({ ...x, [s.chave]: e.target.checked }))} />
                    {s.nome}
                  </label>
                ))}
              </div>
              {plano === 'starter' && <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>O slide do aplicativo fica de fora no Starter (o app é do Premium).</p>}
            </div>
          </div>
        </div>
      </Modal>
      <PreviaProposta p={previa} fechar={() => setPrevia(null)} />
    </>
  );
}
