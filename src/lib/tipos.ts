export type Papel = 'socia' | 'negocios' | 'marketing' | 'tecnologia';
export type EstagioConta = 'lead' | 'oportunidade' | 'cliente' | 'ex_cliente';
export type StatusLead = 'novo' | 'em_contato' | 'qualificado' | 'nutricao' | 'descartado';
export type Etapa = 'qualificacao' | 'diagnostico' | 'demo' | 'piloto' | 'proposta' | 'negociacao' | 'ganha' | 'perdida';
export type Plano = 'starter' | 'premium';
export type StatusProposta = 'rascunho' | 'aguardando_aprovacao' | 'aprovada' | 'enviada' | 'aceita' | 'recusada' | 'expirada';
export type TipoAtividade = 'nota' | 'email' | 'ligacao' | 'reuniao' | 'whatsapp' | 'tarefa' | 'sistema';

export interface Perfil { id: string; nome: string; email: string; papel: Papel; aprova_desconto: boolean; ativo: boolean }

export interface Conta {
  id: string; cnpj: string | null; razao_social: string | null; nome: string; cnae: string | null; setor: string | null;
  porte: string | null; colaboradores: number | null; cidade: string | null; uf: string | null; site: string | null;
  estagio: EstagioConta; dono: string | null; origem: string | null; lumi_cliente_id: string | null; notas: string | null;
  criado_em: string; atualizado_em: string;
}

export interface Contato {
  id: string; conta_id: string | null; nome: string; cargo: string | null; papel: 'decisor' | 'influenciador' | 'usuario_painel' | 'outro';
  email: string | null; whatsapp: string | null; linkedin: string | null; aceita_marketing: boolean; descadastrado_em: string | null;
}

export interface Lead {
  id: string; nome: string; email: string | null; whatsapp: string | null; empresa: string | null; cnpj: string | null;
  cargo: string | null; colaboradores: number | null; mensagem: string | null; origem: string; utm_source: string | null;
  utm_medium: string | null; utm_campaign: string | null; pagina: string | null; evento: string | null;
  aceita_marketing: boolean; status: StatusLead; nota_perfil: number; nota_interesse: number; dono: string | null;
  dono_nome: string | null; conta_id: string | null; oportunidade_id: string | null;
  enriquecimento: Record<string, string | null> | null; motivo_descarte: string | null; primeiro_contato_em: string | null; criado_em: string;
}

export interface Oportunidade {
  id: string; conta_id: string; conta_nome: string; titulo: string; etapa: Etapa; etapa_desde: string; plano: Plano;
  vidas: number | null; valor_mensal: number | null; valor_implementacao: number | null; valor_primeiro_ano: number | null;
  previsao_fechamento: string | null; dono: string | null; dono_nome: string | null; dor: string | null; decisor_id: string | null;
  situacao_pgr: string | null; criterio_decisao: string | null; demo_em: string | null; piloto_escopo: string | null;
  piloto_resultado: string | null; condicoes_finais: string | null; motivo_perda: string | null; motivo_perda_detalhe: string | null;
  fechada_em: string | null; probabilidade: number; dias_na_etapa: number; criado_em: string;
}

export interface Proposta {
  id: string; oportunidade_id: string; versao: number; plano: Plano; vidas: number; preco_vida: number; mensal_tabela: number;
  desconto_pct: number; mensal: number; implementacao_tabela: number; desconto_implementacao_pct: number; implementacao: number;
  primeiro_ano: number; piso_aplicado: boolean; validade: string; observacoes: string | null; status: StatusProposta;
  motivo_aprovacao: string | null; aprovado_por: string | null; aprovado_em: string | null; token: string; enviada_em: string | null;
  visualizada_em: string | null; respondida_em: string | null; criado_em: string;
}

export interface Atividade {
  id: string; tipo: TipoAtividade; titulo: string; descricao: string | null; conta_id: string | null; contato_id: string | null;
  lead_id: string | null; oportunidade_id: string | null; autor: string | null; responsavel: string | null;
  vence_em: string | null; concluida_em: string | null; criado_em: string;
}

export interface ModeloEmail { id: string; nome: string; categoria: string; assunto: string; corpo: string; ativo: boolean }
