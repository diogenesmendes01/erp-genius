import { beforeEach, describe, expect, it, vi } from "vitest";
import { Papel, StatusAluno, StatusCobranca } from "@prisma/client";

const db = vi.hoisted(() => ({ aluno: { findMany: vi.fn(), findUnique: vi.fn() }, turma: { findUnique: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { listarAlunos, obterAluno, obterTurma, podeEditarCadastroAluno } from "./consultas";

const usuario = (...papeis: Papel[]) => ({ id: "professor", nome: "Prof", papeis });
const segredo = "DIVIDA_DOCUMENTO_TELEFONE_PRIVADO";
function aluno() {
  const turma = { id: "t1", professorId: "professor", status: "EM_ANDAMENTO", vinculosDocentes: [{ professorId: "professor", inicio: new Date("2020-01-01"), fim: null }], diasHorario: "Segunda 19:00", modalidade: { nome: "Regular" }, nivel: { codigo: "A1", idioma: { nome: "Inglês" } }, professor: { nome: "Prof" } };
  return {
    id: "a1", codigo: "A-1", primeiroNome: "Ana", sobrenome: "Silva", nomePreferido: null,
    status: StatusAluno.ATIVO, criadoEm: new Date(), paisId: "p1", pais: { nome: "Brasil" }, idiomaNativo: "Português", fuso: "America/Sao_Paulo",
    nascimento: new Date("2012-03-02"), genero: null, tipoDocumentoId: segredo, documento: segredo, documentoValido: true,
    documentoPaisEmissor: segredo, nacionalidade: segredo, segundaNacionalidade: segredo, email: segredo, telefoneE164: segredo,
    whatsapp: true, aceitaComunicacoes: true, paisResidencia: segredo, cep: segredo, rua: segredo, numero: segredo,
    complemento: segredo, bairro: segredo, cidade: segredo, regiao: segredo, escolaridade: null, observacoes: segredo,
    alocacoes: [{ id: "al1", ativa: true, turmaId: "t1", turma }],
    matriculas: [{ id: "m1", valorTaxa: 777, cobrancas: [{ status: StatusCobranca.PENDENTE, vencimento: new Date("2020-01-01"), moeda: "BRL", valorNegociado: 100, valorRecebido: 40, saldo: 60 }] }],
    movimentacoes: [{ id: "mv1", tipo: "PAUSA", criadoEm: new Date(), usuario: { nome: "Secretaria" }, motivo: segredo, observacao: segredo }],
  };
}
beforeEach(() => { vi.clearAllMocks(); db.aluno.findMany.mockResolvedValue([aluno()]); db.aluno.findUnique.mockResolvedValue(aluno()); });

describe("projeção de alunos — regras por campo e finalidade", () => {
  it("linha do tempo identifica contrato e limita o professor aos vínculos autorizados", async () => {
    const a = aluno();
    const movimento = a.movimentacoes[0];
    db.aluno.findUnique.mockResolvedValue({ ...a,
      alocacoes: [{ ...a.alocacoes[0], matriculaId: "m1", matricula: { codigo: "M-1", status: "ATIVA" } }],
      movimentacoes: [
        { ...movimento, id: "proprio", matriculaId: "m1", matricula: { codigo: "M-1" } },
        { ...movimento, id: "alheio", matriculaId: "m2", matricula: { codigo: "M-2" } },
        { ...movimento, id: "legado", matriculaId: null, matricula: null },
      ],
    });
    const docente = await obterAluno("a1", usuario(Papel.PROFESSOR));
    expect(docente?.aluno.movimentacoes).toMatchObject([{ id: "proprio", matriculaId: "m1", matriculaCodigo: "M-1", motivo: null }]);
    expect(docente?.aluno.movimentacoes).toHaveLength(1);
    const secretaria = await obterAluno("a1", usuario(Papel.SECRETARIA_ACADEMICA));
    expect(secretaria?.aluno.movimentacoes.map((m) => m.matriculaCodigo)).toEqual(["M-1", "M-2", null]);
  });
  it("ficha mantém todos os vínculos administrativos e somente a turma própria do professor", async () => {
    const a = aluno();
    const propria = a.alocacoes[0];
    a.alocacoes = [{ ...propria, id: "alheia", turmaId: "outra", turma: { ...propria.turma, id: "outra", professorId: "outro", vinculosDocentes: [] } }, propria];
    db.aluno.findUnique.mockResolvedValue(a);
    db.aluno.findMany.mockResolvedValue([a]);
    expect((await listarAlunos(usuario(Papel.PROFESSOR)))[0].turmas.map((t) => t.id)).toEqual(["t1"]);
    expect((await listarAlunos(usuario(Papel.SECRETARIA_ACADEMICA)))[0].turmas.map((t) => t.id)).toEqual(["outra", "t1"]);
    const docente = await obterAluno("a1", usuario(Papel.PROFESSOR));
    expect(docente?.aluno.alocacoes.map((v) => v.id)).toEqual(["al1"]);
    const administrativa = await obterAluno("a1", usuario(Papel.SECRETARIA_ACADEMICA));
    expect(administrativa?.aluno.alocacoes.map((v) => v.id)).toEqual(["alheia", "al1"]);
  });
  it.each([[Papel.PROFESSOR], [Papel.GERENTE_PEDAGOGICO], [Papel.PROFESSOR, Papel.VENDEDOR], [Papel.GERENTE_PEDAGOGICO, Papel.VENDEDOR]])("papéis pedagógicos %j não recebem dinheiro nem campos privados", async (...papeis) => {
    const u = usuario(...papeis);
    const lista = await listarAlunos(u);
    expect(lista[0].financeiro).toBeNull();
    const ficha = await obterAluno("a1", u);
    expect(ficha?.aluno.primeiroNome).toBe("Ana");
    expect(ficha?.financeiro).toBeNull();
    expect(ficha?.aluno.matriculas).toEqual([]);
    expect(JSON.stringify(ficha)).not.toContain(segredo);
    expect(ficha?.aluno.nascimento).toBeNull();
    expect(podeEditarCadastroAluno(u)).toBe(false);
  });
  it("Secretaria com papel professor conserva capacidade cadastral e financeiro individual", async () => {
    const u = usuario(Papel.SECRETARIA_ACADEMICA, Papel.PROFESSOR);
    const ficha = await obterAluno("a1", u);
    expect(ficha?.aluno.documento).toBe(segredo);
    expect(ficha?.financeiro?.emAberto).toEqual([{ moeda: "BRL", valor: 60 }]);
    expect(podeEditarCadastroAluno(u)).toBe(true);
  });
  it("sem identidade não consulta aluno, turma ou lista", async () => {
    expect(await obterAluno("a1")).toBeNull();
    expect(await obterTurma("t1")).toBeNull();
    expect(await listarAlunos()).toEqual([]);
    expect(db.aluno.findUnique).not.toHaveBeenCalled();
    expect(db.aluno.findMany).not.toHaveBeenCalled();
    expect(db.turma.findUnique).not.toHaveBeenCalled();
  });
  it("professor removido da turma perde a ficha atual", async () => {
    const a = aluno(); a.alocacoes[0].turma.professorId = "outro";
    db.aluno.findUnique.mockResolvedValue(a);
    expect(await obterAluno("a1", usuario(Papel.PROFESSOR))).toBeNull();
  });
  it("vendedor não ganha ficha de turma nem edição por conhecer o ID", async () => {
    expect(await obterTurma("t1", usuario(Papel.VENDEDOR))).toBeNull();
    expect(podeEditarCadastroAluno(usuario(Papel.GERENTE_PEDAGOGICO))).toBe(false);
  });
});


