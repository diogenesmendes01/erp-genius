// DEFAULTS DE FÁBRICA da régua comercial "lead novo sem resposta" (doc 27 C1 · doc 08).
// Arquivo PURO (só constantes) — consumido pelo seed (tsx) e pelos módulos do app sem puxar
// prisma/env. A cadência do doc 08 é D0·+30min·+4h·+24h·+3d·+7d; o D0 (imediato) é a
// SAUDAÇÃO da C1 (classe reativa) — esta régua cobre os 5 follow-ups quando o lead esfria.

export const CHAVE_LEAD_NOVO = "LEAD_NOVO_SEM_RESPOSTA";
export const POLITICA_LEAD_NOVO_NOME = "Lead novo sem resposta";

export interface DegrauLeadNovoFabrica {
  passo: string;
  offsetMinutos: number;
  rotulo: string;
  /** Nome do TemplateWhatsApp de fábrica (o seed cria; a UI edita depois). */
  template: string;
  texto: string;
}

// ORDEM CANÔNICA e IMUTÁVEL dos passos (lei de código — como ORDEM_PASSOS na cobrança):
// o admin edita offset/ativo/template, a ORDEM relativa nunca muda. É ela que ancora o
// corte de progresso forward-only do motor (regua.ts `proximaAcaoAncora(..., ordem)`).
export const CADENCIA_LEAD_NOVO: readonly DegrauLeadNovoFabrica[] = [
  {
    passo: "+30min",
    offsetMinutos: 30,
    rotulo: "30 min sem resposta",
    template: "lead_novo_30min",
    texto: "Oi {nome}! Vi que você entrou em contato. Consigo te ajudar com alguma informação sobre os cursos? 😊",
  },
  {
    passo: "+4h",
    offsetMinutos: 240,
    rotulo: "4 horas sem resposta",
    template: "lead_novo_4h",
    texto: "{nome}, ainda por aí? Posso te mandar os horários e valores da turma que combina com você.",
  },
  {
    passo: "+24h",
    offsetMinutos: 1440,
    rotulo: "1 dia sem resposta",
    template: "lead_novo_24h",
    texto: "Olá {nome}! Passando para saber se ficou alguma dúvida. Quer marcar uma aula experimental sem compromisso?",
  },
  {
    passo: "+3d",
    offsetMinutos: 4320,
    rotulo: "3 dias sem resposta",
    template: "lead_novo_3d",
    texto: "{nome}, seu interesse é importante para nós. Se quiser retomar quando for um bom momento, é só me chamar por aqui.",
  },
  {
    passo: "+7d",
    offsetMinutos: 10080,
    rotulo: "7 dias sem resposta",
    template: "lead_novo_7d",
    texto: "Oi {nome}! Última mensagem por aqui para não te incomodar. Quando quiser conhecer a escola, estarei à disposição. 🙏",
  },
] as const;

/** Ordem canônica só das chaves (o que o motor precisa para o corte de progresso). */
export const ORDEM_PASSOS_LEAD_NOVO: readonly string[] = CADENCIA_LEAD_NOVO.map((d) => d.passo);
