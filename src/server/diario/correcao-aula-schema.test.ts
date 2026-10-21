import { expect, it } from "vitest";
import { prepararSnapshotCorrecaoAula, type SnapshotCorrecaoAula } from "./correcao-aula-schema";

const fonte: SnapshotCorrecaoAula = { versao: 1, encontroId: "e", diarioId: "d", conteudo: "Conteúdo original",
  gravacao: { tipo: "EXCECAO", decisaoId: "q07" }, registros: [
    { registroId: "r", alunoId: "a", matriculaId: "m", nomeAluno: "Nome histórico", presente: false, participacao: "FALTA", observacao: null },
  ] };

it("mantém autoria cadastral/contrato e fonte, derivando presença da classificação sem alterar o original", () => {
  const novo = prepararSnapshotCorrecaoAula(fonte, { conteudo: "Conteúdo corrigido", registros: [{ registroId: "r", participacao: "PRESENTE", observacao: "  Confirmada  " }] });
  expect(novo.registros[0]).toEqual({ ...fonte.registros[0], presente: true, participacao: "PRESENTE", observacao: "Confirmada" });
  expect(novo.gravacao).toEqual(fonte.gravacao);
  expect(fonte.registros[0]!.participacao).toBe("FALTA");
});

it("impedimento preserva ausência de crédito e normaliza observação vazia", () => {
  const novo = prepararSnapshotCorrecaoAula(fonte, { conteudo: fonte.conteudo, registros: [{ registroId: "r", participacao: "IMPEDIDO_POR_RESTRICAO", observacao: " " }] });
  expect(novo.registros[0]).toMatchObject({ presente: false, participacao: "IMPEDIDO_POR_RESTRICAO", observacao: null });
});

it("recusa substituição, duplicação, omissão ou injeção de identidade", () => {
  for (const registros of [[], [{ registroId: "outro", participacao: "PRESENTE", observacao: null }],
    [{ registroId: "r", participacao: "PRESENTE", observacao: null }, { registroId: "r", participacao: "FALTA", observacao: null }],
    [{ registroId: "r", alunoId: "outro", participacao: "PRESENTE", observacao: null }]]) {
    expect(() => prepararSnapshotCorrecaoAula(fonte, { conteudo: fonte.conteudo, registros } as Parameters<typeof prepararSnapshotCorrecaoAula>[1])).toThrow();
  }
});
