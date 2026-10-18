import { describe, it, expect } from "vitest";
import {
  AcaoAgenteIATipo,
  StatusAcaoAgenteIA,
  MotivoPausaAtendimentoIA,
  StatusVersaoAgenteIA,
  OrigemChamadaIA,
  AcaoOrcamentoIA,
} from "@prisma/client";
import { ATOR_ARIA, payloadDaAria } from "./ator";
import {
  ACAO_AGENTE_IA_LABEL,
  STATUS_ACAO_AGENTE_IA_LABEL,
  MOTIVO_PAUSA_IA_LABEL,
  STATUS_VERSAO_AGENTE_IA_LABEL,
  ORIGEM_CHAMADA_IA_LABEL,
  ACAO_ORCAMENTO_IA_LABEL,
} from "@/lib/labels";

describe("autoria da Aria", () => {
  it("payload_da_aria", () =>
    expect(payloadDaAria("a1", { de: "NOVO", para: "EM_ATENDIMENTO" })).toEqual({
      ator: "ARIA",
      acaoAgenteIAId: "a1",
      de: "NOVO",
      para: "EM_ATENDIMENTO",
    }));

  it("ator_constante", () => expect(ATOR_ARIA).toBe("ARIA"));

  it("rotulos_cobrem_enums", () => {
    const pares: [Record<string, string>, Record<string, string>][] = [
      [AcaoAgenteIATipo, ACAO_AGENTE_IA_LABEL],
      [StatusAcaoAgenteIA, STATUS_ACAO_AGENTE_IA_LABEL],
      [MotivoPausaAtendimentoIA, MOTIVO_PAUSA_IA_LABEL],
      [StatusVersaoAgenteIA, STATUS_VERSAO_AGENTE_IA_LABEL],
      [OrigemChamadaIA, ORIGEM_CHAMADA_IA_LABEL],
      [AcaoOrcamentoIA, ACAO_ORCAMENTO_IA_LABEL],
    ];
    for (const [enumeracao, mapa] of pares)
      for (const v of Object.values(enumeracao)) expect(mapa[v]).toBeTruthy();
  });
});
