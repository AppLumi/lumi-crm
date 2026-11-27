import { Fragment, type ReactNode } from 'react';

/** Markdown simples e seguro (sem HTML): títulos, parágrafos, listas, tabelas, negrito, itálico, código e links. */
export default function Markdown({ texto }: { texto: string }) {
  return <div className="md">{blocos(texto)}</div>;
}

function inline(t: string, k = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^\s)]+)\)|\*[^*\s][^*]*\*)/g;
  let ultimo = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(t))) {
    if (m.index > ultimo) out.push(t.slice(ultimo, m.index));
    const s = m[0];
    const key = `${k}-${i++}`;
    if (s.startsWith('**')) out.push(<strong key={key}>{s.slice(2, -2)}</strong>);
    else if (s.startsWith('`')) out.push(<code key={key}>{s.slice(1, -1)}</code>);
    else if (s.startsWith('[')) out.push(<a key={key} href={m[2]} target="_blank" rel="noreferrer">{s.slice(1, s.indexOf(']'))}</a>);
    else out.push(<em key={key}>{s.slice(1, -1)}</em>);
    ultimo = m.index + s.length;
  }
  if (ultimo < t.length) out.push(t.slice(ultimo));
  return out;
}

const celulas = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

function blocos(texto: string): ReactNode[] {
  const linhas = texto.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(l);
    if (h) { const N = (`h${Math.min(4, h[1].length + 1)}`) as 'h2' | 'h3' | 'h4'; out.push(<N key={k++}>{inline(h[2], k)}</N>); i++; continue; }
    if (/^\s*\|/.test(l) && i + 1 < linhas.length && /^\s*\|?\s*:?-{3,}/.test(linhas[i + 1])) {
      const cab = celulas(l); i += 2;
      const corpo: string[][] = [];
      while (i < linhas.length && /^\s*\|/.test(linhas[i])) corpo.push(celulas(linhas[i++]));
      out.push(<div key={k++} className="md-tabela"><table><thead><tr>{cab.map((c, j) => <th key={j}>{inline(c, j)}</th>)}</tr></thead>
        <tbody>{corpo.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c, j)}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }
    if (/^\s*([-*]|\d+[.)])\s+/.test(l)) {
      const ordenada = /^\s*\d/.test(l);
      const itens: string[] = [];
      while (i < linhas.length && /^\s*([-*]|\d+[.)])\s+/.test(linhas[i])) itens.push(linhas[i++].replace(/^\s*([-*]|\d+[.)])\s+/, ''));
      const L = ordenada ? 'ol' : 'ul';
      out.push(<L key={k++}>{itens.map((t, j) => <li key={j}>{inline(t, j)}</li>)}</L>);
      continue;
    }
    if (/^>\s?/.test(l)) {
      const cit: string[] = [];
      while (i < linhas.length && /^>\s?/.test(linhas[i])) cit.push(linhas[i++].replace(/^>\s?/, ''));
      out.push(<blockquote key={k++}>{cit.map((t, j) => <Fragment key={j}>{inline(t, j)}{j < cit.length - 1 && <br />}</Fragment>)}</blockquote>);
      continue;
    }
    const par: string[] = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,4}\s|\s*\||\s*([-*]|\d+[.)])\s+|>)/.test(linhas[i])) par.push(linhas[i++]);
    if (!par.length) { par.push(l); i++; }
    out.push(<p key={k++}>{par.map((t, j) => <Fragment key={j}>{inline(t, j)}{j < par.length - 1 && <br />}</Fragment>)}</p>);
  }
  return out;
}
