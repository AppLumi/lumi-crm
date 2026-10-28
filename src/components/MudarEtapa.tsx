import { useEffect, useState } from 'react';
import { ok, supabase } from '../lib/supabase';
import { useAcao } from '../lib/sessao';
import { ETAPAS, MOTIVOS_PERDA, nomeEtapa } from '../lib/formato';
import type { Contato, Etapa, Oportunidade } from '../lib/tipos';
import { Campo, Modal } from './ui';

type CampoSaida = 'dor' | 'decisor_id' | 'situacao_pgr' | 'demo_em' | 'vidas' | 'valor_mensal' | 'condicoes_finais' | 'motivo_perda';

// Critério de saída de cada etapa: para chegar numa etapa, os critérios das anteriores precisam estar cumpridos.
const SAIDA: Partial<Record<Etapa, CampoSaida[]>> = {
  qualificacao: ['dor'],
  diagnostico: ['decisor_id', 'situacao_pgr'],
  demo: ['demo_em'],
  piloto: [],
  proposta: ['vidas', 'valor_mensal'],
};

const ROTULO: Record<CampoSaida, string> = {
  dor: 'Qual a dor principal?', decisor_id: 'Quem decide a compra?', situacao_pgr: 'Como está o PGR / riscos psicossociais hoje?',
  demo_em: 'Quando foi a demonstração?', vidas: 'Quantos colaboradores (vidas)?', valor_mensal: 'Valor mensal proposto',
  condicoes_finais: 'Condições fechadas', motivo_perda: 'Motivo da perda',
};

export function pendencias(op: Oportunidade, destino: Etapa): CampoSaida[] {
  if (destino === 'perdida') return ['motivo_perda'];
  const ordem = ETAPAS.map((e) => e.id);
  const ate = destino === 'ganha' ? ordem.indexOf('negociacao') + 1 : ordem.indexOf(destino);
  const exigidos = ordem.slice(0, ate).flatMap((e) => SAIDA[e] ?? []);
  if (destino === 'ganha') exigidos.push('condicoes_finais');
  return exigidos.filter((c) => op[c] == null || op[c] === '');
}

/** Move a oportunidade; sem pendências, move direto. */
export async function moverEtapa(op: Oportunidade, destino: Etapa) {
  ok(await supabase.from('oportunidades').update({ etapa: destino }).eq('id', op.id));
}

/** Pede os critérios de saída que faltam e move a oportunidade. */
export default function MudarEtapa({ op, destino, fechar, mudou }: { op: Oportunidade | null; destino: Etapa | null; fechar: () => void; mudou: () => void }) {
  const { ocupado, executar } = useAcao();
  const [valores, setValores] = useState<Record<string, string>>({});
  const [contatos, setContatos] = useState<Contato[]>([]);
  const faltam = op && destino ? pendencias(op, destino) : [];

  useEffect(() => {
    setValores({});
    if (op && faltam.includes('decisor_id')) {
      supabase.from('contatos').select('*').eq('conta_id', op.conta_id).order('nome').then(({ data }) => setContatos((data ?? []) as Contato[]));
    }
  }, [op?.id, destino]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = () => executar(async () => {
    if (!op || !destino) return;
    const campos: Record<string, unknown> = { etapa: destino };
    for (const c of faltam) {
      const v = (valores[c] ?? '').trim();
      if (!v) throw new Error(`Preencha: ${ROTULO[c]}`);
      campos[c] = c === 'vidas' ? Number(v.replace(/\D/g, '')) : c === 'valor_mensal' ? Number(v.replace(/\./g, '').replace(',', '.')) : c === 'demo_em' ? new Date(v).toISOString() : v;
    }
    if (destino === 'perdida' && valores.motivo_perda_detalhe) campos.motivo_perda_detalhe = valores.motivo_perda_detalhe.trim();
    ok(await supabase.from('oportunidades').update(campos).eq('id', op.id));
    mudou();
    fechar();
  }, destino ? `Movida para ${nomeEtapa(destino)}` : undefined);

  if (!op || !destino || faltam.length === 0) return null;
  const set = (k: string, v: string) => setValores((x) => ({ ...x, [k]: v }));

  return (
    <Modal titulo={`${op.conta_nome} → ${nomeEtapa(destino)}`} aberto fechar={fechar}
      rodape={<><button className="btn" onClick={fechar}>Cancelar</button><button className={`btn ${destino === 'perdida' ? 'perigo' : 'primario'}`} disabled={ocupado} onClick={salvar}>Mover</button></>}>
      {destino !== 'perdida' && <div className="aviso info">Para avançar, registre o que ficou combinado nas etapas anteriores.</div>}
      {faltam.map((c) => (
        <Campo key={c} rotulo={ROTULO[c]}>
          {c === 'decisor_id' ? (
            <select value={valores[c] ?? ''} onChange={(e) => set(c, e.target.value)}>
              <option value="">{contatos.length ? 'Escolha…' : 'Cadastre o contato na conta primeiro'}</option>
              {contatos.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.cargo ? ` · ${p.cargo}` : ''}</option>)}
            </select>
          ) : c === 'motivo_perda' ? (
            <select value={valores[c] ?? ''} onChange={(e) => set(c, e.target.value)}>
              <option value="">Escolha…</option>
              {Object.entries(MOTIVOS_PERDA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          ) : c === 'demo_em' ? (
            <input type="datetime-local" value={valores[c] ?? ''} onChange={(e) => set(c, e.target.value)} />
          ) : c === 'vidas' || c === 'valor_mensal' ? (
            <input inputMode="decimal" value={valores[c] ?? ''} onChange={(e) => set(c, e.target.value)} placeholder={c === 'valor_mensal' ? 'Ou gere uma proposta na oportunidade' : ''} />
          ) : (
            <textarea value={valores[c] ?? ''} onChange={(e) => set(c, e.target.value)} />
          )}
        </Campo>
      ))}
      {destino === 'perdida' && (
        <Campo rotulo="O que aconteceu (opcional)"><textarea value={valores.motivo_perda_detalhe ?? ''} onChange={(e) => set('motivo_perda_detalhe', e.target.value)} /></Campo>
      )}
    </Modal>
  );
}
