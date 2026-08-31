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
  /** B3/B4 (doc 32): tolerância MÁXIMA de atraso do degrau (min) — além dela o disparo
   *  perde sentido e a intenção nasce com `validaAte` (o despachante cancela, não envia).
   *  null = sem limite (backlog estilo cobrança). */
  toleranciaMinutos: number | null;
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
    toleranciaMinutos: 90,
    template: "lead_novo_30min",
    texto: "Oi {nome}! Vi que você entrou em contato. Consigo te ajudar com alguma informação sobre os cursos? 😊",
  },
  {
    passo: "+4h",
    offsetMinutos: 240,
    rotulo: "4 horas sem resposta",
    toleranciaMinutos: 240,
    template: "lead_novo_4h",
    texto: "{nome}, ainda por aí? Posso te mandar os horários e valores da turma que combina com você.",
  },
  {
    passo: "+24h",
    offsetMinutos: 1440,
    rotulo: "1 dia sem resposta",
    toleranciaMinutos: 720,
    template: "lead_novo_24h",
    texto: "Olá {nome}! Passando para saber se ficou alguma dúvida. Quer marcar uma aula experimental sem compromisso?",
  },
  {
    passo: "+3d",
    offsetMinutos: 4320,
    rotulo: "3 dias sem resposta",
    toleranciaMinutos: 1440,
    template: "lead_novo_3d",
    texto: "{nome}, seu interesse é importante para nós. Se quiser retomar quando for um bom momento, é só me chamar por aqui.",
  },
  {
    passo: "+7d",
    offsetMinutos: 10080,
    rotulo: "7 dias sem resposta",
    toleranciaMinutos: 2880,
    template: "lead_novo_7d",
    texto: "Oi {nome}! Última mensagem por aqui para não te incomodar. Quando quiser conhecer a escola, estarei à disposição. 🙏",
  },
] as const;

/** Ordem canônica só das chaves (o que o motor precisa para o corte de progresso). */
export const ORDEM_PASSOS_LEAD_NOVO: readonly string[] = CADENCIA_LEAD_NOVO.map((d) => d.passo);

// ── C2 — EXPERIMENTAL (doc 27 · doc 08): ataca o maior vazamento, o no-show ──────────

export const CHAVE_PRE_EXPERIMENTAL = "PRE_EXPERIMENTAL";
export const POLITICA_PRE_EXPERIMENTAL_NOME = "Pré-experimental (confirmação)";

// ÂNCORA = horário da aula experimental. Offsets NEGATIVOS (antes do evento) — o mesmo
// núcleo da cobrança (que já usa D-7/D-3 negativos), agora em minutos.
export const CADENCIA_PRE_EXPERIMENTAL: readonly DegrauLeadNovoFabrica[] = [
  {
    passo: "-24h",
    offsetMinutos: -1440,
    rotulo: "24 horas antes",
    toleranciaMinutos: 600,
    template: "pre_experimental_24h",
    texto:
      "Oi {nome}! Sua aula experimental é amanhã. Podemos confirmar sua presença? Responda SIM para confirmar ou REAGENDAR se precisar de outro horário.",
  },
  {
    passo: "-2h",
    offsetMinutos: -120,
    rotulo: "2 horas antes",
    toleranciaMinutos: 90,
    template: "pre_experimental_2h",
    texto: "{nome}, sua aula experimental é daqui a pouco! Te esperamos. 😊",
  },
] as const;

export const ORDEM_PASSOS_PRE_EXPERIMENTAL: readonly string[] = CADENCIA_PRE_EXPERIMENTAL.map((d) => d.passo);

export const CHAVE_NO_SHOW = "NO_SHOW";
export const POLITICA_NO_SHOW_NOME = "Recuperação de no-show";

// ÂNCORA = horário da aula perdida (o check-in do professor marcou NO_SHOW).
export const CADENCIA_NO_SHOW: readonly DegrauLeadNovoFabrica[] = [
  {
    passo: "+30min",
    offsetMinutos: 30,
    rotulo: "30 min após a falta",
    toleranciaMinutos: 180,
    template: "no_show_30min",
    texto: "Oi {nome}! Percebemos que você não conseguiu participar da aula de hoje. Posso remarcar para outro dia?",
  },
  {
    passo: "+1d",
    offsetMinutos: 1440,
    rotulo: "1 dia após",
    toleranciaMinutos: 720,
    template: "no_show_1d",
    texto: "{nome}, ainda dá tempo de conhecer a escola. Quer que eu veja um novo horário para a experimental?",
  },
  {
    passo: "+3d",
    offsetMinutos: 4320,
    rotulo: "3 dias após",
    toleranciaMinutos: 1440,
    template: "no_show_3d",
    texto: "Olá {nome}! Tenho horários novos abrindo esta semana. Quer remarcar sua aula experimental?",
  },
  {
    passo: "+7d",
    offsetMinutos: 10080,
    rotulo: "7 dias após",
    toleranciaMinutos: 2880,
    template: "no_show_7d",
    texto: "Oi {nome}! Última tentativa por aqui. Se quiser remarcar a experimental, é só me chamar. 🙏",
  },
] as const;

export const ORDEM_PASSOS_NO_SHOW: readonly string[] = CADENCIA_NO_SHOW.map((d) => d.passo);

/** Todas as cadências comerciais (seed + loader + UI). */
export const CADENCIAS_COMERCIAIS = [
  { chave: CHAVE_LEAD_NOVO, nome: POLITICA_LEAD_NOVO_NOME, degraus: CADENCIA_LEAD_NOVO, ordem: ORDEM_PASSOS_LEAD_NOVO },
  {
    chave: CHAVE_PRE_EXPERIMENTAL,
    nome: POLITICA_PRE_EXPERIMENTAL_NOME,
    degraus: CADENCIA_PRE_EXPERIMENTAL,
    ordem: ORDEM_PASSOS_PRE_EXPERIMENTAL,
  },
  { chave: CHAVE_NO_SHOW, nome: POLITICA_NO_SHOW_NOME, degraus: CADENCIA_NO_SHOW, ordem: ORDEM_PASSOS_NO_SHOW },
] as const;
