import { expect, it } from "vitest";
import { projetarParticipacaoCorrecaoAula, validarProjecaoCorrecaoAula } from "./correcao-aula-projecao";
import type { SnapshotCorrecaoAula } from "./correcao-aula-schema";

const fonte: SnapshotCorrecaoAula = {
  versao: 1, encontroId: "encontro-1", diarioId: "diario-1", conteudo: "Conteúdo original", gravacao: null,
  registros: [
    { registroId: "registro-a", alunoId: "aluno-a", matriculaId: "matricula-a", nomeAluno: "Ana", presente: true, participacao: "PRESENTE", observacao: null },
    { registroId: "registro-b", alunoId: "aluno-b", matriculaId: "matricula-b", nomeAluno: "Beto", presente: false, participacao: "FALTA", observacao: "Ausência informada" },
  ],
};

function copia<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

it("preserva a publicação oficial por identidade e recusa substituição sem fluxo próprio", () => {
  const anterior = { ...fonte, gravacao: { tipo: "OFICIAL" as const, publicacaoId: "publicacao-1" } };
  expect(validarProjecaoCorrecaoAula(anterior, { ...anterior, conteudo: "Texto corrigido" }).novo.gravacao).toEqual(anterior.gravacao);
  for (const gravacao of [null, { tipo: "OFICIAL", publicacaoId: "outra-publicacao" }, { tipo: "EXCECAO", decisaoId: "excecao" },
    { tipo: "OFICIAL", publicacaoId: "publicacao-1", arquivoOficialId: "arquivo-externo" }]) {
    expect(() => validarProjecaoCorrecaoAula(anterior, { ...anterior, gravacao })).toThrow();
  }
});

it("normaliza a ordem nova pela fonte sem mutar snapshots e permite correções legítimas", () => {
  const anterior = copia(fonte);
  const novo = {
    ...copia(fonte),
    conteudo: "Conteúdo corrigido",
    registros: [
      { ...fonte.registros[1]!, participacao: "IMPEDIDO_POR_RESTRICAO" as const, presente: false, observacao: "Restrição comprovada" },
      { ...fonte.registros[0]!, observacao: "Presença conferida" },
    ],
  };
  const resultado = validarProjecaoCorrecaoAula(anterior, novo);

  expect(resultado.novo.registros.map(registro => registro.registroId)).toEqual(["registro-a", "registro-b"]);
  expect(resultado.novo).toMatchObject({ conteudo: "Conteúdo corrigido", registros: [
    { observacao: "Presença conferida" },
    { participacao: "IMPEDIDO_POR_RESTRICAO", observacao: "Restrição comprovada" },
  ] });
  expect(anterior).toEqual(fonte);
  expect(novo.registros.map(registro => registro.registroId)).toEqual(["registro-b", "registro-a"]);
});

it("recusa troca de identidade ou nome do registro", () => {
  const trocaAluno = copia(fonte);
  trocaAluno.registros[0]!.alunoId = "aluno-intruso";
  const trocaMatricula = copia(fonte);
  trocaMatricula.registros[0]!.matriculaId = "matricula-intrusa";
  const trocaNome = copia(fonte);
  trocaNome.registros[0]!.nomeAluno = "Outra pessoa";

  for (const novo of [trocaAluno, trocaMatricula, trocaNome]) {
    expect(() => validarProjecaoCorrecaoAula(fonte, novo)).toThrow();
  }
});

it("recusa duplicações mesmo quando os registroIds são diferentes", () => {
  const alunoDuplicado = copia(fonte);
  alunoDuplicado.registros[1] = { ...alunoDuplicado.registros[1]!, registroId: "registro-c", alunoId: "aluno-a" };
  const matriculaDuplicada = copia(fonte);
  matriculaDuplicada.registros[1] = { ...matriculaDuplicada.registros[1]!, registroId: "registro-c", matriculaId: "matricula-a" };
  const registroDuplicado = copia(fonte);
  registroDuplicado.registros[1] = { ...registroDuplicado.registros[1]!, registroId: "registro-a" };

  for (const novo of [alunoDuplicado, matriculaDuplicada, registroDuplicado]) {
    expect(() => validarProjecaoCorrecaoAula(fonte, novo)).toThrow();
  }
});

it("projeta participação em cópia e preserva campos extras", () => {
  const registro = {
    id: "registro-a", matriculaId: "matricula-a", presente: false, participacao: "FALTA" as const,
    observacao: "Original", origemExterna: "legado",
  };
  const projetado = projetarParticipacaoCorrecaoAula(registro, {
    registroId: "registro-a", matriculaId: "matricula-a", participacao: "PRESENTE",
  });

  expect(projetado).toEqual({ ...registro, presente: true, participacao: "PRESENTE" });
  expect(projetado).not.toBe(registro);
  expect(registro).toMatchObject({ presente: false, participacao: "FALTA", origemExterna: "legado" });
  expect(() => projetarParticipacaoCorrecaoAula(registro, {
    registroId: "outro", matriculaId: "matricula-a", participacao: "PRESENTE",
  })).toThrow();
});
