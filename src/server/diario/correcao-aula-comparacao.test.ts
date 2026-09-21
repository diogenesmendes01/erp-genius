import { expect, it } from "vitest";
import { compararCorrecaoAula } from "./correcao-aula-comparacao";
import { prepararSnapshotCorrecaoAula, type SnapshotCorrecaoAula } from "./correcao-aula-schema";

const fonte: SnapshotCorrecaoAula = { versao: 1, encontroId: "e", diarioId: "d", conteudo: "Original", gravacao: null,
  registros: [{ registroId: "r", alunoId: "a", matriculaId: "m", nomeAluno: "Aluno", presente: false, participacao: "FALTA", observacao: null }] };

it("sinaliza reposição pendente e concluída somente da matrícula corrigida, sem apagar a fonte", () => {
  const novo = prepararSnapshotCorrecaoAula(fonte, { conteudo: "Novo", registros: [{ registroId: "r", participacao: "PRESENTE", observacao: null }] });
  const reposicoes = [{ id: "p", matriculaId: "m", concluida: false }, { id: "c", matriculaId: "m", concluida: true }, { id: "outro", matriculaId: "m2", concluida: true }];
  const resultado = compararCorrecaoAula(fonte, novo, reposicoes);
  expect(resultado.registros[0]!.reposicoesParaConferencia).toEqual([
    { id: "p", conclusaoRegistrada: false, motivo: "ORIGEM_PASSA_A_PRESENCA" },
    { id: "c", conclusaoRegistrada: true, motivo: "ORIGEM_PASSA_A_PRESENCA" },
  ]);
  expect(fonte.registros[0]!.participacao).toBe("FALTA");
  expect(reposicoes[1]!.concluida).toBe(true);
});

it("pedido rejeitado deixa de bloquear, mas ausência de decisão e conclusão contraditória exigem conferência", () => {
  const novo = prepararSnapshotCorrecaoAula(fonte, { conteudo: "Novo", registros: [{ registroId: "r", participacao: "PRESENTE", observacao: null }] });
  const reposicoes = [
    { id: "rejeitado", matriculaId: "m", concluida: false, decisao: { id: "d1", aprovada: false } },
    { id: "pendente", matriculaId: "m", concluida: false, decisao: null },
    { id: "autorizado", matriculaId: "m", concluida: false, decisao: { id: "d2", aprovada: true } },
    { id: "inconsistente", matriculaId: "m", concluida: true, decisao: { id: "d3", aprovada: false } },
  ];
  expect(compararCorrecaoAula(fonte, novo, reposicoes).registros[0]!.reposicoesParaConferencia.map(r => r.id))
    .toEqual(["pendente", "autorizado", "inconsistente"]);
  expect(reposicoes[0]?.decisao).toEqual({ id: "d1", aprovada: false });
});

it("separa observação de classificação e não inventa efeito sobre reposição", () => {
  const novo = prepararSnapshotCorrecaoAula(fonte, { conteudo: fonte.conteudo, registros: [{ registroId: "r", participacao: "FALTA", observacao: "Observação corrigida" }] });
  expect(compararCorrecaoAula(fonte, novo, [{ id: "p", matriculaId: "m", concluida: true }]).registros[0])
    .toMatchObject({ participacaoAlterada: false, observacaoAlterada: true, reposicoesParaConferencia: [] });
});

it("recusa snapshot adulterado que troca contrato, omite classificação ou duplica registro", () => {
  const registro = fonte.registros[0]!;
  for (const registros of [[{ ...registro, matriculaId: "outro" }], [{ ...registro, participacao: undefined }], [registro, registro]]) {
    expect(() => compararCorrecaoAula(fonte, { ...fonte, registros }, [])).toThrow();
  }
});
