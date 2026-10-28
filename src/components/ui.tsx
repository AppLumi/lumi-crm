import { useEffect, type ReactNode } from 'react';

export function Modal({ titulo, aberto, fechar, children, rodape, largura }: {
  titulo: string; aberto: boolean; fechar: () => void; children: ReactNode; rodape?: ReactNode; largura?: number;
}) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberto, fechar]);
  if (!aberto) return null;
  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && fechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} style={largura ? { width: `min(${largura}px, 100%)` } : undefined}>
        <header><h2>{titulo}</h2><button onClick={fechar} aria-label="Fechar">×</button></header>
        {children}
        {rodape && <footer>{rodape}</footer>}
      </div>
    </div>
  );
}

export function Campo({ rotulo, ajuda, children }: { rotulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <div className="campo">
      <label>{rotulo}</label>
      {children}
      {ajuda && <span className="ajuda">{ajuda}</span>}
    </div>
  );
}

export const Selo = ({ cor = '', children }: { cor?: string; children: ReactNode }) => <span className={`selo ${cor}`}>{children}</span>;

export function Nota({ valor, titulo }: { valor: number; titulo?: string }) {
  const cor = valor >= 70 ? 'var(--verde)' : valor >= 40 ? 'var(--azul-claro)' : 'var(--nevoa)';
  return (
    <span className="nota-barra" title={titulo}>
      <i><b style={{ width: `${Math.min(100, valor)}%`, background: cor }} /></i>
      {valor}
    </span>
  );
}

export { Carregando } from './Splash';

export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>;
}

export function Kpi({ rotulo, valor, nota, alerta }: { rotulo: string; valor: ReactNode; nota?: ReactNode; alerta?: boolean }) {
  return (
    <div className={`cartao kpi ${alerta ? 'alerta' : ''}`}>
      <div className="rotulo">{rotulo}</div>
      <div className="valor">{valor}</div>
      {nota && <div className="nota">{nota}</div>}
    </div>
  );
}

export function Barras({ itens, formato = (v) => String(v) }: { itens: { rotulo: string; valor: number }[]; formato?: (v: number) => string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  if (!itens.length) return <Vazio>Sem dados no período.</Vazio>;
  return (
    <div className="barras">
      {itens.map((i) => (
        <div className="barra" key={i.rotulo}>
          <span>{i.rotulo}</span>
          <span className="trilho"><i style={{ width: `${(i.valor / max) * 100}%` }} /></span>
          <span className="v">{formato(i.valor)}</span>
        </div>
      ))}
    </div>
  );
}
