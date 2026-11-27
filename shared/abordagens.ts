// Cadências de abordagem sugeridas para listas de prospecção (ex.: clientes da Grou).
// Os textos seguem o documento "Abordagem Lumi para clientes Grou". Variáveis: {{primeiro_nome}}, {{empresa}}, {{remetente}}.

export type CanalAbordagem = 'email' | 'whatsapp' | 'linkedin' | 'ligacao';

export interface PassoAbordagem {
  id: string;
  rotulo: string;
  dia: number;
  canal: CanalAbordagem;
  quando: string;
  assunto?: string;
  texto: string;
}

export interface Cadencia { nome: string; origem: string; passos: PassoAbordagem[] }

const CLIENTES_GROU: Cadencia = {
  nome: 'Clientes Grou',
  origem: 'prospeccao_clientes_grou',
  passos: [
    {
      id: 'email1', rotulo: 'E-mail 1 · primeiro contato', dia: 0, canal: 'email', quando: 'Primeiro contato, citando a Grou e a NR-1.',
      assunto: '{{empresa}} + Grou: um passo além na NR-1',
      texto: `Oi, {{primeiro_nome}}, tudo bem?

Sou {{remetente}}, do Lumi, a plataforma de saúde emocional do mesmo grupo da Grou, que já trabalha com a {{empresa}}.

Desde maio, a NR-1 pede que as empresas mapeiem e gerenciem os riscos psicossociais no PGR. O Lumi faz esse diagnóstico por setor, sem identificar ninguém, monta o plano de ação com as evidências e ainda dá ao time apoio no dia a dia pelo aplicativo.

Faz sentido conversarmos 30 minutos para eu mostrar como ficaria para a {{empresa}}?

Se não for com você, me diz quem cuida disso por aí. E se preferir não receber mais mensagens minhas, é só responder "não".

{{remetente}}
Lumi · applumi.io`,
    },
    {
      id: 'linkedin1', rotulo: 'LinkedIn · convite', dia: 2, canal: 'linkedin', quando: 'Pedido de conexão com nota curta, sem link (até 300 caracteres).',
      texto: 'Oi, {{primeiro_nome}}! Sou do Lumi, do mesmo grupo da Grou, que já trabalha com a {{empresa}}. Cuido de saúde emocional e NR-1 em empresas e gostaria de te ter na rede.',
    },
    {
      id: 'whatsapp1', rotulo: 'WhatsApp', dia: 5, canal: 'whatsapp', quando: 'Só se a pessoa já falava com a Grou por WhatsApp. Uma mensagem, sem áudio.',
      texto: 'Oi, {{primeiro_nome}}, aqui é {{remetente}}, do Lumi (mesmo grupo da Grou). Te mandei um e-mail sobre NR-1 e saúde emocional do time. Posso te mostrar em 30 minutos como funciona? Se não fizer sentido, é só me avisar que não volto a escrever.',
    },
    {
      id: 'email2', rotulo: 'E-mail 2 · conteúdo útil', dia: 7, canal: 'email', quando: 'Retomada com um conteúdo útil do blog.',
      assunto: 'Re: {{empresa}} + Grou: um passo além na NR-1',
      texto: `Oi, {{primeiro_nome}}, voltando aqui com uma coisa útil, mesmo que a gente não converse agora: no blog do Lumi há guias práticos sobre NR-1, riscos psicossociais e saúde emocional no trabalho: https://applumi.io/blog/

Se a NR-1 estiver na pauta da {{empresa}} neste semestre, posso te mostrar em 30 minutos como o Lumi organiza o diagnóstico e o plano. Que dia fica melhor?

{{remetente}}
Lumi · applumi.io`,
    },
    {
      id: 'ligacao', rotulo: 'Ligação', dia: 10, canal: 'ligacao', quando: 'Duas tentativas em horários diferentes, até 2 minutos.',
      texto: `1. "Oi, {{primeiro_nome}}, aqui é {{remetente}}, do Lumi, do mesmo grupo da Grou. Tem um minuto?"
2. "Te escrevi sobre a parte psicossocial da NR-1. Como vocês estão organizando isso hoje?"
3. Escutar e anotar: já fizeram o diagnóstico? Com qual ferramenta? Quem decide?
4. "Posso te mostrar em 30 minutos como o Lumi faz o diagnóstico e o plano. Quinta ou sexta fica melhor?"
5. Sem interesse: agradecer, perguntar se pode voltar a falar em 90 dias e anotar o motivo.`,
    },
    {
      id: 'email3', rotulo: 'E-mail 3 · encerramento', dia: 14, canal: 'email', quando: 'Encerramento educado, porta aberta.',
      assunto: 'Re: {{empresa}} + Grou: um passo além na NR-1',
      texto: `Oi, {{primeiro_nome}}, não quero encher sua caixa, então este é meu último e-mail por enquanto.

Se em algum momento a saúde emocional do time ou a NR-1 virarem prioridade, é só responder esta mensagem que eu retomo. Obrigado pela atenção e um abraço para o time da {{empresa}}.

{{remetente}}
Lumi · applumi.io`,
    },
  ],
};

const CADENCIAS: Cadencia[] = [CLIENTES_GROU];

/** Cadência sugerida para a origem do contato (ou nenhuma). */
export const cadenciaPara = (origem: string | null | undefined): Cadencia | null => CADENCIAS.find((c) => c.origem === origem) ?? null;

export const preencherTexto = (t: string, v: Record<string, string>) => t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => v[k] ?? '');

/** Título da atividade que marca um passo como feito na linha do tempo. */
export const tituloPasso = (p: PassoAbordagem) => `Cadência · ${p.rotulo} (dia ${p.dia})`;

/** O próximo passo é o primeiro ainda não feito; "atrasado" quando o dia dele já passou. */
export function proximoPasso(c: Cadencia, feitos: Set<string>, dias: number): { passo: PassoAbordagem; situacao: 'atrasado' | 'hoje' | 'futuro' } | null {
  const p = c.passos.find((x) => !feitos.has(x.id));
  if (!p) return null;
  return { passo: p, situacao: p.dia < dias ? 'atrasado' : p.dia === dias ? 'hoje' : 'futuro' };
}

/** Link do WhatsApp com a mensagem já escrita. */
export const zapComTexto = (numero: string | null, texto: string) => {
  const n = (numero ?? '').replace(/\D/g, '');
  if (n.length < 10) return null;
  return `https://wa.me/${n.startsWith('55') ? n : '55' + n}?text=${encodeURIComponent(texto)}`;
};
