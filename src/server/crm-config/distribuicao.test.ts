import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";

const { registrarEvento } = vi.hoisted(() => ({ registrarEvento: vi.fn() }));
vi.mock("@/server/_shared", async (orig) => ({ ...(await orig<typeof import("@/server/_shared")>()), registrarEvento }));

import { atribuirAutomaticamente, escolherResponsavel } from "./distribuicao";

const base = { regra: "RODIZIO" as const, participantes: ["a", "b"], ultimoAtribuidoId: null, cargaAberta: {}, donoCarteira: null };

describe("escolherResponsavel", () => {
  it("carteira_vem_primeiro", () => expect(escolherResponsavel({ ...base, donoCarteira: "c" })).toBe("c"));
  it("rodizio_segue_a_ordem", () => expect(escolherResponsavel({ ...base, participantes: ["a", "b", "c"], ultimoAtribuidoId: "b" })).toBe("c"));
  it("rodizio_volta_ao_inicio", () => expect(escolherResponsavel({ ...base, participantes: ["a", "b", "c"], ultimoAtribuidoId: "c" })).toBe("a"));
  it("menor_carga_empate_pela_ordem", () => expect(escolherResponsavel({ ...base, regra: "MENOR_CARGA", cargaAberta: { a: 2, b: 2 } })).toBe("a"));
  it("menor_carga_escolhe_o_menos_carregado", () => expect(escolherResponsavel({ ...base, regra: "MENOR_CARGA", cargaAberta: { a: 3 } })).toBe("b"));
  it("carteira_vale_mesmo_em_manual_ou_sem_participantes", () => {
    expect(escolherResponsavel({ ...base, regra: "MANUAL", donoCarteira: "c" })).toBe("c");
    expect(escolherResponsavel({ ...base, participantes: [], donoCarteira: "c" })).toBe("c");
  });
  it("manual_ou_sem_participantes_vai_para_fila", () => {
    expect(escolherResponsavel({ ...base, regra: "MANUAL" })).toBeNull();
    expect(escolherResponsavel({ ...base, participantes: [] })).toBeNull();
  });
});

// Regra do rodízio no npm test (prisma mockado); o caminho com banco real fica em distribuicao.int.test.ts.
describe("atribuirAutomaticamente (tx mockada)", () => {
  type Atendimento = { finalidade: "COMERCIAL"; status: string; responsavelId: string | null; primeiroInboundEm: Date | null; encerradoEm: Date | null; leadId: string | null; conversa: { grupoId: string | null; contato: { leadId: string | null } } };
  const novo = (over: Partial<Atendimento> = {}): Atendimento => ({
    finalidade: "COMERCIAL", status: "ABERTO_SEM_RESPONSAVEL", responsavelId: null, primeiroInboundEm: null, encerradoEm: null, leadId: null,
    conversa: { grupoId: null, contato: { leadId: null } }, ...over,
  });
  function txCom(a: Atendimento, cfg: { regraDistribuicao: "RODIZIO" | "MENOR_CARGA" | "MANUAL"; participantesIds: string[]; ultimoAtribuidoId: string | null }, ativos = cfg.participantesIds) {
    const tx = {
      atendimentoWhatsApp: {
        findUnique: vi.fn().mockResolvedValue(a),
        groupBy: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue({}),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]),
      prazoRespostaSetor: { findUniqueOrThrow: vi.fn().mockResolvedValue(cfg), update: vi.fn().mockResolvedValue({}) },
      usuario: { findMany: vi.fn().mockResolvedValue(ativos.map((id) => ({ id }))), findFirst: vi.fn() },
      oportunidade: { findUnique: vi.fn() },
    };
    return { tx, comoTx: tx as unknown as Prisma.TransactionClient };
  }
  beforeEach(() => registrarEvento.mockReset());

  it("rodizio_atribui_o_proximo_e_avanca_o_ponteiro", async () => {
    const { tx, comoTx } = txCom(novo(), { regraDistribuicao: "RODIZIO", participantesIds: ["a", "b", "c"], ultimoAtribuidoId: "a" });
    expect(await atribuirAutomaticamente(comoTx, "at1")).toBe("b");
    expect(tx.atendimentoWhatsApp.update).toHaveBeenCalledWith({ where: { id: "at1" }, data: { responsavelId: "b", status: "EM_ATENDIMENTO" } });
    expect(tx.prazoRespostaSetor.update).toHaveBeenCalledWith({ where: { finalidade: "COMERCIAL" }, data: { ultimoAtribuidoId: "b" } });
    expect(registrarEvento).toHaveBeenCalledWith(comoTx, expect.objectContaining({ tipo: "AtendimentoAtribuido", payload: { atendimentoId: "at1", responsavelId: "b", motivo: "RODIZIO" } }));
  });

  it("rodizio_pula_participante_inativo", async () => {
    const { comoTx } = txCom(novo(), { regraDistribuicao: "RODIZIO", participantesIds: ["a", "b", "c"], ultimoAtribuidoId: "a" }, ["a", "c"]);
    expect(await atribuirAutomaticamente(comoTx, "at1")).toBe("c");
  });

  it("nao_reatribui_atendimento_com_responsavel_ou_ja_com_inbound", async () => {
    for (const a of [novo({ responsavelId: "x" }), novo({ primeiroInboundEm: new Date() }), novo({ conversa: { grupoId: "g", contato: { leadId: null } } })]) {
      const { tx, comoTx } = txCom(a, { regraDistribuicao: "RODIZIO", participantesIds: ["a", "b"], ultimoAtribuidoId: null });
      expect(await atribuirAutomaticamente(comoTx, "at1")).toBeNull();
      expect(tx.atendimentoWhatsApp.update).not.toHaveBeenCalled();
      expect(tx.prazoRespostaSetor.update).not.toHaveBeenCalled();
    }
    expect(registrarEvento).not.toHaveBeenCalled();
  });

  it("manual_ou_setor_sem_linha_fica_na_fila", async () => {
    const manual = txCom(novo(), { regraDistribuicao: "MANUAL", participantesIds: ["a"], ultimoAtribuidoId: null });
    expect(await atribuirAutomaticamente(manual.comoTx, "at1")).toBeNull();
    const semLinha = txCom(novo(), { regraDistribuicao: "RODIZIO", participantesIds: ["a"], ultimoAtribuidoId: null });
    semLinha.tx.$queryRaw.mockResolvedValue([]);
    expect(await atribuirAutomaticamente(semLinha.comoTx, "at1")).toBeNull();
    expect(semLinha.tx.prazoRespostaSetor.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
