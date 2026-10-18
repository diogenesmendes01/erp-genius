import type { AcaoAgenteIATipo, EtapaLead } from "@prisma/client";

export const ETAPAS_ARIA: EtapaLead[] = [
  "NOVO",
  "EM_ATENDIMENTO",
  "QUALIFICADO",
  "EXPERIMENTAL_AGENDADA",
  "EXPERIMENTAL_REALIZADA",
  "PROPOSTA",
  "AGUARDANDO_MATRICULA",
  "NO_SHOW",
];

export const ACOES_MATRIZ: AcaoAgenteIATipo[] = [
  "RESPONDER",
  "ENVIAR_DOCUMENTO",
  "ATUALIZAR_CAMPO",
  "TAG",
  "MOVER_ETAPA",
  "MARCAR_PERDIDO",
  "CRIAR_TAREFA",
  "AGENDAR_MENSAGEM",
  "NOTA_INTERNA",
  "CONDICAO_COMERCIAL",
];

export type ModoAcao = "EXECUTA" | "SUGERE" | "NAO_FAZ";
export type Matriz = Partial<Record<EtapaLead, Partial<Record<AcaoAgenteIATipo, ModoAcao>>>>;

const MODO: Record<string, ModoAcao> = { e: "EXECUTA", s: "SUGERE", o: "NAO_FAZ" };

// Cada linha tem 8 letras, na ordem de ETAPAS_ARIA.
type Linha = Partial<Record<AcaoAgenteIATipo, string>>;

function montar(tudo: string, linhas: Linha): Matriz {
  const matriz: Matriz = {};
  ETAPAS_ARIA.forEach((etapa, i) => {
    const celula: Partial<Record<AcaoAgenteIATipo, ModoAcao>> = {};
    for (const acao of ACOES_MATRIZ) {
      const padrao = tudo.repeat(ETAPAS_ARIA.length);
      const linha = linhas[acao] ?? padrao;
      celula[acao] = MODO[linha[i]];
    }
    matriz[etapa] = celula;
  });
  return matriz;
}

const resp = (s: string, e: string, a: string) => ({
  SUPERVISAO: s,
  EQUILIBRADO: e,
  AUTONOMO: a,
});
const TABELA: Partial<Record<AcaoAgenteIATipo, ReturnType<typeof resp>>> = {
  RESPONDER: resp("ssssssss", "eeeeeess", "eeeeeeee"),
  ENVIAR_DOCUMENTO: resp("ssssssss", "eeeeeess", "eeeeeeee"),
  MOVER_ETAPA: resp("ssssssss", "eeessoos", "eeeeeeee"),
  MARCAR_PERDIDO: resp("ssssssss", "eeessoos", "eeeeeeee"),
  AGENDAR_MENSAGEM: resp("ssssssss", "eeessses", "eeeeeeee"),
  CONDICAO_COMERCIAL: resp("oooooooo", "ooooosso", "oooooeeo"),
};

function predefinicao(nome: "SUPERVISAO" | "EQUILIBRADO" | "AUTONOMO", tudo: string): Matriz {
  const linhas: Linha = {};
  for (const [acao, r] of Object.entries(TABELA)) linhas[acao as AcaoAgenteIATipo] = r[nome];
  return montar(tudo, linhas);
}

export const PREDEFINICOES: Record<"SUPERVISAO" | "EQUILIBRADO" | "AUTONOMO", Matriz> = {
  SUPERVISAO: predefinicao("SUPERVISAO", "s"),
  EQUILIBRADO: predefinicao("EQUILIBRADO", "e"),
  AUTONOMO: predefinicao("AUTONOMO", "e"),
};
