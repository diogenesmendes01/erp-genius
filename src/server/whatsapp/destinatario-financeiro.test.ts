import { describe, expect, it } from "vitest";
import { resolverDestinoFinanceiroDaMatricula, type MatriculaComDestino } from "./destinatario-financeiro";

function matricula({ id = "matricula-1", telefoneAluno = "+5511999990000", quantidadeMatriculas = 1, pagador = null, preparacao = null }: {
  id?: string; telefoneAluno?: string | null; quantidadeMatriculas?: number;
  pagador?: { id: string; versao: number; tipo: string; dados: unknown } | null;
  preparacao?: { id: string } | null;
} = {}) {
  return {
    id,
    pais: { fuso: "America/Sao_Paulo" },
    aluno: {
      id: "aluno-1", primeiroNome: "Ana", sobrenome: "Atual", telefoneE164: telefoneAluno, fuso: null,
      pais: { fuso: "America/Mexico_City" }, responsaveis: [], _count: { matriculas: quantidadeMatriculas },
    },
    pagadoresPreparacao: pagador ? [pagador] : [],
    preparacaoComercial: preparacao,
  } as unknown as MatriculaComDestino;
}

describe("destinatário financeiro por matrícula", () => {
  it("mantém dois pagadores explícitos distintos para matrículas do mesmo aluno", () => {
    const responsavel = resolverDestinoFinanceiroDaMatricula(matricula({ id: "matricula-a", pagador: {
      id: "pagador-a", versao: 3, tipo: "RESPONSAVEL", dados: { nome: "Responsável Contratual", telefoneE164: "+5511888880001" },
    } }));
    const empresa = resolverDestinoFinanceiroDaMatricula(matricula({ id: "matricula-b", pagador: {
      id: "pagador-b", versao: 1, tipo: "EMPRESA", dados: { nome: "Empresa Pagadora", telefoneE164: "+5511888880002" },
    } }));

    expect(responsavel).toMatchObject({ telefoneE164: "+5511888880001", matriculaId: "matricula-a", contatoAlunoId: null,
      tipoPagador: "RESPONSAVEL", referenciaFonte: "pagador:pagador-a:3" });
    expect(empresa).toMatchObject({ telefoneE164: "+5511888880002", matriculaId: "matricula-b", contatoAlunoId: null,
      tipoPagador: "EMPRESA", referenciaFonte: "pagador:pagador-b:1" });
  });

  it("não recai no cadastro global quando a fonte explícita está malformada", () => {
    const destino = resolverDestinoFinanceiroDaMatricula(matricula({ pagador: {
      id: "pagador-malformado", versao: 1, tipo: "ALUNO", dados: { alunoId: "outro-aluno" },
    } }));
    expect(destino).toBeNull();
  });

  it("não recai no aluno quando empresa explícita não tem telefone", () => {
    const destino = resolverDestinoFinanceiroDaMatricula(matricula({ pagador: {
      id: "pagador-empresa", versao: 2, tipo: "EMPRESA", dados: { nome: "Empresa sem telefone" },
    } }));
    expect(destino).toBeNull();
  });

  it("pagador ALUNO usa o telefone atual do cadastro, não a fotografia antiga", () => {
    const destino = resolverDestinoFinanceiroDaMatricula(matricula({ telefoneAluno: "+5511977770000", pagador: {
      id: "pagador-aluno", versao: 4, tipo: "ALUNO", dados: { alunoId: "aluno-1", telefoneE164: "+5511966660000" },
    } }));
    expect(destino).toMatchObject({ telefoneE164: "+5511977770000", contatoAlunoId: "aluno-1", tipoPagador: "ALUNO" });
  });

  it("mantém legado ambíguo sem destino quando o aluno tem outra matrícula", () => {
    expect(resolverDestinoFinanceiroDaMatricula(matricula({ quantidadeMatriculas: 2 }))).toBeNull();
  });
});
