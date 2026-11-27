import { useEffect } from 'react';
import ApresentacaoProposta, { type DadosApresentacao } from './ApresentacaoProposta';

/** Prévia em tela cheia: exatamente o que o cliente vê no link da proposta. */
export default function PreviaProposta({ p, fechar }: { p: DadosApresentacao | null; fechar: () => void }) {
  useEffect(() => {
    if (!p) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    window.addEventListener('keydown', esc);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = antes; };
  }, [p, fechar]);
  if (!p) return null;
  return (
    <div className="ap-previa" role="dialog" aria-modal="true" aria-label="Prévia da proposta">
      <div className="ap-previa-barra">
        <b>Prévia</b><span>é assim que {p.empresa} vê a proposta pelo link</span>
        <button className="btn pequeno" onClick={fechar}>Fechar</button>
      </div>
      <div className="ap-pagina"><ApresentacaoProposta p={p} /></div>
    </div>
  );
}
