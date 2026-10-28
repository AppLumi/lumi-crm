// Ícones de traço (24×24) usados no menu e na busca.
const CAMINHOS = {
  inicio: ['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5v-6h-5v6H4a1 1 0 0 1-1-1z'],
  leads: ['M5 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0', 'M2.5 20.5c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6', 'M19 8v6', 'M16 11h6'],
  funil: ['M4 4.5h4v15H4z', 'M10 4.5h4v10h-4z', 'M16 4.5h4v6h-4z'],
  contas: ['M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16', 'M15 9.5h4a1 1 0 0 1 1 1V21', 'M2 21h20', 'M8 8h3', 'M8 12h3', 'M8 16h3'],
  tarefas: ['M8.5 11.5 11.5 14.5 20 6', 'M20 12v6.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-11A2.5 2.5 0 0 1 6.5 5H15'],
  propostas: ['M14 3H6.5A2.5 2.5 0 0 0 4 5.5v13A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V9z', 'M14 3v6h6', 'M8 13h8', 'M8 17h5'],
  emails: ['M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z', 'M4 7l8 6 8-6'],
  relatorios: ['M4 20V11', 'M10 20V5', 'M16 20v-6', 'M21 20H3'],
  configuracoes: ['M4 7h9', 'M19 7h1', 'M4 17h3', 'M13 17h7', 'M14 7a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0', 'M7 17a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0'],
  busca: ['M4 11a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'M20 20l-4-4'],
  sair: ['M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3', 'M10 16.5 14.5 12 10 7.5', 'M14.5 12H3.5'],
  recolher: ['M14.5 6 8.5 12l6 6'],
  expandir: ['M9.5 6l6 6-6 6'],
  mais: ['M12 5v14', 'M5 12h14'],
  seta: ['M5 12h14', 'M13 6l6 6-6 6'],
} as const;

export type NomeIcone = keyof typeof CAMINHOS;

export default function Icone({ nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="icone-svg">
      {CAMINHOS[nome].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
