/** Funções que só o motor próprio executa; ficam visíveis e desabilitadas, com este aviso, até a Fase 4. */
export type RecursoMotor =
  | "editar" | "apagar" | "reagir" | "enquete" | "figurinha" | "gif" | "localizacao" | "cartaoContato"
  | "responderCitando" | "confirmacaoLeitura" | "digitando" | "grupoEnviar" | "grupoGerir" | "bloquear";

export const AVISO_RECURSO_MOTOR = "Disponível quando o motor próprio da escola entrar em uso.";
