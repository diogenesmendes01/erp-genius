import {
  EtapaLead,
  Temperatura,
  Segmento,
  MotivoPerda,
  StatusMatricula,
  StatusCobranca,
  StatusComissao,
  StatusAluno,
  TipoCobranca,
  FormaPagamento,
  Genero,
  Escolaridade,
} from "@prisma/client";

// Rótulos legíveis (pt-BR) dos enums do domínio. Fonte única para a UI.

export const ETAPA_LABEL: Record<EtapaLead, string> = {
  NOVO: "Novo",
  EM_ATENDIMENTO: "1º Contato",
  QUALIFICADO: "Qualificado",
  EXPERIMENTAL_AGENDADA: "Exp. Agendada",
  EXPERIMENTAL_REALIZADA: "Exp. Realizada",
  PROPOSTA: "Proposta",
  AGUARDANDO_MATRICULA: "Aguardando Matrícula",
  MATRICULADO: "Matriculado",
  NO_SHOW: "No-show",
  PERDIDO: "Perdido",
};

export const TEMPERATURA_LABEL: Record<Temperatura, string> = {
  QUENTE: "Quente",
  MORNO: "Morno",
  FRIO: "Frio",
};

export const TEMPERATURA_CLS: Record<Temperatura, string> = {
  QUENTE: "bg-red-100 text-red-700",
  MORNO: "bg-amber-100 text-amber-700",
  FRIO: "bg-blue-100 text-blue-700",
};

export const SEGMENTO_LABEL: Record<Segmento, string> = {
  ADULTO: "Adulto",
  KIDS: "Kids",
  TEENS: "Teens",
  EMPRESA: "Empresa",
};

export const MOTIVO_PERDA_LABEL: Record<MotivoPerda, string> = {
  NAO_RESPONDEU: "Não respondeu",
  PRECO: "Preço",
  TEMPO: "Tempo/Horário",
  CONCORRENCIA: "Concorrência",
  INTERESSE: "Sem interesse",
  LOCALIZACAO: "Localização",
  EMPRESA: "Empresa (B2B)",
  QUALIFICACAO: "Qualificação",
  OUTRO: "Outro",
};

export const STATUS_MATRICULA_LABEL: Record<StatusMatricula, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO: "Aguardando",
  ATIVA: "Ativa",
  ENCERRADA: "Encerrada",
  CANCELADA: "Cancelada",
};

export const STATUS_COBRANCA_LABEL: Record<StatusCobranca, string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  ATRASADO: "Atrasado",
  CANCELADA: "Cancelada",
};

export const STATUS_COMISSAO_LABEL: Record<StatusComissao, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  PAGA: "Paga",
  ESTORNADA: "Estornada",
};

export const STATUS_ALUNO_LABEL: Record<StatusAluno, string> = {
  ATIVO: "Ativo",
  PAUSADO: "Pausado",
  ENCERRADO: "Encerrado",
};

export const TIPO_COBRANCA_LABEL: Record<TipoCobranca, string> = {
  MATRICULA: "Taxa de matrícula",
  MENSALIDADE: "Mensalidade",
  HORA_PARTICULAR: "Hora particular",
  MATERIAL: "Material",
  CERTIFICADO: "Certificado",
};

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  TRANSFERENCIA: "Transferência",
  GREENPAY: "GreenPay",
  DINHEIRO: "Dinheiro",
  CARTAO: "Cartão",
};

// Gênero (doc 09 §Identificação) — lista curta. NAO_INFORMADO = "Prefiro não informar".
export const GENERO_LABEL: Record<Genero, string> = {
  MASCULINO: "Masculino",
  FEMININO: "Feminino",
  NAO_INFORMADO: "Prefiro não informar",
};

// Escolaridade (doc 09 §Acadêmico) — lista fechada, ordem crescente.
export const ESCOLARIDADE_LABEL: Record<Escolaridade, string> = {
  FUNDAMENTAL_INCOMPLETO: "Ensino fundamental incompleto",
  FUNDAMENTAL_COMPLETO: "Ensino fundamental completo",
  MEDIO_INCOMPLETO: "Ensino médio incompleto",
  MEDIO_COMPLETO: "Ensino médio completo",
  TECNICO: "Técnico",
  SUPERIOR_INCOMPLETO: "Superior incompleto",
  SUPERIOR_COMPLETO: "Superior completo",
  POS_GRADUACAO: "Pós-graduação",
  MESTRADO: "Mestrado",
  DOUTORADO: "Doutorado",
};
