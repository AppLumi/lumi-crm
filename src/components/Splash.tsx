import { useEffect, useState, type ReactNode } from 'react';
import Logo from './Logo';

/** Fundo aurora compartilhado pelas telas fora do app (login, senha, splash). */
export function Aurora() {
  return <div className="aurora" aria-hidden="true"><i /><i /><i /><i /></div>;
}

export function TelaVidro({ children }: { children: ReactNode }) {
  return <div className="tela-login"><Aurora />{children}</div>;
}

/** Tela de abertura: aparece ao iniciar e logo depois do login, antes do Início. */
export default function Splash({ saindo = false, mensagem }: { saindo?: boolean; mensagem?: string }) {
  return (
    <div className={`splash ${saindo ? 'saindo' : ''}`} role="status" aria-live="polite" aria-label="Abrindo o Lumi CRM">
      <Aurora />
      <div className="splash-centro">
        <div className="splash-halo" />
        <Logo marca altura={112} animacao="respira" />
        <Logo palavra altura={40} animacao="entrada" className="splash-nome" />
        <div className="splash-barra"><i /></div>
        {mensagem && <p className="splash-msg">{mensagem}</p>}
      </div>
    </div>
  );
}

/** Indicador dentro do app (troca de página, dados carregando). Só aparece se demorar. */
export function Carregando({ texto = 'Carregando' }: { texto?: string }) {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setVisivel(true), 220); return () => window.clearTimeout(t); }, []);
  if (!visivel) return <div className="carregando" aria-busy="true" />;
  return (
    <div className="carregando visivel" role="status" aria-live="polite">
      <Logo marca altura={46} animacao="respira" />
      <span>{texto}<b>.</b><b>.</b><b>.</b></span>
    </div>
  );
}
