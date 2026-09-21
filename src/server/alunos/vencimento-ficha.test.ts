import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, StatusAluno, StatusCobranca } from "@prisma/client";
import { instanteDaGrade } from "@/server/agenda/grade";

const db = vi.hoisted(() => ({
  aluno: { findUnique: vi.fn(), findMany: vi.fn() },
  cobranca: { findUnique: vi.fn() },
}));
const trilhas = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/server/financeiro/vencimento-civil", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/financeiro/vencimento-civil")>();
  return { ...original, carregarTrilhasVencimentoCivil: trilhas };
});

import { obterAluno } from "./consultas";

const secretaria = { id: "secretaria", nome: "Secretaria", papeis: [Papel.SECRETARIA_ACADEMICA] };
const professor = { id: "professor", nome: "Professor", papeis: [Papel.PROFESSOR] };

function cobranca(id: string, matriculaId: string, vencimento: Date) {
  return {
    id, matriculaId, status: StatusCobranca.PENDENTE, vencimento, moeda: "CRC",
    valorNegociado: 80, valorRecebido: 0, saldo: 80,
  };
}

function aluno(cobrancas: ReturnType<typeof cobranca>[]) {
  const turma = {
    id: "turma", professorId: "professor", status: "EM_ANDAMENTO", diasHorario: "Segunda 19:00",
    modalidade: { nome: "Regular" }, nivel: { codigo: "A1", idioma: { nome: "Inglês" } },
    professor: { nome: "Professor" }, vinculosDocentes: [{ professorId: "professor", inicio: new Date("2020-01-01"), fim: null }],
  };
  return {
    id: "aluno", codigo: "A-1", primeiroNome: "Ana", sobrenome: "Silva", nomePreferido: null,
    status: StatusAluno.ATIVO, criadoEm: new Date("2020-01-01"), paisId: "pais", pais: { nome: "Costa Rica" },
    idiomaNativo: null, fuso: null, nascimento: null, genero: null, tipoDocumentoId: null, documento: null,
    documentoValido: false, documentoPaisEmissor: null, nacionalidade: null, segundaNacionalidade: null,
    email: null, telefoneE164: null, whatsapp: false, aceitaComunicacoes: false, paisResidencia: null,
    cep: null, rua: null, numero: null, complemento: null, bairro: null, cidade: null, regiao: null,
    escolaridade: null, observacoes: null,
    alocacoes: [{ id: "alocacao", ativa: true, turmaId: "turma", matriculaId: "m2", matricula: { codigo: "M-2", status: "ATIVA" }, turma }],
    matriculas: [
      { id: "m1", cobrancas: cobrancas.filter((item) => item.matriculaId === "m1") },
      { id: "m2", cobrancas: cobrancas.filter((item) => item.matriculaId === "m2") },
    ],
    movimentacoes: [],
  };
}

function fonteDaCobranca(id: string, matriculaId: string) {
  return {
    id, matriculaId, versao: 1,
    vencimento: instanteDaGrade("2099-10-05", "12:00", "America/Costa_Rica"),
    itemEmissaoEntrada: {
      emissao: {
        memoria: {
          fusoInstitucional: "America/Costa_Rica",
          cobrancas: [{ id, vencimento: "2099-10-05" }],
        },
      },
    },
    emissaoContinuidadeGerada: [], emissaoFechamentoHoras: null, aplicacoesAcertoTaxaAditivo: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  trilhas.mockResolvedValue({ m01PorCobranca: new Map(), vencimentosPorCobranca: new Map(), retomadasReprogramadas: [] });
});

describe("resumo financeiro da ficha", () => {
  it("usa a fonte civil confirmada da cobrança mais próxima do contrato correto", async () => {
    const primeira = cobranca("c1", "m1", instanteDaGrade("2099-10-08", "12:00", "America/Costa_Rica"));
    const escolhida = cobranca("c2", "m2", instanteDaGrade("2099-10-05", "12:00", "America/Costa_Rica"));
    db.aluno.findUnique.mockResolvedValue(aluno([primeira, escolhida]));
    db.cobranca.findUnique.mockResolvedValue(fonteDaCobranca("c2", "m2"));

    const ficha = await obterAluno("aluno", secretaria);

    expect(ficha?.financeiro?.proximoVencimento).toEqual({
      estado: "CONFIRMADO", dataCivil: "2099-10-05", fuso: "America/Costa_Rica", origem: "EMISSAO_ENTRADA",
    });
    expect(db.cobranca.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c2" } }));
    expect(trilhas).toHaveBeenCalledWith(db, ["c2"], ["m2"]);
  });

  it("encaminha para conferência quando a cobrança selecionada não tem fonte e não troca de contrato", async () => {
    const primeira = cobranca("c1", "m1", instanteDaGrade("2099-10-08", "12:00", "America/Costa_Rica"));
    const escolhida = cobranca("c2", "m2", instanteDaGrade("2099-10-05", "12:00", "America/Costa_Rica"));
    db.aluno.findUnique.mockResolvedValue(aluno([primeira, escolhida]));
    db.cobranca.findUnique.mockResolvedValue(null);

    const ficha = await obterAluno("aluno", secretaria);

    expect(ficha?.financeiro?.proximoVencimento).toMatchObject({ estado: "A_CONFERIR" });
    expect(db.cobranca.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c2" } }));
    expect(trilhas).not.toHaveBeenCalled();
  });

  it("recusa a releitura da cobrança quando ela não confirma a matrícula escolhida", async () => {
    const escolhida = cobranca("c2", "m2", instanteDaGrade("2099-10-05", "12:00", "America/Costa_Rica"));
    db.aluno.findUnique.mockResolvedValue(aluno([escolhida]));
    db.cobranca.findUnique.mockResolvedValue(fonteDaCobranca("c2", "m1"));

    const ficha = await obterAluno("aluno", secretaria);

    expect(ficha?.financeiro?.proximoVencimento).toMatchObject({ estado: "A_CONFERIR" });
    expect(trilhas).not.toHaveBeenCalled();
  });

  it("mantém a projeção financeira nula para professor sem consultar fontes ou trilhas", async () => {
    const escolhida = cobranca("c2", "m2", instanteDaGrade("2099-10-05", "12:00", "America/Costa_Rica"));
    db.aluno.findUnique.mockResolvedValue(aluno([escolhida]));

    const ficha = await obterAluno("aluno", professor);

    expect(ficha?.financeiro).toBeNull();
    expect(ficha?.aluno.matriculas).toEqual([]);
    expect(db.cobranca.findUnique).not.toHaveBeenCalled();
    expect(trilhas).not.toHaveBeenCalled();
  });
});
