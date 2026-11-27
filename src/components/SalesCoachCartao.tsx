import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { data, dataHora } from '../lib/formato';
import { organizarSalesCoach, type CampoSC, type ResumoSC } from '../../shared/salesCoach';
import { Selo } from './ui';

let camposCache: Promise<CampoSC[]> | null = null;
/** Nomes e tipos dos campos que o Sales Coach criou no CRM (carregados uma vez). */
export function camposSalesCoach(): Promise<CampoSC[]> {
  camposCache ??= Promise.resolve(supabase.from('salescoach_campos').select('key, label, type').order('criado_em'))
    .then((r) => (r.data ?? []) as CampoSC[]);
  return camposCache;
}

export const COR_TEMPERATURA: Record<NonNullable<ResumoSC['nivel']>, string> = { fria: 'azul', morna: 'amarelo', quente: 'lima', muito_quente: 'verde' };

type Json = Record<string, unknown>;

/** Última análise do Sales Coach: do negócio; sem ela, a da empresa (reuniões de antes do negócio abrir). */
export default function SalesCoachCartao({ oportunidadeId, contaId }: { oportunidadeId?: string; contaId?: string | null }) {
  const [r, setR] = useState<{ resumo: ResumoSC | null; daEmpresa: boolean } | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const campos = await camposSalesCoach();
      let resumo: ResumoSC | null = null;
      let daEmpresa = false;
      if (oportunidadeId) {
        const { data: o } = await supabase.from('oportunidades').select('sales_coach').eq('id', oportunidadeId).maybeSingle();
        resumo = organizarSalesCoach((o as { sales_coach?: Json } | null)?.sales_coach, campos);
      }
      if (!resumo && contaId) {
        const { data: c } = await supabase.from('contas').select('sales_coach').eq('id', contaId).maybeSingle();
        resumo = organizarSalesCoach((c as { sales_coach?: Json } | null)?.sales_coach, campos);
        daEmpresa = !!resumo && !!oportunidadeId;
      }
      if (vivo) setR({ resumo, daEmpresa });
    })();
    return () => { vivo = false; };
  }, [oportunidadeId, contaId]);

  if (r === undefined) return null;
  const s = r.resumo;

  return (
    <div className="cartao sc">
      <div className="sc-topo">
        <h2>Sales Coach</h2>
        {s?.link && <a className="btn pequeno" href={s.link} target="_blank" rel="noreferrer">Abrir análise</a>}
      </div>
      {!s ? (
        <p className="muted" style={{ margin: '6px 0 0' }}>Nenhuma reunião analisada ainda. Depois de cada análise no Sales Coach, a nota, a temperatura e o próximo passo aparecem aqui.</p>
      ) : (
        <>
          <p className="muted" style={{ margin: '2px 0 12px', fontSize: 12 }}>
            {r.daEmpresa ? 'Última reunião registrada na empresa' : 'Última reunião analisada'}
            {s.dataReuniao ? ` · ${data(s.dataReuniao + 'T12:00:00')}` : ''}{s.atualizado ? ` · atualizado ${dataHora(s.atualizado)}` : ''}
          </p>
          <div className="sc-principal">
            {s.nota != null && (
              <div className="sc-nota">
                <b>{Math.round(s.nota)}</b><span>/100</span>
                <div className="sc-barra"><i style={{ width: `${Math.max(0, Math.min(100, s.nota))}%` }} /></div>
              </div>
            )}
            {s.temperatura && <Selo cor={s.nivel ? COR_TEMPERATURA[s.nivel] : ''}>{s.temperatura}</Selo>}
            {s.fala != null && <span className="muted" style={{ fontSize: 12 }}>fala de quem conduziu: {Math.round(s.fala)}%</span>}
          </div>

          {s.proximo && (
            <div className="sc-proximo">
              <small>Próximo passo{s.dataProximo ? ` · ${data(s.dataProximo + 'T12:00:00')}` : ''}</small>
              <p>{s.proximo}</p>
            </div>
          )}

          {s.criterios.length > 0 && (
            <div className="sc-bloco">
              <small>Critérios</small>
              <ul className="sc-criterios">
                {s.criterios.map((c) => <li key={c.label}><span>{c.label}</span><b>{typeof c.valor === 'number' ? `${c.valor} pts` : c.valor}</b></li>)}
              </ul>
            </div>
          )}
          {s.dores && <div className="sc-bloco"><small>Dores</small><p>{s.dores}</p></div>}
          {s.resumo && <div className="sc-bloco"><small>Resumo</small><p>{s.resumo}</p></div>}
          {s.outros.map((o) => (
            <div key={o.label} className="sc-bloco"><small>{o.label}</small>
              <p>{o.tipo === 'url' && /^https?:\/\//.test(String(o.valor)) ? <a href={String(o.valor)} target="_blank" rel="noreferrer">abrir</a> : o.tipo === 'date' ? data(String(o.valor) + 'T12:00:00') : String(o.valor)}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
