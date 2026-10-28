import { useId } from 'react';

type Animacao = 'entrada' | 'respira';

/**
 * Logo do Lumi em SVG. As três lâminas, as letras e a estrela são peças separadas
 * para poderem ser animadas (entrada na tela de login, respiração no splash).
 */
export default function Logo({ altura = 32, marca = false, palavra = false, variante = 'escuro', animacao, className = '' }: {
  altura?: number; marca?: boolean; palavra?: boolean; variante?: 'escuro' | 'claro'; animacao?: Animacao; className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const cor = variante === 'claro' ? '#ffffff' : '#051B4A';
  const estrela = variante === 'claro' ? '#8FB2FF' : '#0E398C';
  const inicio = palavra ? 780 : 0; // só a palavra "lumi", sem as lâminas
  const largura = marca ? 650 : 2000 - inicio;
  const classes = ['logo-svg', animacao ? `anima-${animacao}` : '', className].filter(Boolean).join(' ');

  return (
    <svg className={classes} viewBox={`${inicio} 0 ${largura} 672`} height={altura} width={(altura * largura) / 672}
      role="img" aria-label="Lumi" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="0.15"><stop offset="0" stopColor={cor} /><stop offset="1" stopColor={cor} stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={cor} /><stop offset="1" stopColor={cor} stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}c`} x1="1" y1="0" x2="0.2" y2="1"><stop offset="0" stopColor={cor} /><stop offset="1" stopColor={cor} stopOpacity="0" /></linearGradient>
        {!marca && (
          <>
            <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="0.5" stopColor="#fff" stopOpacity="0.7" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="780" y="0" width="1220" height="672">
              <Letras cor="#fff" />
            </mask>
          </>
        )}
      </defs>

      {!palavra && <g className="laminas">
        <path className="lamina l1" d="M55 10 L595 66 L402 303 L28 100 A50 50 0 0 1 55 10 Z" fill={`url(#${id}a)`} />
        <path className="lamina l2" d="M0 125 H228 V622 A46 46 0 0 1 141 642 L0 368 Z" fill={`url(#${id}b)`} />
        <path className="lamina l3" d="M577 195 A48 48 0 0 1 640 262 L380 635 L230 415 Z" fill={`url(#${id}c)`} />
      </g>}

      {!marca && (
        <>
          <Letras cor={cor} />
          <g mask={`url(#${id}m)`} className="reflexo-area">
            <rect className="reflexo" x="560" y="0" width="260" height="672" fill={`url(#${id}r)`} />
          </g>
        </>
      )}

      {!marca && <path className="estrela" fill={estrela} d="M1946 36 Q1953 76 1998 91 Q1953 106 1946 146 Q1939 106 1893 91 Q1939 76 1946 36 Z" />}
    </svg>
  );
}

function Letras({ cor }: { cor: string }) {
  return (
    <g className="letras">
      <rect className="letra" x="812" y="34" width="86" height="498" fill={cor} />
      <path className="letra" d="M978.5 177 V373 A121 121 0 0 0 1220.5 373 V177" fill="none" stroke={cor} strokeWidth="86" />
      <path className="letra" d="M1338 532 V333 A120 120 0 0 1 1578.5 333 V532 M1578.5 333 A121.5 121.5 0 0 1 1821.5 333 V532" fill="none" stroke={cor} strokeWidth="86" />
      <rect className="letra" x="1907" y="176" width="86" height="356" fill={cor} />
    </g>
  );
}
