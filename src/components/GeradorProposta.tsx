import { useMemo, useState } from 'react';
import { ok, supabase } from '../lib/supabase';
import { useAcao, useSessao } from '../lib/sessao';
import { brl } from '../lib/formato';
import type { Oportunidade, Plano, Proposta } from '../lib/tipos';
import { calcular, faixaDe, rotuloFaixa, LIMITE_DESCONTO, LIMITE_DESCONTO_IMPLEMENTACAO, LIMITE_DESCONTO_SEM_APROVACAO } from '../../shared/precos';
import { Campo, Modal } from './ui';

/** Calculadora com a tabela do site e as regras de desconto. Gera uma nova versão de proposta. */
export default function GeradorProposta({ op, versoes, aberto, fechar, criada }: {
  op: Oportunidade; versoes: Proposta[]; aberto: boolean; fechar: () => void; criada: () => void;
}) {
  const { perfil } = useSessao();
  const { ocupado, executar } = useAcao();
  const [plano, setPlano] = useState<Plano>(op.plano);
  const [vidas, setVidas] = useState(String(op.vidas ?? ''));
  const [desc, setDesc] = useState('0');
  const [descImpl, setDescImpl] = useState('0');
  const [obs, setObs] = useState('');
  const [motivo, setMotivo] = useState('');
  const [validade, setValidade] = useState(() => new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10));

  const calc = useMemo(() => {
    try {
      return { r: calcular(plano, Number(vidas), Number(desc.replace(',', '.')) || 0, Number(descImpl.replace(',', '.')) || 0), erro: '' };
    } catch (e) { return { r: null, erro: (e as Error).message }; }
  }, [plano, vidas, desc, descImpl]);
  const r = calc.r;
  const proxima = r && r.pertoDaProximaFaixa ? faixaDe(r.faixa.max + 1) : null;

  const salvar = () => executar(async () => {
    if (!r) throw new Error(calc.erro || 'Revise os valores');
    if (r.precisaAprovacao && !motivo.trim()) throw new Error('Explique o motivo do desconto para a aprovação');
    const versao = Math.max(0, ...versoes.map((v) => v.versao)) + 1;
    ok(await supabase.from('propostas').insert({
      oportunidade_id: op.id, versao, plano, vidas: r.vidas, preco_vida: r.precoVida, mensal_tabela: r.mensalTabela,
      desconto_pct: r.descontoPct, mensal: r.mensal, implementacao_tabela: r.implementacaoTabela,
      desconto_implementacao_pct: r.descontoImplementacaoPct, implementacao: r.implementacao, primeiro_ano: r.primeiroAno,
      piso_aplicado: r.pisoAplicado, validade, observacoes: obs.trim() || null,
      status: r.precisaAprovacao ? 'aguardando_aprovacao' : 'aprovada', motivo_aprovacao: r.precisaAprovacao ? motivo.trim() : null,
      criado_por: perfil?.id,
    }));
    ok(await supabase.from('oportunidades').update({ plano, vidas: r.vidas, valor_mensal: r.mensal, valor_implementacao: r.implementacao, valor_primeiro_ano: r.primeiroAno }).eq('id', op.id));
    await supabase.from('atividades').insert({ tipo: 'sistema', titulo: `Proposta v${versao} criada: ${brl(r.mensal)}/mês`, conta_id: op.conta_id, oportunidade_id: op.id, autor: perfil?.id });
    criada();
    fechar();
  }, r?.precisaAprovacao ? 'Proposta enviada para aprovação de uma sócia' : 'Proposta criada');

  return (
    <Modal titulo="Nova proposta" aberto={aberto} fechar={fechar} largura={760}
      rodape={<><button className="btn" onClick={fechar}>Cancelar</button><button className="btn primario" disabled={ocupado || !r} onClick={salvar}>{r?.precisaAprovacao ? 'Pedir aprovação' : 'Criar proposta'}</button></>}>
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
          <Campo rotulo="Observações para o cliente" ajuda="Aparece na proposta. Ex.: escopo do piloto, condições de pagamento.">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} />
          </Campo>
          {r?.precisaAprovacao && (
            <Campo rotulo="Por que este desconto? (para a sócia que aprova)">
              <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </Campo>
          )}
        </div>

        <div className="cartao" style={{ background: '#fafbfd' }}>
          {!r ? <div className="aviso erro">{calc.erro || 'Informe as vidas'}</div> : (
            <>
              <div className="muted">Faixa {rotuloFaixa(r.faixa)} · {brl(r.precoVida)} por vida/mês</div>
              <div className="preco-grande" style={{ marginTop: 6 }}>{brl(r.mensal)}<span className="muted" style={{ fontSize: 14 }}>/mês</span></div>
              <dl className="dados" style={{ marginTop: 12 }}>
                <dt>Mensal de tabela</dt><dd>{brl(r.mensalTabela)}</dd>
                {r.descontoPct > 0 && <><dt>Desconto</dt><dd>{r.descontoPct}% (−{brl(r.mensalTabela - r.mensal)})</dd></>}
                <dt>Implementação</dt><dd>{brl(r.implementacao)}{r.descontoImplementacaoPct > 0 && <span className="muted"> (tabela {brl(r.implementacaoTabela)})</span>}</dd>
                <dt>Primeiro ano</dt><dd><strong>{brl(r.primeiroAno)}</strong></dd>
              </dl>
              {r.pisoAplicado && <div className="aviso info" style={{ marginTop: 12 }}>Piso entre faixas aplicado: o valor não fica abaixo do teto da faixa anterior.</div>}
              {proxima && <div className="aviso" style={{ marginTop: 12 }}>Perto da próxima faixa ({rotuloFaixa(proxima)}). Confira o número de vidas com o cliente.</div>}
              {r.precisaAprovacao && <div className="aviso erro" style={{ marginTop: 12 }}>Precisa de aprovação de uma sócia: {r.motivosAprovacao.join(' e ')}.</div>}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
