// Junta conhecimento/*.md num módulo para a função do assistente (api/_conhecimento.ts).
// Rode depois de editar a base: node scripts/conhecimento.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../conhecimento/', import.meta.url);
const ordem = ['produto.md', 'nr1.md', 'vendas.md', 'faq.md', 'blog.md'];
const arquivos = readdirSync(dir).filter((f) => f.endsWith('.md')).sort((a, b) => (ordem.indexOf(a) + 1 || 99) - (ordem.indexOf(b) + 1 || 99));
const texto = arquivos.map((f) => `<arquivo nome="${f}">\n${readFileSync(new URL(f, dir), 'utf8').trim()}\n</arquivo>`).join('\n\n');
writeFileSync(new URL('../api/_conhecimento.ts', import.meta.url),
  `// Gerado por scripts/conhecimento.mjs a partir de conhecimento/*.md. Não edite à mão.\nexport const CONHECIMENTO = ${JSON.stringify(texto)};\n`);
console.log(`${arquivos.length} arquivos, ${texto.split(/\s+/).length} palavras`);
