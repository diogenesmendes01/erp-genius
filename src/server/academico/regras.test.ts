import { describe, expect, it } from "vitest";
import {
  CancelarMudancaAcademicaSchema, DecidirMudancaAcademicaSchema, ExecutarMudancaAcademicaSchema,
  RegistrarParecerMudancaSchema, SolicitarMudancaAcademicaSchema,
} from "./schema";
import {
  classificarDestinoAcademico, exigirDecisaoAcademicaIndependente, exigirSnapshotMudancaAcademicaAtual,
  impedimentoEstadoAcademico, montarSnapshotMudancaAcademica,
} from "./regras";
import type { EstadoAcademico, TurmaAcademica } from "./estado";

const agora = new Date("2026-09-08T12:00:00Z");
const motivo = "Mudança pedagógica fundamentada";
function turma(id: string, nivelId: string): TurmaAcademica {
  return {
    id, codigo: `T-${id}`, nome: id, nivelId, modalidadeId: "regular", professorId: "professor",
    status: "EM_ANDAMENTO", online: true, diasSemana: [1, 3], horarioInicio: "18:00", horarioFim: "19:00", diasHorario: "Seg, Qua · 18:00–19:00",
    dataInicio: new Date("2026-08-01T12:00:00Z"), dataFim: new Date("2026-12-01T12:00:00Z"), capacidade: 10, rolling: false,
    nivel: { id: nivelId, codigo: nivelId, ordem: nivelId === "A1" ? 1 : 4, idiomaId: "portugues", idioma: { nome: "Português" } },
    modalidade: { id: "regular", nome: "Regular", segmento: "ADULTO", frequencia: "2x/semana", horasAula: 1, duracaoPorNivel: "3 meses", aulasPorNivel: 24, minimoAbrir: 1 },
    vinculosDocentes: [{ id: `vinculo-${id}`, professorId: "professor", inicio: new Date("2026-07-01T12:00:00Z"), fim: null }],
    _count: { alocacoes: 2, reservasMatricula: 0 },
  };
}
function estado(): EstadoAcademico {
  const origem = { id: "alocacao-original", matriculaId: null, turmaId: "origem", criadoEm: new Date("2026-08-01T12:00:00Z"), turma: turma("origem", "A1") };
  return {
    aluno: { id: "aluno", primeiroNome: "Ana", sobrenome: "Teste", status: "ATIVO", alocacoes: [origem] },
    origem, destino: turma("destino", "B2"),
    matriculas: [{ id: "matricula", status: "ATIVA", produtoId: "produto", produto: { idiomaId: "portugues", modalidadeId: "regular" } }],
    ultimaMovimentacao: { id: "movimento-original", tipo: "MATRICULA", criadoEm: new Date("2026-08-01T12:00:00Z") },
    totalMovimentacoes: 1,
  };
}

describe("entradas que autorizam uma mudança acadêmica", () => {
  it.each([undefined, false, "true", 1, null])("confirmação de horário %j não autoriza solicitação ou execução", (horarioCompativel) => {
    expect(SolicitarMudancaAcademicaSchema.safeParse({ turmaDestinoId: "destino", motivo, horarioCompativel }).success).toBe(false);
    expect(ExecutarMudancaAcademicaSchema.safeParse({ motivo, horarioCompativel }).success).toBe(false);
  });

  it.each(["", "     ", "abcd", "x".repeat(2001)])("justificativa inválida não autoriza nenhuma etapa (%s)", (texto) => {
    expect(SolicitarMudancaAcademicaSchema.safeParse({ turmaDestinoId: "destino", motivo: texto, horarioCompativel: true }).success).toBe(false);
    expect(RegistrarParecerMudancaSchema.safeParse({ conteudo: texto }).success).toBe(false);
    expect(DecidirMudancaAcademicaSchema.safeParse({ aprovar: true, motivo: texto }).success).toBe(false);
    expect(ExecutarMudancaAcademicaSchema.safeParse({ motivo: texto, horarioCompativel: true }).success).toBe(false);
    expect(CancelarMudancaAcademicaSchema.safeParse({ motivo: texto }).success).toBe(false);
  });

  it("normaliza espaços de justificativas sem converter aprovação não booleana", () => {
    expect(SolicitarMudancaAcademicaSchema.parse({ turmaDestinoId: " destino ", motivo: `  ${motivo}  `, horarioCompativel: true })).toEqual({ turmaDestinoId: "destino", motivo, horarioCompativel: true });
    for (const aprovar of ["false", "true", 1, 0, null, undefined]) {
      expect(DecidirMudancaAcademicaSchema.safeParse({ aprovar, motivo }).success).toBe(false);
    }
  });

  it("dispensa curta ou anexada à rejeição não substitui um parecer", () => {
    expect(DecidirMudancaAcademicaSchema.safeParse({ aprovar: true, motivo, justificativaDispensaParecer: "abc" }).success).toBe(false);
    expect(DecidirMudancaAcademicaSchema.safeParse({ aprovar: false, motivo, justificativaDispensaParecer: "Professor indisponível" }).success).toBe(false);
    expect(DecidirMudancaAcademicaSchema.parse({ aprovar: true, motivo, justificativaDispensaParecer: " Professor indisponível " }).justificativaDispensaParecer).toBe("Professor indisponível");
  });

  it("pessoas distintas são necessárias independentemente dos papéis acumulados", () => {
    expect(() => exigirDecisaoAcademicaIndependente("mesma-pessoa", "mesma-pessoa")).toThrow(/própria|papéis/);
    expect(() => exigirDecisaoAcademicaIndependente("solicitante", "aprovador")).not.toThrow();
  });
});

describe("equivalência, matrícula e capacidade", () => {
  it("distingue mesmo nível de exceção e não trata idioma ou modalidade diferente como autorização pedagógica", () => {
    const origem = turma("origem", "A1");
    const destino = turma("destino", "A1");
    expect(classificarDestinoAcademico(origem, destino)).toBe("EQUIVALENTE");
    destino.nivelId = "B2";
    expect(classificarDestinoAcademico(origem, destino)).toBe("EXCECAO");
    destino.modalidadeId = "particular";
    expect(classificarDestinoAcademico(origem, destino)).toBe("INCOMPATIVEL");
    destino.modalidadeId = origem.modalidadeId;
    destino.nivel.idiomaId = "ingles";
    expect(classificarDestinoAcademico(origem, destino)).toBe("INCOMPATIVEL");
  });

  it("legado sem matrícula conserva operação; havendo matrícula exige ativa compatível", () => {
    const e = estado();
    expect(impedimentoEstadoAcademico(e, true, agora)).toBeNull();
    e.matriculas[0].status = "ENCERRADA";
    expect(impedimentoEstadoAcademico(e, true, agora)).toMatch(/matrícula ativa/);
    e.matriculas[0].status = "ATIVA";
    e.matriculas[0].produto.modalidadeId = "particular";
    expect(impedimentoEstadoAcademico(e, true, agora)).toMatch(/matrícula ativa/);
    e.matriculas = [];
    expect(impedimentoEstadoAcademico(e, true, agora)).toBeNull();
  });

  it("aluno pausado, encerrado ou sem turma não pode movimentar", () => {
    for (const status of ["PAUSADO", "ENCERRADO"] as const) {
      const e = estado(); e.aluno.status = status;
      expect(impedimentoEstadoAcademico(e, true, agora)).toMatch(/ativos/);
    }
    const e = estado(); e.aluno.alocacoes = []; e.origem = null;
    expect(impedimentoEstadoAcademico(e, true, agora)).toMatch(/turma atual/);
  });

  it("vaga é real e destino concluído, expirado ou igual à origem não recebe transferência", () => {
    const e = estado();
    e.destino!._count.alocacoes = e.destino!.capacidade;
    expect(impedimentoEstadoAcademico(e, true, agora)).toMatch(/vaga/);
    e.destino!._count.alocacoes = 0; e.destino!.status = "CONCLUIDA";
    expect(impedimentoEstadoAcademico(e, true, agora)).toMatch(/disponível/);
    e.destino!.status = "EM_ANDAMENTO"; e.destino!.dataFim = new Date("2026-09-07T12:00:00Z");
    expect(impedimentoEstadoAcademico(e, true, agora)).toMatch(/disponível/);
    e.destino = e.origem!.turma;
    expect(impedimentoEstadoAcademico(e, true, agora)).toMatch(/já está/);
  });
});

describe("aprovação vinculada ao estado acadêmico", () => {
  it.each(["PAUSADO", "ENCERRADO"] as const)("contrato ativo independe do cadastro global %s", status => {
    const e = estado(); e.origem!.matriculaId = "matricula";
    const snapshot = montarSnapshotMudancaAcademica(e);
    expect(snapshot).toMatchObject({ versao: 2, statusAluno: null, matriculaOrigemId: "matricula" });
    e.aluno.status = status;
    expect(impedimentoEstadoAcademico(e, false)).toBeNull();
    expect(() => exigirSnapshotMudancaAcademicaAtual(snapshot, e)).not.toThrow();
    e.matriculas[0].status = "PAUSADA";
    expect(impedimentoEstadoAcademico(e, false)).toMatch(/matrícula vinculada/);
    expect(() => exigirSnapshotMudancaAcademicaAtual(snapshot, e)).toThrow();
  });

  it("versão antiga preserva sua condição global em vez de ampliar aprovação existente", () => {
    const e = estado(); e.origem!.matriculaId = "matricula";
    const antigo = { ...montarSnapshotMudancaAcademica(e), versao: 1, statusAluno: "ATIVO" };
    expect(() => exigirSnapshotMudancaAcademicaAtual(antigo, e)).not.toThrow();
    e.aluno.status = "PAUSADO";
    expect(() => exigirSnapshotMudancaAcademicaAtual(antigo, e)).toThrow(/mudaram/);
  });

  it("contrato vinculado encerrado não é autorizado por outro contrato ativo", () => {
    const e = estado();
    e.origem!.matriculaId = "matricula";
    e.matriculas.push({ ...e.matriculas[0], id: "outra-ativa" });
    e.matriculas[0].status = "ENCERRADA";
    expect(impedimentoEstadoAcademico(e, true, agora)).toMatch(/matrícula vinculada/);
  });

  it("snapshot legado só continua válido enquanto a alocação permanece sem vínculo conferido", () => {
    const e = estado();
    const { matriculaOrigemId, ...legado } = montarSnapshotMudancaAcademica(e);
    expect(matriculaOrigemId).toBeNull();
    expect(() => exigirSnapshotMudancaAcademicaAtual(legado, e)).not.toThrow();
    e.origem!.matriculaId = "matricula";
    expect(() => exigirSnapshotMudancaAcademicaAtual(legado, e)).toThrow(/mudaram/);
  });

  it("ordenação do banco e ocupação não invalidam o pedido, mas não reservam vaga", () => {
    const e = estado();
    e.matriculas.push({ ...e.matriculas[0], id: "outra-matricula" });
    e.destino!.vinculosDocentes.push({ ...e.destino!.vinculosDocentes[0], id: "outro-vinculo" });
    const snapshot = montarSnapshotMudancaAcademica(e);
    e.matriculas.reverse(); e.destino!.vinculosDocentes.reverse(); e.destino!.diasSemana.reverse();
    e.destino!._count.alocacoes = e.destino!.capacidade;
    expect(() => exigirSnapshotMudancaAcademicaAtual(snapshot, e)).not.toThrow();
    expect(impedimentoEstadoAcademico(e, true, agora)).toMatch(/vaga/);
  });

  it.each([
    ["matrícula da alocação", (e: EstadoAcademico) => { e.origem!.matriculaId = "matricula"; }],
    ["alocação recriada na mesma turma", (e: EstadoAcademico) => { e.origem!.id = "outra-alocacao"; }],
    ["instante da alocação", (e: EstadoAcademico) => { e.origem!.criadoEm = agora; }],
    ["última movimentação", (e: EstadoAcademico) => { e.ultimaMovimentacao!.id = "retomada-posterior"; }],
    ["movimento novo com mesmo timestamp", (e: EstadoAcademico) => { e.totalMovimentacoes += 1; }],
    ["status da matrícula", (e: EstadoAcademico) => { e.matriculas[0].status = "ENCERRADA"; }],
    ["matrícula adicionada", (e: EstadoAcademico) => { e.matriculas.push({ ...e.matriculas[0], id: "nova-matricula" }); }],
    ["produto da matrícula", (e: EstadoAcademico) => { e.matriculas[0].produtoId = "novo-produto"; }],
    ["idioma do produto", (e: EstadoAcademico) => { e.matriculas[0].produto.idiomaId = "ingles"; }],
    ["horário da turma", (e: EstadoAcademico) => { e.destino!.horarioInicio = "20:00"; }],
    ["dias da turma", (e: EstadoAcademico) => { e.destino!.diasSemana = [2, 4]; }],
    ["nível da turma", (e: EstadoAcademico) => { e.destino!.nivelId = "C1"; }],
    ["currículo do nível", (e: EstadoAcademico) => { e.destino!.nivel.ordem += 1; }],
    ["duração da modalidade", (e: EstadoAcademico) => { e.destino!.modalidade.duracaoPorNivel = "6 meses"; }],
    ["capacidade da turma", (e: EstadoAcademico) => { e.destino!.capacidade += 1; }],
    ["professor da turma", (e: EstadoAcademico) => { e.origem!.turma.professorId = "outro-professor"; }],
    ["vínculo docente recriado", (e: EstadoAcademico) => { e.origem!.turma.vinculosDocentes[0].id = "vinculo-novo"; }],
  ] as const)("invalida aprovação após %s", (_nome, alterar) => {
    const e = estado();
    const snapshot = montarSnapshotMudancaAcademica(e);
    alterar(e);
    expect(() => exigirSnapshotMudancaAcademicaAtual(snapshot, e)).toThrow(/mudaram/);
  });

  it("snapshot não verificável ou pertencente a outro aluno não autoriza execução", () => {
    const e = estado();
    for (const snapshot of [null, {}, { versao: 99 }, { ...montarSnapshotMudancaAcademica(e), alunoId: "aluno-alheio" }]) {
      expect(() => exigirSnapshotMudancaAcademicaAtual(snapshot, e)).toThrow();
    }
  });
});

it("reserva ocupante impede destino sem vaga mesmo com poucas alocações", () => {
  const e = estado();
  e.destino!._count.reservasMatricula = 8;
  expect(impedimentoEstadoAcademico(e, true, agora)).toContain("sem vaga");
});
