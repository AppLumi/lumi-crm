import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAcao, useSessao } from '../lib/sessao';
import { colocarNoFunil, funisDisponiveis, type DestinoFunil, type PessoaFunil, type Resultado } from '../lib/funis';
import { Modal } from './ui';

/** Escolher um funil e colocar nele uma ou várias pessoas (leads ou contatos). Não pergunta plano. */
export default function MoverParaFunil({ pessoas, fechar, concluido, excluirFunil }: {
  pessoas: PessoaFunil[] | null; fechar: () => void; concluido?: () => void; excluirFunil?: string;
}) {
  const { perfil } = useSessao();
  const { ocupado, executar } = useAcao();
  const [funis, setFunis] = useState<DestinoFunil[]>([]);
  const [feito, setFeito] = useState<{ funil: string; itens: { p: PessoaFunil; r: Resultado }[] } | null>(null);

  useEffect(() => { if (pessoas) { setFeito(null); funisDisponiveis().then(setFunis); } }, [pessoas]);
  if (!pessoas) return null;

  const mandar = (f: DestinoFunil) => executar(async () => {
    const itens: { p: PessoaFunil; r: Resultado }[] = [];
    for (const p of pessoas) {
      try { itens.push({ p, r: await colocarNoFunil(f, p, perfil?.id ?? null) }); }
      catch (e) { itens.push({ p, r: { ok: false, motivo: (e as Error).message } }); }
    }
    setFeito({ funil: f.nome, itens });
    concluido?.();
  });

  const colocados = feito?.itens.filter((x) => x.r.ok) ?? [];
  const pulados = feito?.itens.filter((x) => !x.r.ok) ?? [];
  const um = pessoas.length === 1;

  return (
    <Modal titulo={um ? `Colocar ${pessoas[0].nome} num funil` : `Colocar ${pessoas.length} pessoas num funil`} aberto fechar={fechar}
      rodape={feito ? <button className="btn primario" onClick={fechar}>Fechar</button> : <button className="btn" onClick={fechar}>Cancelar</button>}>
      {!feito ? (
        <>
          <p className="muted">Cada pessoa entra na primeira etapa do funil escolhido. No funil de vendas, o negócio é aberto na empresa da pessoa; o plano e o valor entram depois, na proposta.</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {funis.filter((f) => f.id !== excluirFunil).map((f) => (
              <button key={f.id} className="btn" style={{ justifyContent: 'flex-start' }} disabled={ocupado} onClick={() => mandar(f)}>{f.nome}</button>
            ))}
          </div>
          {ocupado && <p className="muted" style={{ marginTop: 10 }}>Colocando no funil…</p>}
        </>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {colocados.length > 0 && (
            <div className="aviso ok">
              {colocados.length} {colocados.length === 1 ? 'pessoa entrou' : 'pessoas entraram'} no funil {feito.funil}.
              {um && colocados[0].r.ok && <> <Link to={colocados[0].r.link} onClick={fechar}>Abrir</Link></>}
            </div>
          )}
          {pulados.length > 0 && (
            <div className="aviso erro" style={{ display: 'grid', gap: 4 }}>
              <b>{pulados.length} não {pulados.length === 1 ? 'entrou' : 'entraram'}:</b>
              {pulados.slice(0, 8).map(({ p, r }) => (
                <span key={p.tipo + p.id}>{p.nome}: {!r.ok && r.motivo}{!r.ok && r.link && <> · <Link to={r.link} onClick={fechar}>ver</Link></>}</span>
              ))}
              {pulados.length > 8 && <span>e mais {pulados.length - 8}.</span>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
