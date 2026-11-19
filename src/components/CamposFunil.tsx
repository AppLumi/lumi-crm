import type { CampoFunil } from '../../shared/funis';
import { Campo } from './ui';

/** Formulário dos campos próprios de um funil (card, novo card e formulário público). */
export default function CamposFunil({ campos, valores, mudar, publico }: {
  campos: CampoFunil[]; valores: Record<string, unknown>; mudar: (v: Record<string, unknown>) => void; publico?: boolean;
}) {
  const lista = publico ? campos.filter((c) => c.publico) : campos;
  const set = (k: string, v: unknown) => mudar({ ...valores, [k]: v });
  return (
    <>
      {lista.map((c) => {
        const v = valores[c.chave];
        const rotulo = `${c.rotulo}${c.obrigatorio ? ' *' : ''}`;
        let entrada;
        switch (c.tipo) {
          case 'texto_longo':
            entrada = <textarea value={String(v ?? '')} onChange={(e) => set(c.chave, e.target.value)} style={{ minHeight: 90 }} />; break;
          case 'numero':
            entrada = <input inputMode="decimal" value={v == null ? '' : String(v)} onChange={(e) => set(c.chave, e.target.value)} />; break;
          case 'data':
            entrada = <input type="date" value={String(v ?? '')} onChange={(e) => set(c.chave, e.target.value)} />; break;
          case 'link':
            entrada = <input type="url" placeholder="https://" value={String(v ?? '')} onChange={(e) => set(c.chave, e.target.value)} />; break;
          case 'opcoes':
            entrada = (
              <select value={String(v ?? '')} onChange={(e) => set(c.chave, e.target.value)}>
                <option value="">Escolha…</option>
                {(c.opcoes ?? []).map((o) => <option key={o}>{o}</option>)}
              </select>
            ); break;
          case 'sim_nao':
            entrada = (
              <select value={v == null || v === '' ? '' : v === true || v === 'true' ? 'true' : 'false'} onChange={(e) => set(c.chave, e.target.value === '' ? '' : e.target.value === 'true')}>
                <option value="">Escolha…</option><option value="true">Sim</option><option value="false">Não</option>
              </select>
            ); break;
          case 'multiplas': {
            const marcadas = new Set(Array.isArray(v) ? (v as string[]) : []);
            entrada = (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                {(c.opcoes ?? []).map((o) => (
                  <label key={o} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={marcadas.has(o)} onChange={(e) => {
                      const n = new Set(marcadas); if (e.target.checked) n.add(o); else n.delete(o); set(c.chave, [...n]);
                    }} />{o}
                  </label>
                ))}
              </div>
            ); break;
          }
          default:
            entrada = <input value={String(v ?? '')} onChange={(e) => set(c.chave, e.target.value)} />;
        }
        return <Campo key={c.chave} rotulo={rotulo} ajuda={c.ajuda}>{entrada}</Campo>;
      })}
    </>
  );
}
