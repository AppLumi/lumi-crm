// Regras puras das respostas por e-mail (sem rede, sem banco): endereço de resposta, conversa, citação e automáticas.

/** Parte antes do @, só com o que é seguro num endereço (bruna.salazar@applumi.io → bruna.salazar). */
export function localDoEmail(email: string): string {
  return String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

/** Para onde as respostas vão. Sem domínio de respostas configurado, continua indo pro e-mail da pessoa. */
export function enderecoResposta(emailPessoa: string, dominioRespostas?: string | null): string {
  const d = String(dominioRespostas ?? '').trim().toLowerCase().replace(/^@/, '');
  const local = localDoEmail(emailPessoa);
  return d && local ? `${local}@${d}` : emailPessoa;
}

/** Endereço puro de "Nome <a@b.c>" ou "a@b.c". */
export function enderecoDe(v: string | null | undefined): string {
  const s = String(v ?? '');
  const m = /<([^>]+)>/.exec(s);
  return (m ? m[1] : s).trim().toLowerCase();
}

/** Nome de "Nome Sobrenome <a@b.c>", sem aspas; null quando não tem. */
export function nomeDe(v: string | null | undefined): string | null {
  const m = /^\s*"?([^"<]+?)"?\s*</.exec(String(v ?? ''));
  return m ? m[1].trim() || null : null;
}

/** Cabeçalho de um objeto de cabeçalhos, sem diferenciar maiúsculas; junta quando vem em lista. */
export function cabecalho(h: Record<string, unknown> | null | undefined, nome: string): string {
  if (!h) return '';
  const k = Object.keys(h).find((x) => x.toLowerCase() === nome.toLowerCase());
  const v = k ? h[k] : undefined;
  return Array.isArray(v) ? v.join(' ') : v == null ? '' : String(v);
}

/** Message-IDs (<...>) citados em In-Reply-To e References, sem repetir, do mais recente pro mais antigo. */
export function idsDaConversa(inReplyTo: string, references: string): string[] {
  const todos = `${inReplyTo} ${references}`.match(/<[^<>\s]+>/g) ?? [];
  const vistos = new Set<string>();
  const saida: string[] = [];
  // In-Reply-To primeiro (é a mensagem respondida); depois References do fim pro começo
  const ordem = [...(inReplyTo.match(/<[^<>\s]+>/g) ?? []), ...(references.match(/<[^<>\s]+>/g) ?? []).reverse(), ...todos];
  for (const id of ordem) if (!vistos.has(id)) { vistos.add(id); saida.push(id); }
  return saida;
}

/** Cabeçalhos pra responder na mesma conversa (o e-mail aparece agrupado na caixa da pessoa). */
export function cabecalhosResposta(messageId: string | null, referencias: string | null): Record<string, string> {
  if (!messageId) return {};
  const refs = [...(String(referencias ?? '').match(/<[^<>\s]+>/g) ?? [])].filter((x) => x !== messageId);
  return { 'In-Reply-To': messageId, References: [...refs.slice(-20), messageId].join(' ') };
}

/** "Re: assunto", sem empilhar "Re: Re:". */
export function assuntoResposta(assunto: string | null | undefined): string {
  const a = String(assunto ?? '').trim();
  return /^(re|res|resp|aw|sv)\s*:/i.test(a) ? a : `Re: ${a || '(sem assunto)'}`;
}

/** HTML → texto simples, pra quando o e-mail chega sem a versão em texto. */
export function htmlParaTexto(html: string): string {
  return String(html)
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// linhas que abrem o histórico citado (Gmail, Outlook, Apple Mail, em português e inglês)
const INICIO_CITACAO = [
  /^em .{3,200}(escreveu|wrote)\s*:?\s*$/i,
  /^on .{3,200}wrote\s*:?\s*$/i,
  /^-{2,}\s*(mensagem original|original message|forwarded message|mensagem encaminhada)\s*-{2,}/i,
  /^_{8,}\s*$/,
  /^(de|from)\s*:\s*.+@.+/i,
  /^enviado do meu (iphone|android|celular)/i,
  /^sent from my /i,
];

/** Só o que a pessoa escreveu agora: corta o histórico citado e a assinatura padrão "--". */
export function extrairResposta(texto: string): string {
  const linhas = String(texto ?? '').replace(/\r/g, '').split('\n');
  const saida: string[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i].trim();
    // "Em seg., 2 de dez. de 2026 às 10:00, Bruna" + "<bruna@...> escreveu:" quebrado em duas linhas
    const juntas = `${l} ${String(linhas[i + 1] ?? '').trim()}`;
    if (INICIO_CITACAO.some((r) => r.test(l)) || (/^(em|on) /i.test(l) && /(escreveu|wrote)\s*:?\s*$/i.test(juntas))) break;
    if (/^>/.test(l)) break;
    if (l === '--' || l === '-- ') break;
    saida.push(linhas[i]);
  }
  const r = saida.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return r || String(texto ?? '').trim();
}

/** Resposta automática (férias, fora do escritório, confirmação de recebimento): não vira tarefa nem aviso. */
export function ehAutomatico(headers: Record<string, unknown> | null | undefined, assunto: string | null | undefined): boolean {
  const auto = cabecalho(headers, 'auto-submitted').toLowerCase();
  if (auto && auto !== 'no') return true;
  if (cabecalho(headers, 'x-autoreply') || cabecalho(headers, 'x-autorespond')) return true;
  if (/^(auto_reply|bulk|junk)$/i.test(cabecalho(headers, 'precedence').trim())) return true;
  return /^(resposta autom[aá]tica|automatic reply|auto(matic)?[- ]?reply|out of (the )?office|fora do escrit[oó]rio|(estou )?ausente (at[eé]|do escrit[oó]rio)|aus[eê]ncia tempor[aá]ria|(estou )?(de )?f[eé]rias (at[eé]|de \d)|recebemos (seu|sua) (e-?mail|mensagem)|confirma[cç][aã]o de (recebimento|leitura))/i
    .test(String(assunto ?? '').replace(/^(re|res|aw)\s*:\s*/i, '').trim());
}

/** Prazo da tarefa "responder": o próximo dia útil às 12h de Brasília (sábado e domingo pulam pra segunda). */
export function prazoResponder(agora: Date): string {
  const brt = new Date(agora.getTime() - 3 * 3600 * 1000);
  const d = new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate() + 1, 15, 0, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/** Texto citado no fim da resposta enviada pelo CRM ("Em 02/12/2026, Ana escreveu:" + linhas com "> "). */
export function citar(original: string, quem: string, quando: Date): string {
  const data = quando.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const linhas = String(original ?? '').trim().split('\n').slice(0, 60).map((l) => `> ${l}`);
  return `Em ${data}, ${quem} escreveu:\n${linhas.join('\n')}`;
}
