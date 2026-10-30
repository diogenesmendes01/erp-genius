import { describe, expect, it } from "vitest";
import { StatusTurma } from "@prisma/client";
import { ErroRegra } from "@/server/_shared/sessao";
import { exigirTransicao, transicaoPermitida, TRANSICOES_PERMITIDAS } from "./transicoes";

const S = StatusTurma;
const ESPERADO: Record<StatusTurma, Record<StatusTurma, boolean>> = {
  PLANEJADA: { PLANEJADA: false, ABERTA: true, EM_ANDAMENTO: true, CONCLUIDA: false },
  ABERTA: { PLANEJADA: true, ABERTA: false, EM_ANDAMENTO: true, CONCLUIDA: false },
  EM_ANDAMENTO: { PLANEJADA: false, ABERTA: false, EM_ANDAMENTO: false, CONCLUIDA: true },
  CONCLUIDA: { PLANEJADA: false, ABERTA: false, EM_ANDAMENTO: false, CONCLUIDA: false },
};
const pares = (Object.keys(ESPERADO) as StatusTurma[]).flatMap((de) => (Object.keys(ESPERADO[de]) as StatusTurma[]).map((para) => [de, para, ESPERADO[de][para]] as const));

describe("tabela de transições de turma (#539)", () => {
  it("cobre os 4 status do enum, de e para", () => {
    expect(Object.keys(TRANSICOES_PERMITIDAS).sort()).toEqual(Object.values(S).sort());
    expect(pares).toHaveLength(16);
  });

  it.each(pares)("%s → %s permitida=%s", (de, para, permitida) => {
    expect(transicaoPermitida(de, para)).toBe(permitida);
    if (permitida) expect(() => exigirTransicao(de, para)).not.toThrow();
    else {
      expect(() => exigirTransicao(de, para)).toThrow(ErroRegra);
      expect(() => exigirTransicao(de, para)).toThrow(`Transição de status inválida: ${de} → ${para}.`);
    }
  });

  it("mantém PLANEJADA → EM_ANDAMENTO usada pelo início automático da agenda", () => {
    expect(TRANSICOES_PERMITIDAS.PLANEJADA).toContain(S.EM_ANDAMENTO);
  });

  it("status desconhecido é recusado", () => {
    expect(transicaoPermitida("ATIVA" as StatusTurma, S.ABERTA)).toBe(false);
    expect(() => exigirTransicao("ATIVA" as StatusTurma, S.ABERTA)).toThrow(ErroRegra);
  });
});
